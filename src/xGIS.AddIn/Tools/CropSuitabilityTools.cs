using System.IO;
using System.Text.Json;
using ArcGIS.Core.CIM;
using ArcGIS.Core.Geometry;
using ArcGIS.Desktop.Core.Geoprocessing;
using ArcGIS.Desktop.Mapping;
using xGIS.AddIn.Logging;
using xGIS.AddIn.Orchestrator;

namespace xGIS.AddIn.Tools;

/// <summary>
/// Crop-suitability analysis via the xcrop orchestrator (see Orchestrator/), rendered as a
/// new feature layer in the active map. Every method here must be called from inside
/// QueuedTask.Run (ToolDispatcher owns that) - same rule as GeoprocessingTools.cs, and for
/// the same reason: QueuedTask.Run's delegate keeps running on ArcGIS Pro's MCT thread
/// across each `await` for the duration of the queued task, which both the network calls
/// here (orchestrator HTTP) and the Map/Layer/Geoprocessing calls need - the former to not
/// block the MCT thread for the ~15-20s an analysis can take, the latter because those
/// APIs throw CalledOnWrongThreadException off that thread.
/// </summary>
public static class CropSuitabilityTools
{
    // FAO suitability class colors, matching xcrop desktop's own scheme exactly
    // (desktop/src/map/MapView.tsx's CLASS_COLORS) so a result looks the same whether
    // viewed in xcrop or in ArcGIS Pro.
    private static readonly (string Value, int R, int G, int B)[] ClassColors =
    {
        ("S1", 26, 152, 80),
        ("S2", 145, 207, 96),
        ("S3", 254, 224, 139),
        ("N", 215, 48, 39),
    };

    private static readonly OrchestratorClient s_client = new();

    private static string Get(JsonElement input, string name, string defaultValue = "") =>
        input.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? defaultValue
            : defaultValue;

    public static async Task<ToolResult> ListCropProfiles(JsonElement input, CancellationToken token)
    {
        try
        {
            await EnsureOrchestratorReadyAsync(token);
            var crops = await s_client.ListCropsAsync(token);

            var lines = crops.EnumerateArray()
                .Select(c => $"- {c.GetProperty("id").GetString()}: {c.GetProperty("name").GetString()}")
                .ToList();

            return lines.Count == 0
                ? ToolResult.Ok("No crop profiles are configured yet.")
                : ToolResult.Ok("Available crop profiles:\n" + string.Join("\n", lines));
        }
        catch (Exception ex)
        {
            return ToolResult.Fail($"Could not list crop profiles: {ex.Message}");
        }
    }

    public static async Task<ToolResult> RunSuitabilityAnalysis(JsonElement input, CancellationToken token)
    {
        var cropId = Get(input, "crop_id");
        if (string.IsNullOrWhiteSpace(cropId))
            return ToolResult.Fail("crop_id is required - call list_crop_profiles first if you don't know the available ids.");

        try
        {
            await EnsureOrchestratorReadyAsync(token);

            var mapView = MapView.Active;
            if (mapView?.Map is not { } map)
                return ToolResult.Fail("No active map to read an area of interest from.");

            // Uses the current visible map extent as the AOI - ask the user to pan/zoom to
            // the area they mean first, same convention as ArcGIS Pro's own "current
            // extent" export/print tools.
            var wgs84Extent = (Envelope)GeometryEngine.Instance.Project(mapView.Extent, SpatialReferences.WGS84);
            var aoiGeoJson = JsonSerializer.SerializeToElement(BuildEnvelopeGeoJson(
                wgs84Extent.XMin, wgs84Extent.YMin, wgs84Extent.XMax, wgs84Extent.YMax));

            var project = await s_client.CreateProjectAsync($"xGIS {DateTime.Now:yyyy-MM-dd HH:mm:ss}", aoiGeoJson, token);
            var projectId = project.GetProperty("id").GetString()!;

            var run = await s_client.AnalyzeAsync(projectId, cropId, token);
            var result = run.GetProperty("result");
            var points = result.GetProperty("points");
            var summary = result.GetProperty("summary");
            var cropName = result.TryGetProperty("crop_name", out var cn) ? cn.GetString() ?? cropId : cropId;

            var geoJson = BuildResultsGeoJson(points);
            var layerName = $"{cropName} suitability ({DateTime.Now:HH:mm:ss})";
            await AddResultLayerAsync(geoJson, layerName, map, token);

            return ToolResult.Ok(BuildSummaryText(cropName, layerName, summary));
        }
        catch (OrchestratorException ex)
        {
            return ToolResult.Fail($"xcrop orchestrator error: {ex.Message}");
        }
        catch (Exception ex)
        {
            return ToolResult.Fail($"Suitability analysis failed: {ex.Message}");
        }
    }

    private static async Task EnsureOrchestratorReadyAsync(CancellationToken token)
    {
        await xGISModule.Current.Orchestrator.EnsureRunningAsync(token);

        // Same Homie API key already used for the /v1/chat gateway this whole Add-in runs
        // on (see Config/CredentialStore.cs) - the orchestrator's /v1/chat call underneath
        // /analyze's grounded narration and /chat needs its own copy primed in, since it's
        // a separate process with its own in-memory-only settings.
        var apiKey = Config.CredentialStore.GetApiKey();
        if (!string.IsNullOrWhiteSpace(apiKey))
            await s_client.PrimeApiKeyAsync(apiKey, token);
    }

    // --- Pure JSON-building helpers: no ArcGIS Pro API dependency, so these are the part
    // of this file xGIS.AddIn.Tests can actually exercise (see CropSuitabilityToolsTests) -
    // everything else here needs a live Pro host, same limitation ToolDispatcherTests notes
    // for ToolDispatcher.Execute itself. ---

    internal static object BuildEnvelopeGeoJson(double minX, double minY, double maxX, double maxY) => new
    {
        type = "Polygon",
        coordinates = new[]
        {
            new[]
            {
                new[] { minX, minY },
                new[] { maxX, minY },
                new[] { maxX, maxY },
                new[] { minX, maxY },
                new[] { minX, minY },
            }
        },
    };

    internal static string BuildResultsGeoJson(JsonElement points)
    {
        var features = points.EnumerateArray()
            .Where(p => p.TryGetProperty("bounds", out var b) && b.ValueKind == JsonValueKind.Array)
            .Select(p =>
            {
                var bounds = p.GetProperty("bounds");
                var minLon = bounds[0].GetDouble();
                var minLat = bounds[1].GetDouble();
                var maxLon = bounds[2].GetDouble();
                var maxLat = bounds[3].GetDouble();

                return new
                {
                    type = "Feature",
                    geometry = BuildEnvelopeGeoJson(minLon, minLat, maxLon, maxLat),
                    properties = new
                    {
                        SuitClass = p.GetProperty("suitability_class").GetString(),
                        Score = p.GetProperty("suitability_score").GetDouble(),
                        Limiting = p.TryGetProperty("limiting_factor", out var lf) && lf.ValueKind == JsonValueKind.String
                            ? lf.GetString()
                            : null,
                    },
                };
            });

        return JsonSerializer.Serialize(new { type = "FeatureCollection", features });
    }

    internal static string BuildSummaryText(string cropName, string layerName, JsonElement summary)
    {
        var meanScore = summary.GetProperty("mean_suitability").GetDouble();
        var classCounts = summary.GetProperty("class_distribution").EnumerateObject()
            .Select(p => $"{p.Name}: {p.Value.GetInt32()}");
        var limitingFactor = summary.TryGetProperty("dominant_limiting_factor", out var lf)
            && lf.ValueKind == JsonValueKind.String
            ? lf.GetString()
            : null;

        var text = $"Ran {cropName} suitability analysis over the current map extent and added layer " +
                    $"'{layerName}' to the map.\nMean suitability: {meanScore}/100\n" +
                    $"Class distribution: {string.Join(", ", classCounts)}";
        if (limitingFactor is not null)
            text += $"\nDominant limiting factor: {limitingFactor}";
        return text;
    }

    // --- ArcGIS Pro API-dependent: needs a live host, exercised manually / via smoke test. ---

    private static async Task AddResultLayerAsync(string geoJson, string layerName, Map map, CancellationToken token)
    {
        var tempPath = Path.Combine(Path.GetTempPath(), $"xcrop_{Guid.NewGuid():N}.geojson");
        await File.WriteAllTextAsync(tempPath, geoJson, token);

        try
        {
            var outputPath = $"memory\\CropSuitability_{Guid.NewGuid():N}";
            var parameters = Geoprocessing.MakeValueArray(tempPath, outputPath);
            var gpResult = await Geoprocessing.ExecuteToolAsync(
                "JSONToFeatures_conversion", parameters, environments: null,
                cancelToken: token, flags: GPExecuteToolFlags.GPThread);

            if (gpResult.IsFailed)
            {
                var errors = string.Join("; ", gpResult.ErrorMessages.Select(m => m.Text));
                throw new InvalidOperationException($"Could not build the results layer: {errors}");
            }

            var layer = LayerFactory.Instance.CreateLayer(new Uri(outputPath), map, layerName: layerName) as FeatureLayer;
            ApplySuitabilityRenderer(layer);
        }
        finally
        {
            try
            {
                File.Delete(tempPath);
            }
            catch
            {
                // Best-effort cleanup of a scratch temp file.
            }
        }
    }

    private static void ApplySuitabilityRenderer(FeatureLayer? featureLayer)
    {
        if (featureLayer is null)
            return;

        var renderer = new CIMUniqueValueRenderer
        {
            Fields = new[] { "SuitClass" },
            Groups = new[]
            {
                new CIMUniqueValueGroup
                {
                    Classes = ClassColors.Select(c => new CIMUniqueValueClass
                    {
                        Values = new[] { new CIMUniqueValue { FieldValues = new[] { c.Value } } },
                        Symbol = SymbolFactory.Instance
                            .ConstructPolygonSymbol(CIMColor.CreateRGBColor(c.R, c.G, c.B))
                            .MakeSymbolReference(),
                        Label = c.Value,
                        Visible = true,
                    }).ToArray(),
                },
            },
        };

        featureLayer.SetRenderer(renderer);
    }
}

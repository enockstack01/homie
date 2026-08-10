using System.Text.Json;
using xGIS.AddIn.Tools;
using Xunit;

namespace xGIS.AddIn.Tests;

/// <summary>
/// Only the pure JSON-building helpers on CropSuitabilityTools are exercised here - same
/// limitation ToolDispatcherTests documents for the rest of the Tools/ namespace:
/// anything touching MapView.Active, LayerFactory, or Geoprocessing needs a live ArcGIS
/// Pro host process this test project doesn't have. These three (BuildEnvelopeGeoJson,
/// BuildResultsGeoJson, BuildSummaryText) are deliberately factored out to be the
/// exception, exactly like ClaudeAgentService.BuildRequestMessages.
/// </summary>
public class CropSuitabilityToolsTests
{
    [Fact]
    public void BuildEnvelopeGeoJson_ProducesAClosedFiveVertexRing()
    {
        var geoJson = CropSuitabilityTools.BuildEnvelopeGeoJson(29.0, -2.0, 30.0, -1.0);
        var json = JsonSerializer.SerializeToElement(geoJson);

        Assert.Equal("Polygon", json.GetProperty("type").GetString());
        var ring = json.GetProperty("coordinates")[0];
        Assert.Equal(5, ring.GetArrayLength());
        // Closed ring: first and last vertex identical.
        Assert.Equal(ring[0][0].GetDouble(), ring[4][0].GetDouble());
        Assert.Equal(ring[0][1].GetDouble(), ring[4][1].GetDouble());
        // Covers the requested bounds.
        Assert.Equal(29.0, ring[0][0].GetDouble());
        Assert.Equal(-2.0, ring[0][1].GetDouble());
        Assert.Equal(30.0, ring[2][0].GetDouble());
        Assert.Equal(-1.0, ring[2][1].GetDouble());
    }

    [Fact]
    public void BuildResultsGeoJson_MapsEachPointToAFeatureWithItsClassAndScore()
    {
        var pointsJson = """
            [
                {
                    "lat": -1.5, "lon": 29.5, "elevation_m": 1500, "slope_percent": 5,
                    "annual_rainfall_mm": 1200, "mean_temp_c": 20,
                    "criterion_scores": {}, "suitability_score": 92.0,
                    "suitability_class": "S1", "limiting_factor": null,
                    "bounds": [29.4, -1.6, 29.6, -1.4]
                },
                {
                    "lat": -1.7, "lon": 29.7, "elevation_m": 2600, "slope_percent": 35,
                    "annual_rainfall_mm": 900, "mean_temp_c": 12,
                    "criterion_scores": {}, "suitability_score": 0.0,
                    "suitability_class": "N", "limiting_factor": "slope",
                    "bounds": [29.6, -1.8, 29.8, -1.6]
                }
            ]
            """;
        using var doc = JsonDocument.Parse(pointsJson);

        var geoJsonText = CropSuitabilityTools.BuildResultsGeoJson(doc.RootElement);
        using var parsed = JsonDocument.Parse(geoJsonText);
        var root = parsed.RootElement;

        Assert.Equal("FeatureCollection", root.GetProperty("type").GetString());
        var features = root.GetProperty("features");
        Assert.Equal(2, features.GetArrayLength());

        var first = features[0];
        Assert.Equal("Feature", first.GetProperty("type").GetString());
        Assert.Equal("Polygon", first.GetProperty("geometry").GetProperty("type").GetString());
        Assert.Equal("S1", first.GetProperty("properties").GetProperty("SuitClass").GetString());
        Assert.Equal(92.0, first.GetProperty("properties").GetProperty("Score").GetDouble());

        var second = features[1];
        Assert.Equal("N", second.GetProperty("properties").GetProperty("SuitClass").GetString());
        Assert.Equal("slope", second.GetProperty("properties").GetProperty("Limiting").GetString());
    }

    [Fact]
    public void BuildResultsGeoJson_SkipsPointsMissingBounds()
    {
        var pointsJson = """
            [
                { "suitability_class": "S1", "suitability_score": 90.0 }
            ]
            """;
        using var doc = JsonDocument.Parse(pointsJson);

        var geoJsonText = CropSuitabilityTools.BuildResultsGeoJson(doc.RootElement);
        using var parsed = JsonDocument.Parse(geoJsonText);

        Assert.Equal(0, parsed.RootElement.GetProperty("features").GetArrayLength());
    }

    [Fact]
    public void BuildSummaryText_IncludesCropNameLayerNameScoreAndLimitingFactor()
    {
        var summaryJson = """
            {
                "mean_suitability": 78.3,
                "class_distribution": { "S1": 40, "S2": 10, "N": 2 },
                "dominant_limiting_factor": "annual_rainfall_mm"
            }
            """;
        using var doc = JsonDocument.Parse(summaryJson);

        var text = CropSuitabilityTools.BuildSummaryText("Avocado", "Avocado suitability (10:00:00)", doc.RootElement);

        Assert.Contains("Avocado", text);
        Assert.Contains("Avocado suitability (10:00:00)", text);
        Assert.Contains("78.3", text);
        Assert.Contains("S1: 40", text);
        Assert.Contains("annual_rainfall_mm", text);
    }

    [Fact]
    public void BuildSummaryText_OmitsLimitingFactorLineWhenNull()
    {
        var summaryJson = """
            {
                "mean_suitability": 0.0,
                "class_distribution": { "N": 50 },
                "dominant_limiting_factor": null
            }
            """;
        using var doc = JsonDocument.Parse(summaryJson);

        var text = CropSuitabilityTools.BuildSummaryText("Maize", "Maize suitability (11:00:00)", doc.RootElement);

        Assert.DoesNotContain("Dominant limiting factor", text);
    }
}

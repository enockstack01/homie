using System.Text.Json;
using ArcGIS.Desktop.Mapping;
using xGIS.AddIn.Logging;

namespace xGIS.AddIn.Tools;

/// <summary>
/// Mapping-API tools (not geoprocessing) for adding layers and grounding Claude in the
/// real state of the current map - actual layer names, fields, extent - instead of it
/// guessing at identifiers that don't exist. Called from inside QueuedTask.Run.
/// </summary>
public static class LayerTools
{
    private static string Get(JsonElement input, string name) =>
        input.TryGetProperty(name, out var v) ? v.GetString() ?? string.Empty : string.Empty;

    public static Task<ToolResult> AddLayer(JsonElement input, CancellationToken token)
    {
        var map = MapView.Active?.Map;
        if (map is null)
            return Task.FromResult(ToolResult.Fail("No active map to add the layer to."));

        var pathOrUrl = Get(input, "path_or_url");
        try
        {
            var layer = LayerFactory.Instance.CreateLayer(new Uri(pathOrUrl), map);
            return Task.FromResult(layer is null
                ? ToolResult.Fail($"Could not create a layer from '{pathOrUrl}'.")
                : ToolResult.Ok($"Added layer '{layer.Name}'."));
        }
        catch (Exception ex)
        {
            return Task.FromResult(ToolResult.Fail($"Failed to add layer from '{pathOrUrl}': {ex.Message}"));
        }
    }

    public static Task<ToolResult> ListLayers(JsonElement input, CancellationToken token)
    {
        var map = MapView.Active?.Map;
        if (map is null)
            return Task.FromResult(ToolResult.Fail("No active map."));

        var names = map.GetLayersAsFlattenedList()
            .Select(l => $"{l.Name} ({l.GetType().Name})")
            .ToList();

        return Task.FromResult(ToolResult.Ok(names.Count == 0
            ? "The active map has no layers."
            : "Layers in the active map:\n" + string.Join("\n", names)));
    }

    public static Task<ToolResult> DescribeLayer(JsonElement input, CancellationToken token)
    {
        var map = MapView.Active?.Map;
        var layerName = Get(input, "layer_name");
        var layer = map?.GetLayersAsFlattenedList()
            .FirstOrDefault(l => string.Equals(l.Name, layerName, StringComparison.OrdinalIgnoreCase));

        if (layer is not FeatureLayer featureLayer)
            return Task.FromResult(ToolResult.Fail($"No feature layer named '{layerName}' found in the active map."));

        using var featureClass = featureLayer.GetFeatureClass();
        var definition = featureClass?.GetDefinition();
        var fields = definition?.GetFields().Select(f => $"{f.Name} ({f.FieldType})") ?? Enumerable.Empty<string>();
        var spatialRef = definition?.GetSpatialReference()?.Name ?? "unknown";

        var description = $"Layer '{featureLayer.Name}'\n" +
                           $"Spatial reference: {spatialRef}\n" +
                           $"Fields: {string.Join(", ", fields)}";

        return Task.FromResult(ToolResult.Ok(description));
    }
}

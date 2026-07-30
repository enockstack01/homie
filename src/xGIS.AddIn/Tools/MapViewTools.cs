using System.Text.Json;
using ArcGIS.Desktop.Mapping;
using xGIS.AddIn.Logging;

namespace xGIS.AddIn.Tools;

public static class MapViewTools
{
    private static string Get(JsonElement input, string name) =>
        input.TryGetProperty(name, out var v) ? v.GetString() ?? string.Empty : string.Empty;

    public static async Task<ToolResult> ZoomToLayer(JsonElement input, CancellationToken token)
    {
        var mapView = MapView.Active;
        var layerName = Get(input, "layer_name");
        var layer = mapView?.Map.GetLayersAsFlattenedList()
            .FirstOrDefault(l => string.Equals(l.Name, layerName, StringComparison.OrdinalIgnoreCase));

        if (mapView is null || layer is null)
            return ToolResult.Fail($"No layer named '{layerName}' found in the active map.");

        await mapView.ZoomToAsync(layer);
        return ToolResult.Ok($"Zoomed to layer '{layer.Name}'.");
    }

    public static Task<ToolResult> GetMapInfo(JsonElement input, CancellationToken token)
    {
        var mapView = MapView.Active;
        if (mapView is null)
            return Task.FromResult(ToolResult.Fail("No active map view."));

        var map = mapView.Map;
        var extent = mapView.Extent;
        var info = $"Map: {map.Name}\n" +
                    $"Spatial reference: {map.SpatialReference?.Name}\n" +
                    $"Current view extent: XMin={extent.XMin:F2}, YMin={extent.YMin:F2}, " +
                    $"XMax={extent.XMax:F2}, YMax={extent.YMax:F2}\n" +
                    $"Layer count: {map.GetLayersAsFlattenedList().Count}";

        return Task.FromResult(ToolResult.Ok(info));
    }
}

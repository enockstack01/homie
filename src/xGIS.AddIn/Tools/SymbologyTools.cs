using System.Text.Json;
using ArcGIS.Core.CIM;
using ArcGIS.Desktop.Mapping;
using xGIS.AddIn.Logging;

namespace xGIS.AddIn.Tools;

/// <summary>
/// Covers the common "make this layer a solid color" request. Anything requiring a real
/// classified/graduated renderer is intentionally out of scope for this first version -
/// route those requests through run_geoprocessing_tool against the appropriate GP tool
/// (e.g. a script tool) instead of trying to hand-build every CIM renderer shape here.
/// </summary>
public static class SymbologyTools
{
    private static string Get(JsonElement input, string name, string defaultValue = "") =>
        input.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? defaultValue
            : defaultValue;

    public static Task<ToolResult> SetSolidColor(JsonElement input, CancellationToken token)
    {
        var map = MapView.Active?.Map;
        var layerName = Get(input, "layer_name");
        var layer = map?.GetLayersAsFlattenedList()
            .FirstOrDefault(l => string.Equals(l.Name, layerName, StringComparison.OrdinalIgnoreCase));

        if (layer is not FeatureLayer featureLayer)
            return Task.FromResult(ToolResult.Fail($"No feature layer named '{layerName}' found in the active map."));

        var (r, g, b) = ParseColor(Get(input, "color_name", "gray"));
        var color = CIMColor.CreateRGBColor(r, g, b);

        CIMSymbol symbol = featureLayer.ShapeType switch
        {
            esriGeometryType.esriGeometryPolygon => SymbolFactory.Instance.ConstructPolygonSymbol(color),
            esriGeometryType.esriGeometryPolyline => SymbolFactory.Instance.ConstructLineSymbol(color, 2),
            _ => SymbolFactory.Instance.ConstructPointSymbol(color, 6)
        };

        var renderer = new CIMSimpleRenderer
        {
            Symbol = symbol.MakeSymbolReference()
        };

        featureLayer.SetRenderer(renderer);
        return Task.FromResult(ToolResult.Ok($"Set '{featureLayer.Name}' to a solid {Get(input, "color_name", "gray")} symbol."));
    }

    private static (int r, int g, int b) ParseColor(string name) => name.ToLowerInvariant() switch
    {
        "red" => (230, 25, 25),
        "green" => (25, 160, 25),
        "blue" => (25, 90, 230),
        "yellow" => (240, 220, 20),
        "orange" => (240, 140, 20),
        "purple" => (150, 50, 200),
        "black" => (20, 20, 20),
        "white" => (245, 245, 245),
        _ => (120, 120, 120) // gray fallback
    };
}

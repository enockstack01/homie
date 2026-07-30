using System.Text.Json;
using ArcGIS.Desktop.Core.Geoprocessing;
using xGIS.AddIn.Logging;

namespace xGIS.AddIn.Tools;

/// <summary>
/// Every method here must be called from inside QueuedTask.Run (ToolDispatcher owns that).
/// Curated wrappers own their own positional-parameter mapping into MakeValueArray so
/// Claude never has to guess arcpy parameter order; RunGeoprocessingTool is the generic
/// escape hatch for anything not covered by a wrapper, where Claude does supply the
/// positional order itself (see ToolDefinitions for the contract described to Claude).
/// </summary>
public static class GeoprocessingTools
{
    private static async Task<ToolResult> RunAsync(string toolNameWithAlias, IEnumerable<object> orderedArgs,
        CancellationToken token)
    {
        var parameters = Geoprocessing.MakeValueArray(orderedArgs.ToArray());
        var result = await Geoprocessing.ExecuteToolAsync(
            toolNameWithAlias,
            parameters,
            environments: null,
            cancelToken: token,
            flags: GPExecuteToolFlags.GPThread);

        if (result.IsFailed)
        {
            var errors = string.Join("\n", result.ErrorMessages.Select(m => m.Text));
            return ToolResult.Fail($"{toolNameWithAlias} failed:\n{errors}");
        }

        var messages = string.Join("\n", result.Messages.Select(m => m.Text));
        return ToolResult.Ok(string.IsNullOrWhiteSpace(messages)
            ? $"{toolNameWithAlias} completed."
            : messages);
    }

    private static string Get(JsonElement input, string name, string defaultValue = "") =>
        input.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? defaultValue
            : defaultValue;

    // --- Curated wrappers: representative set, add more following this same pattern ---

    public static Task<ToolResult> Buffer(JsonElement input, CancellationToken token) => RunAsync(
        "Buffer_analysis", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Buffer_Output"),
            $"{Get(input, "distance", "100")} {Get(input, "distance_unit", "Meters")}",
            Get(input, "line_side", "FULL"),
            Get(input, "line_end_type", "ROUND"),
            Get(input, "dissolve_option", "NONE")
        }, token);

    public static Task<ToolResult> Clip(JsonElement input, CancellationToken token) => RunAsync(
        "Clip_analysis", new object[]
        {
            Get(input, "input_layer"),
            Get(input, "clip_layer"),
            Get(input, "output_name", "Clip_Output")
        }, token);

    public static Task<ToolResult> Dissolve(JsonElement input, CancellationToken token) => RunAsync(
        "Dissolve_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Dissolve_Output"),
            Get(input, "dissolve_fields", "#")
        }, token);

    public static Task<ToolResult> SelectByAttribute(JsonElement input, CancellationToken token) => RunAsync(
        "SelectLayerByAttribute_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "selection_type", "NEW_SELECTION"),
            Get(input, "where_clause")
        }, token);

    public static Task<ToolResult> Project(JsonElement input, CancellationToken token) => RunAsync(
        "Project_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Project_Output"),
            Get(input, "output_coordinate_system")
        }, token);

    public static Task<ToolResult> AddField(JsonElement input, CancellationToken token) => RunAsync(
        "AddField_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "field_name"),
            Get(input, "field_type", "TEXT")
        }, token);

    public static Task<ToolResult> CalculateField(JsonElement input, CancellationToken token) => RunAsync(
        "CalculateField_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "field_name"),
            Get(input, "expression"),
            Get(input, "expression_type", "ARCADE")
        }, token);

    public static Task<ToolResult> Merge(JsonElement input, CancellationToken token) => RunAsync(
        "Merge_management", new object[]
        {
            Get(input, "input_layers"),
            Get(input, "output_name", "Merge_Output")
        }, token);

    public static Task<ToolResult> Intersect(JsonElement input, CancellationToken token) => RunAsync(
        "Intersect_analysis", new object[]
        {
            Get(input, "input_layers"),
            Get(input, "output_name", "Intersect_Output")
        }, token);

    public static Task<ToolResult> Erase(JsonElement input, CancellationToken token) => RunAsync(
        "Erase_analysis", new object[]
        {
            Get(input, "input_layer"),
            Get(input, "erase_layer"),
            Get(input, "output_name", "Erase_Output")
        }, token);

    public static Task<ToolResult> SpatialJoin(JsonElement input, CancellationToken token) => RunAsync(
        "SpatialJoin_analysis", new object[]
        {
            Get(input, "target_layer"),
            Get(input, "join_layer"),
            Get(input, "output_name", "SpatialJoin_Output")
        }, token);

    public static Task<ToolResult> CopyFeatures(JsonElement input, CancellationToken token) => RunAsync(
        "CopyFeatures_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Copy_Output")
        }, token);

    public static Task<ToolResult> Near(JsonElement input, CancellationToken token) => RunAsync(
        "Near_analysis", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "near_layer"),
            Get(input, "search_radius", "#")
        }, token);

    public static Task<ToolResult> SummaryStatistics(JsonElement input, CancellationToken token) => RunAsync(
        "Statistics_analysis", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Statistics_Output"),
            Get(input, "statistics_fields"),
            Get(input, "case_field", "#")
        }, token);

    public static Task<ToolResult> FeatureToPoint(JsonElement input, CancellationToken token) => RunAsync(
        "FeatureToPoint_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "FeatureToPoint_Output"),
            Get(input, "point_location", "CENTROID")
        }, token);

    public static Task<ToolResult> MultipleRingBuffer(JsonElement input, CancellationToken token) => RunAsync(
        "MultipleRingBuffer_analysis", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "MultiBuffer_Output"),
            Get(input, "distances"),
            Get(input, "distance_unit", "Meters"),
            Get(input, "field_name", "distance"),
            Get(input, "dissolve_option", "ALL")
        }, token);

    public static Task<ToolResult> Union(JsonElement input, CancellationToken token) => RunAsync(
        "Union_analysis", new object[]
        {
            Get(input, "input_layers"),
            Get(input, "output_name", "Union_Output")
        }, token);

    public static Task<ToolResult> FeatureVerticesToPoints(JsonElement input, CancellationToken token) => RunAsync(
        "FeatureVerticesToPoints_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Vertices_Output"),
            Get(input, "point_location", "ALL")
        }, token);

    public static Task<ToolResult> PointsToLine(JsonElement input, CancellationToken token) => RunAsync(
        "PointsToLine_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "PointsToLine_Output"),
            Get(input, "line_field", "#"),
            Get(input, "sort_field", "#")
        }, token);

    public static Task<ToolResult> XyTableToPoint(JsonElement input, CancellationToken token) => RunAsync(
        "XYTableToPoint_management", new object[]
        {
            Get(input, "table_name"),
            Get(input, "output_name", "XYPoints_Output"),
            Get(input, "x_field"),
            Get(input, "y_field"),
            Get(input, "z_field", "#"),
            Get(input, "coordinate_system", "#")
        }, token);

    public static Task<ToolResult> SortFeatures(JsonElement input, CancellationToken token) => RunAsync(
        "Sort_management", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Sort_Output"),
            Get(input, "sort_field")
        }, token);

    public static Task<ToolResult> Frequency(JsonElement input, CancellationToken token) => RunAsync(
        "Frequency_analysis", new object[]
        {
            Get(input, "layer_name"),
            Get(input, "output_name", "Frequency_Output"),
            Get(input, "frequency_fields")
        }, token);

    /// <summary>
    /// Generic escape hatch: Claude supplies the tool name (with toolbox alias, e.g.
    /// "CopyFeatures_management") and positional string parameters in the same order as
    /// the tool's arcpy signature. Failures return the GP engine's own error text
    /// verbatim so Claude can self-correct parameter order on the next turn.
    /// </summary>
    public static Task<ToolResult> RunGeoprocessingTool(JsonElement input, CancellationToken token)
    {
        var toolName = Get(input, "tool_name_with_alias");
        var parameters = input.TryGetProperty("parameters", out var p) && p.ValueKind == JsonValueKind.Array
            ? p.EnumerateArray().Select(e => (object)(e.GetString() ?? string.Empty))
            : Enumerable.Empty<object>();

        return RunAsync(toolName, parameters, token);
    }
}

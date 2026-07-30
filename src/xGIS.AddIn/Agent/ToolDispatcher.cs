using System.Text.Json;
using ArcGIS.Desktop.Framework.Threading.Tasks;
using xGIS.AddIn.Logging;
using xGIS.AddIn.Tools;

namespace xGIS.AddIn.Agent;

/// <summary>
/// Routes a tool_use block to the C# method that implements it, wrapped in QueuedTask.Run
/// so every call - geoprocessing and mapping alike - runs on ArcGIS Pro's CIM/MCT thread.
/// One QueuedTask.Run per call (not batched per turn) keeps cancellation and error
/// handling atomic and simple.
///
/// The routing table itself (<see cref="KnownToolNames"/>) is plain data with no ArcGIS
/// Pro dependency, specifically so a test can assert it stays in sync with
/// ToolDefinitions.All without needing a live Pro host process to do it - Execute (and
/// every handler it calls) does need one, and can't be exercised outside ArcGIS Pro at all.
/// </summary>
public static class ToolDispatcher
{
    private static readonly Dictionary<string, Func<JsonElement, CancellationToken, Task<ToolResult>>> Handlers = new()
    {
        ["list_layers"] = LayerTools.ListLayers,
        ["describe_layer"] = LayerTools.DescribeLayer,
        ["get_map_info"] = MapViewTools.GetMapInfo,
        ["add_layer"] = LayerTools.AddLayer,
        ["zoom_to_layer"] = MapViewTools.ZoomToLayer,
        ["set_solid_color"] = SymbologyTools.SetSolidColor,

        ["buffer_layer"] = GeoprocessingTools.Buffer,
        ["clip_layer"] = GeoprocessingTools.Clip,
        ["dissolve_layer"] = GeoprocessingTools.Dissolve,
        ["select_by_attribute"] = GeoprocessingTools.SelectByAttribute,
        ["project_layer"] = GeoprocessingTools.Project,
        ["add_field"] = GeoprocessingTools.AddField,
        ["calculate_field"] = GeoprocessingTools.CalculateField,
        ["merge_layers"] = GeoprocessingTools.Merge,
        ["intersect_layers"] = GeoprocessingTools.Intersect,
        ["erase_layer"] = GeoprocessingTools.Erase,
        ["spatial_join"] = GeoprocessingTools.SpatialJoin,
        ["copy_features"] = GeoprocessingTools.CopyFeatures,
        ["near_layer"] = GeoprocessingTools.Near,
        ["summary_statistics"] = GeoprocessingTools.SummaryStatistics,
        ["feature_to_point"] = GeoprocessingTools.FeatureToPoint,
        ["multiple_ring_buffer"] = GeoprocessingTools.MultipleRingBuffer,
        ["union_layers"] = GeoprocessingTools.Union,
        ["feature_vertices_to_points"] = GeoprocessingTools.FeatureVerticesToPoints,
        ["points_to_line"] = GeoprocessingTools.PointsToLine,
        ["xy_table_to_point"] = GeoprocessingTools.XyTableToPoint,
        ["sort_features"] = GeoprocessingTools.SortFeatures,
        ["frequency"] = GeoprocessingTools.Frequency,
        ["run_geoprocessing_tool"] = GeoprocessingTools.RunGeoprocessingTool,
    };

    /// <summary>Every tool name this dispatcher can route - should exactly match
    /// ToolDefinitions.All's names (see xGIS.AddIn.Tests.ToolDispatcherTests).</summary>
    public static IReadOnlyCollection<string> KnownToolNames => Handlers.Keys;

    public static Task<ToolResult> Execute(string toolName, JsonElement input, CancellationToken token) =>
        QueuedTask.Run(() => ExecuteOnMctThread(toolName, input, token));

    private static Task<ToolResult> ExecuteOnMctThread(string toolName, JsonElement input, CancellationToken token) =>
        Handlers.TryGetValue(toolName, out var handler)
            ? handler(input, token)
            : Task.FromResult(ToolResult.Fail($"Unknown tool '{toolName}'."));
}

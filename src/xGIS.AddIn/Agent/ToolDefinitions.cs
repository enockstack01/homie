using System.Text.Json;

namespace xGIS.AddIn.Agent;

/// <summary>
/// Builds the tools[] sent to the xGIS backend gateway on every turn (which forwards them
/// to Claude as-is). Each entry pairs a JSON schema (what Claude sees) with a name that
/// ToolDispatcher switches on to find the C# method that actually executes it (see
/// ToolDispatcher.Execute). Plain JsonElement, not an Anthropic-SDK-typed Tool object -
/// this side of the gateway has no Anthropic SDK dependency at all (see
/// Agent/ClaudeAgentService.cs).
/// </summary>
public static class ToolDefinitions
{
    public static IReadOnlyList<JsonElement> All { get; } = BuildAll();

    private static List<JsonElement> BuildAll() => new()
    {
        // --- Grounding (read-only) ---
        BuildTool("list_layers",
            "List every layer in the active map, with its type. Call this before acting on a layer name you are not certain exists.",
            """{"type":"object","properties":{}}"""),

        BuildTool("describe_layer",
            "Describe a feature layer: its fields, geometry type, and spatial reference. Use this to check field names before building a where_clause or expression.",
            """{"type":"object","properties":{"layer_name":{"type":"string"}},"required":["layer_name"]}"""),

        BuildTool("get_map_info",
            "Get the active map's name, spatial reference, current view extent, and layer count.",
            """{"type":"object","properties":{}}"""),

        // --- Mapping ---
        BuildTool("add_layer",
            "Add a layer to the active map from a local file path or a service URL.",
            """{"type":"object","properties":{"path_or_url":{"type":"string"}},"required":["path_or_url"]}"""),

        BuildTool("zoom_to_layer",
            "Zoom the active map view to the full extent of a layer.",
            """{"type":"object","properties":{"layer_name":{"type":"string"}},"required":["layer_name"]}"""),

        BuildTool("set_solid_color",
            "Set a feature layer's symbology to a single solid color. Only for simple single-symbol styling; for classified/graduated symbology use run_geoprocessing_tool instead.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"color_name":{"type":"string","description":"e.g. red, green, blue, yellow, orange, purple, black, white, gray"}},"required":["layer_name","color_name"]}"""),

        // --- Curated geoprocessing wrappers (own their positional parameter order) ---
        BuildTool("buffer_layer",
            "Buffer a feature layer by a distance and add the result as a new layer.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"distance":{"type":"string"},"distance_unit":{"type":"string","description":"Meters, Feet, Kilometers, Miles, etc."},"dissolve_option":{"type":"string","description":"NONE, ALL, or LIST"},"output_name":{"type":"string"}},"required":["layer_name","distance"]}"""),

        BuildTool("clip_layer",
            "Clip one feature layer by the boundary of another and add the result as a new layer.",
            """{"type":"object","properties":{"input_layer":{"type":"string"},"clip_layer":{"type":"string"},"output_name":{"type":"string"}},"required":["input_layer","clip_layer"]}"""),

        BuildTool("dissolve_layer",
            "Dissolve a feature layer's boundaries, optionally on shared field values.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"dissolve_fields":{"type":"string","description":"Comma-separated field names, or omit to dissolve everything into one feature."},"output_name":{"type":"string"}},"required":["layer_name"]}"""),

        BuildTool("select_by_attribute",
            "Select features in a layer matching a SQL where_clause.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"where_clause":{"type":"string"},"selection_type":{"type":"string","description":"NEW_SELECTION, ADD_TO_SELECTION, REMOVE_FROM_SELECTION, etc."}},"required":["layer_name","where_clause"]}"""),

        BuildTool("project_layer",
            "Reproject a feature layer into a different coordinate system and add the result as a new layer.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"output_coordinate_system":{"type":"string"},"output_name":{"type":"string"}},"required":["layer_name","output_coordinate_system"]}"""),

        BuildTool("add_field",
            "Add a new field to a feature layer's attribute table.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"field_name":{"type":"string"},"field_type":{"type":"string","description":"TEXT, SHORT, LONG, FLOAT, DOUBLE, DATE, etc."}},"required":["layer_name","field_name"]}"""),

        BuildTool("calculate_field",
            "Populate a field using an Arcade (or Python) expression.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"field_name":{"type":"string"},"expression":{"type":"string"},"expression_type":{"type":"string","description":"ARCADE or PYTHON3"}},"required":["layer_name","field_name","expression"]}"""),

        BuildTool("merge_layers",
            "Merge several feature layers into one new output layer.",
            """{"type":"object","properties":{"input_layers":{"type":"string","description":"Semicolon-separated layer names."},"output_name":{"type":"string"}},"required":["input_layers"]}"""),

        BuildTool("intersect_layers",
            "Compute the geometric intersection of two or more layers.",
            """{"type":"object","properties":{"input_layers":{"type":"string","description":"Semicolon-separated layer names."},"output_name":{"type":"string"}},"required":["input_layers"]}"""),

        BuildTool("erase_layer",
            "Remove areas of an input layer that overlap an erase layer.",
            """{"type":"object","properties":{"input_layer":{"type":"string"},"erase_layer":{"type":"string"},"output_name":{"type":"string"}},"required":["input_layer","erase_layer"]}"""),

        BuildTool("spatial_join",
            "Join attributes from one layer to another based on spatial relationship.",
            """{"type":"object","properties":{"target_layer":{"type":"string"},"join_layer":{"type":"string"},"output_name":{"type":"string"}},"required":["target_layer","join_layer"]}"""),

        BuildTool("copy_features",
            "Copy a feature layer to a new output layer/dataset.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"output_name":{"type":"string"}},"required":["layer_name","output_name"]}"""),

        BuildTool("near_layer",
            "For each feature in a layer, compute the distance to the nearest feature in another layer and add NEAR_FID/NEAR_DIST fields.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"near_layer":{"type":"string"},"search_radius":{"type":"string","description":"e.g. '5000 Meters', or omit for unlimited."}},"required":["layer_name","near_layer"]}"""),

        BuildTool("summary_statistics",
            "Compute summary statistics (sum, mean, count, etc.) for a layer's fields, optionally grouped by a case field.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"statistics_fields":{"type":"string","description":"e.g. 'population SUM;area MEAN'"},"case_field":{"type":"string"},"output_name":{"type":"string"}},"required":["layer_name","statistics_fields"]}"""),

        BuildTool("feature_to_point",
            "Convert each feature in a layer to a representative point (centroid or inside the polygon).",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"point_location":{"type":"string","description":"CENTROID or INSIDE"},"output_name":{"type":"string"}},"required":["layer_name"]}"""),

        BuildTool("multiple_ring_buffer",
            "Create multiple concentric buffer rings around a layer at several distances.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"distances":{"type":"string","description":"Semicolon-separated numbers, e.g. '100;200;500'"},"distance_unit":{"type":"string"},"field_name":{"type":"string"},"dissolve_option":{"type":"string","description":"ALL or NONE"},"output_name":{"type":"string"}},"required":["layer_name","distances"]}"""),

        BuildTool("union_layers",
            "Compute the geometric union of two or more polygon layers, keeping all attributes.",
            """{"type":"object","properties":{"input_layers":{"type":"string","description":"Semicolon-separated layer names."},"output_name":{"type":"string"}},"required":["input_layers"]}"""),

        BuildTool("feature_vertices_to_points",
            "Extract vertex points (all, start, end, mid, etc.) from line or polygon features.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"point_location":{"type":"string","description":"ALL, START, END, MID, etc."},"output_name":{"type":"string"}},"required":["layer_name"]}"""),

        BuildTool("points_to_line",
            "Build lines connecting a sequence of points, optionally grouped and ordered by fields.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"line_field":{"type":"string","description":"Field grouping points into separate lines, or omit for one line."},"sort_field":{"type":"string"},"output_name":{"type":"string"}},"required":["layer_name"]}"""),

        BuildTool("xy_table_to_point",
            "Create point features from a table with X/Y (and optionally Z) coordinate fields.",
            """{"type":"object","properties":{"table_name":{"type":"string"},"x_field":{"type":"string"},"y_field":{"type":"string"},"z_field":{"type":"string"},"coordinate_system":{"type":"string"},"output_name":{"type":"string"}},"required":["table_name","x_field","y_field"]}"""),

        BuildTool("sort_features",
            "Sort a layer's features by one or more fields into a new output.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"sort_field":{"type":"string","description":"e.g. 'population DESCENDING'"},"output_name":{"type":"string"}},"required":["layer_name","sort_field"]}"""),

        BuildTool("frequency",
            "Count how often unique field-value combinations occur in a layer or table.",
            """{"type":"object","properties":{"layer_name":{"type":"string"},"frequency_fields":{"type":"string","description":"Semicolon-separated field names."},"output_name":{"type":"string"}},"required":["layer_name","frequency_fields"]}"""),

        // --- Generic escape hatch ---
        BuildTool("run_geoprocessing_tool",
            "Run any ArcGIS geoprocessing tool by name for requests not covered by a more specific tool above. tool_name_with_alias must include the toolbox alias (e.g. 'CopyFeatures_management', 'Buffer_analysis'). parameters must be positional strings in the exact order of that tool's arcpy signature; trailing optional parameters may be omitted.",
            """{"type":"object","properties":{"tool_name_with_alias":{"type":"string"},"parameters":{"type":"array","items":{"type":"string"}}},"required":["tool_name_with_alias","parameters"]}"""),
    };

    private static JsonElement BuildTool(string name, string description, string schemaJson)
    {
        var json = $$"""
            {
                "name": {{JsonSerializer.Serialize(name)}},
                "description": {{JsonSerializer.Serialize(description)}},
                "input_schema": {{schemaJson}}
            }
            """;
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}

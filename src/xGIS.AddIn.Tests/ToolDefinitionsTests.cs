using System.Text.Json;
using xGIS.AddIn.Agent;
using Xunit;

namespace xGIS.AddIn.Tests;

public class ToolDefinitionsTests
{
    private static string Name(JsonElement tool) => tool.GetProperty("name").GetString()!;

    [Fact]
    public void All_HasNoDuplicateToolNames()
    {
        var names = ToolDefinitions.All.Select(Name).ToList();
        Assert.Equal(names.Distinct().Count(), names.Count);
    }

    [Fact]
    public void All_IncludesTheGenericEscapeHatch()
    {
        Assert.Contains(ToolDefinitions.All, t => Name(t) == "run_geoprocessing_tool");
    }

    [Fact]
    public void All_EveryToolHasANonEmptyDescription()
    {
        Assert.All(ToolDefinitions.All, t =>
            Assert.False(string.IsNullOrWhiteSpace(t.GetProperty("description").GetString())));
    }

    [Fact]
    public void All_EverySchemaIsAWellFormedObjectSchema()
    {
        Assert.All(ToolDefinitions.All, t =>
        {
            var schema = t.GetProperty("input_schema");
            Assert.Equal(JsonValueKind.Object, schema.ValueKind);
            Assert.Equal("object", schema.GetProperty("type").GetString());
            Assert.Equal(JsonValueKind.Object, schema.GetProperty("properties").ValueKind);
        });
    }

    [Fact]
    public void All_RunGeoprocessingTool_RequiresNameAndParameters()
    {
        var tool = ToolDefinitions.All.Single(t => Name(t) == "run_geoprocessing_tool");
        var required = tool.GetProperty("input_schema").GetProperty("required")
            .EnumerateArray().Select(e => e.GetString()).ToList();

        Assert.Contains("tool_name_with_alias", required);
        Assert.Contains("parameters", required);
    }
}

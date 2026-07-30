using System.Text.Json;
using xGIS.AddIn.Agent;
using Xunit;

namespace xGIS.AddIn.Tests;

/// <summary>
/// ToolDispatcher.Execute itself can't be exercised here - it wraps every call in
/// QueuedTask.Run and the handlers it calls touch live ArcGIS Pro CIM/map APIs, none of
/// which exist outside a running Pro host process. What IS safely testable, and just as
/// important to catch in CI, is that the set of tool names the dispatcher knows how to
/// route stays exactly in sync with the set of tool names advertised to Claude via
/// ToolDefinitions.All - a tool added to one but not the other is a real bug (Claude either
/// calls something that 404s as "Unknown tool", or a wired-up tool Claude can never reach).
/// </summary>
public class ToolDispatcherTests
{
    private static string Name(JsonElement tool) => tool.GetProperty("name").GetString()!;

    [Fact]
    public void KnownToolNames_ExactlyMatchesToolDefinitions()
    {
        var defined = ToolDefinitions.All.Select(Name).ToHashSet();
        var dispatched = ToolDispatcher.KnownToolNames.ToHashSet();

        var definedButNotDispatched = defined.Except(dispatched).ToList();
        var dispatchedButNotDefined = dispatched.Except(defined).ToList();

        Assert.True(definedButNotDispatched.Count == 0,
            $"Tool(s) advertised to Claude but not routed by ToolDispatcher: {string.Join(", ", definedButNotDispatched)}");
        Assert.True(dispatchedButNotDefined.Count == 0,
            $"Tool(s) routed by ToolDispatcher but never advertised to Claude: {string.Join(", ", dispatchedButNotDefined)}");
    }

    [Fact]
    public void KnownToolNames_HasNoDuplicates()
    {
        var names = ToolDispatcher.KnownToolNames.ToList();
        Assert.Equal(names.Distinct().Count(), names.Count);
    }
}

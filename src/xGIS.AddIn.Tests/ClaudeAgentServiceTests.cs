using xGIS.AddIn.Agent;
using xGIS.AddIn.Chat;
using Xunit;

namespace xGIS.AddIn.Tests;

/// <summary>
/// Covers BuildRequestMessages - the one piece of ClaudeAgentService with no ArcGIS Pro
/// or network dependency (RunTurnAsync itself needs a live HttpClient call to the backend
/// gateway and ToolDispatcher's QueuedTask.Run, neither reachable from a plain xUnit test).
/// See its own doc comment (and docs/ARCHITECTURE.md's "Known simplifications") for why it
/// intentionally only replays plain text across turns, not raw tool_use/tool_result blocks.
/// </summary>
public class ClaudeAgentServiceTests
{
    private static dynamic Msg(object m) => m;

    [Fact]
    public void BuildRequestMessages_IncludesUserAndAssistantTurnsInOrder()
    {
        var history = new List<ChatMessage>
        {
            ChatMessage.User("buffer the roads layer"),
            ChatMessage.Assistant("Buffered roads_layer by 500 meters."),
            ChatMessage.User("now clip it to the county boundary"),
        };

        var result = ClaudeAgentService.BuildRequestMessages(history);

        Assert.Equal(3, result.Count);
        Assert.Equal("user", Msg(result[0]).role);
        Assert.Equal("buffer the roads layer", Msg(result[0]).content);
        Assert.Equal("assistant", Msg(result[1]).role);
        Assert.Equal("Buffered roads_layer by 500 meters.", Msg(result[1]).content);
        Assert.Equal("user", Msg(result[2]).role);
        Assert.Equal("now clip it to the county boundary", Msg(result[2]).content);
    }

    [Fact]
    public void BuildRequestMessages_ExcludesStatusAndErrorRows()
    {
        var history = new List<ChatMessage>
        {
            ChatMessage.User("zoom to the roads layer"),
            ChatMessage.Status("Running zoom_to_layer..."),
            ChatMessage.Assistant("Zoomed to roads_layer."),
            ChatMessage.Error("xGIS backend request failed (500): boom"),
        };

        var result = ClaudeAgentService.BuildRequestMessages(history);

        Assert.Equal(2, result.Count);
        Assert.Equal("user", Msg(result[0]).role);
        Assert.Equal("assistant", Msg(result[1]).role);
    }

    [Fact]
    public void BuildRequestMessages_EmptyHistoryProducesEmptyList()
    {
        var result = ClaudeAgentService.BuildRequestMessages(new List<ChatMessage>());
        Assert.Empty(result);
    }
}

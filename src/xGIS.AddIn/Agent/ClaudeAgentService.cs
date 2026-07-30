using System.Collections.ObjectModel;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using xGIS.AddIn.Chat;
using xGIS.AddIn.Config;
using xGIS.AddIn.Logging;
using xGIS.AddIn.Tools;

namespace xGIS.AddIn.Agent;

/// <summary>Implemented by ChatDockpaneViewModel; lets the agent ask for a destructive-op confirmation without knowing about WPF.</summary>
public interface IConfirmationPrompt
{
    Task<bool> ConfirmOnUiThreadAsync(string summary);
}

/// <summary>
/// Runs the agentic tool-use loop against the xGIS backend gateway (see
/// ../../../backend/app/routes/chat.py) instead of calling Anthropic directly - the
/// gateway holds the only real Anthropic API key, meters usage against the signed-in
/// user's credit balance, and returns Anthropic's own Message shape verbatim, so this
/// loop's logic (parse content blocks, dispatch tool_use, feed tool_result back) is the
/// same shape it would be calling Anthropic directly, just over HTTP with our own Bearer
/// token instead of the Anthropic SDK. Built on plain HttpClient + System.Text.Json
/// rather than the Anthropic C# SDK - there's no SDK on this side of the gateway to speak
/// of, and it removes the SDK's own conflicting-dependency-version problem that
/// AssemblyResolution.cs used to work around (no longer needed - see that file's history
/// in git if this ever needs revisiting).
/// </summary>
public sealed class ClaudeAgentService
{
    private const int MaxToolIterations = 25;
    private const int MaxTokens = 8000;

    private const string SystemPrompt = """
        You are xGIS, an assistant embedded in ArcGIS Pro that carries out GIS
        requests by calling tools that act on the user's currently open map and
        project. Prefer the specific tools (buffer_layer, clip_layer, etc.) over
        run_geoprocessing_tool when one fits. Use list_layers/describe_layer first
        whenever a layer name or field name in the request is not already known
        exactly - never guess an identifier. If a tool call fails, read the error
        message it returns and correct the parameters rather than repeating the
        same call. Keep replies to the user brief and concrete: state what you did
        and where the output landed.
        """;

    private static readonly HttpClient s_http = new();

    private readonly SettingsViewModel _settings;
    private readonly AuditLogger _auditLogger;
    private readonly IConfirmationPrompt _confirmation;
    private readonly string _apiKey;

    public ClaudeAgentService(SettingsViewModel settings, AuditLogger auditLogger, IConfirmationPrompt confirmation)
    {
        _settings = settings;
        _auditLogger = auditLogger;
        _confirmation = confirmation;

        _apiKey = CredentialStore.GetApiKey()
            ?? throw new InvalidOperationException(
                "No xGIS API key found. Set it in xGIS Settings before starting a chat.");
    }

    public async Task RunTurnAsync(string userText, ObservableCollection<ChatMessage> history, CancellationToken token)
    {
        history.Add(ChatMessage.User(userText));
        var messages = BuildRequestMessages(history);

        for (var i = 0; i < MaxToolIterations; i++)
        {
            token.ThrowIfCancellationRequested();

            JsonElement message;
            decimal remainingCredits;
            try
            {
                // No model_id here - the backend gateway derives which model to bill/call
                // from the signed-in account's own preference (chosen in the Homie
                // dashboard), never from anything this Add-in sends. See
                // backend/app/routes/chat.py's handle_chat_request.
                var requestBody = new
                {
                    messages,
                    system = SystemPrompt,
                    tools = ToolDefinitions.All,
                    max_tokens = MaxTokens,
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, CombineUrl(_settings.BackendBaseUrl, "/v1/chat"))
                {
                    Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json"),
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

                using var httpResponse = await s_http.SendAsync(request, token);
                var responseBody = await httpResponse.Content.ReadAsStringAsync(token);

                if (!httpResponse.IsSuccessStatusCode)
                {
                    history.Add(ChatMessage.Error($"xGIS backend request failed ({(int)httpResponse.StatusCode}): {responseBody}"));
                    return;
                }

                using var doc = JsonDocument.Parse(responseBody);
                message = doc.RootElement.GetProperty("message").Clone();
                remainingCredits = doc.RootElement.GetProperty("remaining_credits").GetDecimal();
            }
            catch (Exception ex)
            {
                history.Add(ChatMessage.Error($"xGIS backend request failed: {ex.Message}"));
                return;
            }

            var assistantContent = message.GetProperty("content");
            messages.Add(new { role = "assistant", content = assistantContent });

            foreach (var block in assistantContent.EnumerateArray())
            {
                if (block.GetProperty("type").GetString() == "text")
                {
                    var text = block.GetProperty("text").GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                        history.Add(ChatMessage.Assistant(text));
                }
            }

            var stopReason = message.GetProperty("stop_reason").GetString();
            if (stopReason != "tool_use")
            {
                history.Add(ChatMessage.Status($"{remainingCredits:N2} credits remaining."));
                return;
            }

            var toolResults = new List<object>();

            foreach (var block in assistantContent.EnumerateArray())
            {
                if (block.GetProperty("type").GetString() != "tool_use")
                    continue;

                token.ThrowIfCancellationRequested();

                var toolUseId = block.GetProperty("id").GetString()!;
                var toolName = block.GetProperty("name").GetString()!;
                var input = block.GetProperty("input").Clone();

                if (ToolSafety.RequiresConfirmation(toolName, input, out var summary))
                {
                    var allowed = await _confirmation.ConfirmOnUiThreadAsync(summary);
                    if (!allowed)
                    {
                        toolResults.Add(ToolResultPayload(toolUseId, "User denied this operation.", isError: true));
                        continue;
                    }
                }

                history.Add(ChatMessage.Status($"Running {toolName}..."));

                ToolResult result;
                try
                {
                    result = await ToolDispatcher.Execute(toolName, input, token);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    result = ToolResult.Fail($"{toolName} threw an exception: {ex.Message}");
                }

                _auditLogger.Log(toolName, input.GetRawText(), result);
                toolResults.Add(ToolResultPayload(toolUseId, result.OutputText, isError: !result.Success));
            }

            messages.Add(new { role = "user", content = toolResults });
        }

        history.Add(ChatMessage.Status("Stopped after reaching the tool-call limit for this turn."));
    }

    private static object ToolResultPayload(string toolUseId, string text, bool isError) => new
    {
        type = "tool_result",
        tool_use_id = toolUseId,
        content = text,
        is_error = isError,
    };

    private static string CombineUrl(string baseUrl, string path) => baseUrl.TrimEnd('/') + path;

    /// <summary>
    /// Rebuilds the API message list from the visible transcript; Status/Error rows are
    /// UI-only and never sent to Claude. Note: this intentionally only replays plain text
    /// across turn boundaries, not prior turns' tool_use/tool_result blocks - relying on
    /// list_layers/describe_layer for Claude to re-ground itself on a follow-up request
    /// rather than carrying full API-shape history between separate RunTurnAsync calls.
    /// Revisit if follow-ups start needing exact recall of a prior tool's raw output.
    ///
    /// internal (not private) so xGIS.AddIn.Tests can exercise this directly - it's pure
    /// LINQ over ChatMessage with no ArcGIS Pro dependency, unlike RunTurnAsync itself
    /// (HttpClient + ToolDispatcher's QueuedTask.Run, both of which need a live Pro host).
    /// </summary>
    internal static List<object> BuildRequestMessages(IEnumerable<ChatMessage> history) => history
        .Where(m => m.Role is ChatRole.User or ChatRole.Assistant)
        .Select(m => (object)new { role = m.Role == ChatRole.User ? "user" : "assistant", content = m.Text })
        .ToList();
}

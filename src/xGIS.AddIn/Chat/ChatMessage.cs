namespace xGIS.AddIn.Chat;

public enum ChatRole
{
    User,
    Assistant,
    Status,
    Error
}

/// <summary>
/// A single line in the dockpane transcript. Status/Error entries are UI-only
/// (tool progress, denials, GP failures) and are never sent back to Claude -
/// only User/Assistant turns feed the Messages array in ClaudeAgentService.
/// </summary>
public sealed class ChatMessage
{
    public required ChatRole Role { get; init; }
    public required string Text { get; init; }
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.Now;

    public static ChatMessage User(string text) => new() { Role = ChatRole.User, Text = text };
    public static ChatMessage Assistant(string text) => new() { Role = ChatRole.Assistant, Text = text };
    public static ChatMessage Status(string text) => new() { Role = ChatRole.Status, Text = text };
    public static ChatMessage Error(string text) => new() { Role = ChatRole.Error, Text = text };
}

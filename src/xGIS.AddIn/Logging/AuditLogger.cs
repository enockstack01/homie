using System.IO;
using System.Text.Json;

namespace xGIS.AddIn.Logging;

/// <summary>
/// Append-only JSONL record of every tool call xGIS executes: what Claude asked for,
/// what actually ran, and what came back. This is the safety net for a "broad,
/// best-effort" agent that can call arbitrary geoprocessing tools - not a dry-run
/// engine, just an honest record a user can audit or use to manually undo something.
/// </summary>
public sealed class AuditLogger
{
    private static readonly string LogDirectory =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "xGIS", "logs");

    private readonly object _writeLock = new();
    private readonly string _logFilePath;

    public AuditLogger()
    {
        Directory.CreateDirectory(LogDirectory);
        _logFilePath = Path.Combine(LogDirectory, $"xgis-{DateTime.Now:yyyy-MM-dd}.jsonl");
    }

    public void Log(string toolName, string inputJson, ToolResult result)
    {
        var entry = new AuditEntry(
            Timestamp: DateTimeOffset.Now,
            ToolName: toolName,
            InputJson: inputJson,
            Success: result.Success,
            OutputText: result.OutputText);

        var line = JsonSerializer.Serialize(entry);

        lock (_writeLock)
        {
            File.AppendAllText(_logFilePath, line + Environment.NewLine);
        }
    }

    private sealed record AuditEntry(
        DateTimeOffset Timestamp,
        string ToolName,
        string InputJson,
        bool Success,
        string OutputText);
}

/// <summary>Outcome of executing a single tool call, ready to become a Claude tool_result.</summary>
public sealed record ToolResult(bool Success, string OutputText)
{
    public static ToolResult Ok(string text) => new(true, text);
    public static ToolResult Fail(string text) => new(false, text);
}

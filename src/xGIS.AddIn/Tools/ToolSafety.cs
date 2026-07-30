using System.Text.Json;
using ArcGIS.Desktop.Core;
using ArcGIS.Desktop.Mapping;

namespace xGIS.AddIn.Tools;

/// <summary>
/// Gate, not a whitelist: every geoprocessing/mapping tool Claude names is allowed to run.
/// This only decides two things - (a) does an output path resolve outside the sandboxed
/// workspaces, and (b) does the tool name look destructive - either of which requires an
/// explicit user Allow before ToolDispatcher executes it.
/// </summary>
public static class ToolSafety
{
    private static readonly string[] DestructivePrefixes =
    {
        "Delete", "Overwrite", "Truncate", "Remove", "Drop", "Erase"
    };

    /// <summary>Tool base name without its toolbox alias, e.g. "CopyFeatures_management" -> "CopyFeatures".</summary>
    internal static string BaseName(string toolNameWithAlias)
    {
        var underscoreIndex = toolNameWithAlias.IndexOf('_');
        return underscoreIndex > 0 ? toolNameWithAlias[..underscoreIndex] : toolNameWithAlias;
    }

    internal static bool LooksDestructive(string toolNameWithAlias)
    {
        var baseName = BaseName(toolNameWithAlias);
        return DestructivePrefixes.Any(prefix =>
            baseName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Best-effort scan of a tool's JSON input for anything that looks like an output path,
    /// checked against the project's sandboxed workspaces. Call only on the MCT thread -
    /// it reads Project.Current and the active map's layers.
    /// </summary>
    private static bool WritesOutsideSandbox(JsonElement input)
    {
        var allowed = SandboxWorkspaces();

        foreach (var property in EnumeratePathLikeValues(input))
        {
            if (IsScratchOrMemoryPath(property))
                continue;

            var fullPath = TryResolveFullPath(property);
            if (fullPath is null)
                continue;

            if (!allowed.Any(root => fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase)))
                return true;
        }

        return false;
    }

    /// <summary>
    /// Defensive try/catch here is deliberate, not speculative: this must never take down
    /// the confirmation-gate check just because it ran before a project/map was fully
    /// loaded (or, for xGIS.AddIn.Tests, outside the ArcGIS Pro host process entirely).
    /// An empty sandbox list is the safe failure mode - it just means every output path
    /// trips the confirmation gate instead of silently trusting an unknown project state.
    /// </summary>
    private static List<string> SandboxWorkspaces()
    {
        var roots = new List<string>();

        try
        {
            if (Project.Current is { } project)
            {
                if (!string.IsNullOrEmpty(project.HomeFolderPath))
                    roots.Add(project.HomeFolderPath);
                if (!string.IsNullOrEmpty(project.DefaultGeodatabasePath))
                    roots.Add(project.DefaultGeodatabasePath);
            }

            if (MapView.Active?.Map is { } map)
            {
                foreach (var layer in map.GetLayersAsFlattenedList().OfType<Layer>())
                {
                    var path = layer.GetPath()?.LocalPath;
                    if (!string.IsNullOrEmpty(path))
                        roots.Add(System.IO.Path.GetDirectoryName(path) ?? path);
                }
            }
        }
        catch
        {
            // Host not ready / not running - fall through with whatever roots we already have.
        }

        return roots;
    }

    private static IEnumerable<string> EnumeratePathLikeValues(JsonElement input)
    {
        if (input.ValueKind != JsonValueKind.Object)
            yield break;

        foreach (var property in input.EnumerateObject())
        {
            if (property.Value.ValueKind != JsonValueKind.String)
                continue;

            var value = property.Value.GetString();
            if (string.IsNullOrEmpty(value))
                continue;

            var nameLooksLikePath = property.Name.Contains("output", StringComparison.OrdinalIgnoreCase)
                                     || property.Name.Contains("path", StringComparison.OrdinalIgnoreCase)
                                     || property.Name.Contains("workspace", StringComparison.OrdinalIgnoreCase);

            if (nameLooksLikePath || value.Contains('\\') || value.Contains('/'))
                yield return value;
        }
    }

    private static bool IsScratchOrMemoryPath(string value) =>
        value.StartsWith("in_memory", StringComparison.OrdinalIgnoreCase) ||
        value.StartsWith("memory\\", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("scratch", StringComparison.OrdinalIgnoreCase);

    private static string? TryResolveFullPath(string value)
    {
        try
        {
            return System.IO.Path.GetFullPath(value);
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    /// <summary>
    /// Call before dispatching any tool. When this returns true, ClaudeAgentService must
    /// show the confirmation modal and only proceed if the user allows it.
    /// </summary>
    public static bool RequiresConfirmation(string toolNameWithAlias, JsonElement input, out string summary)
    {
        var destructive = LooksDestructive(toolNameWithAlias);
        var outsideSandbox = WritesOutsideSandbox(input);

        if (destructive || outsideSandbox)
        {
            var reason = destructive && outsideSandbox
                ? "looks destructive and writes outside the project's default locations"
                : destructive
                    ? "looks destructive"
                    : "writes outside the project's default locations";

            summary = $"{toolNameWithAlias} {reason}.\nParameters: {input}";
            return true;
        }

        summary = string.Empty;
        return false;
    }
}

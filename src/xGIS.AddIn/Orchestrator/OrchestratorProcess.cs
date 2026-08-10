using System.Diagnostics;
using System.IO;
using System.Net.Http;

namespace xGIS.AddIn.Orchestrator;

/// <summary>
/// Manages the xcrop-orchestrator.exe subprocess the crop-suitability tools depend on -
/// the same compiled, self-contained binary the xcrop desktop app ships (see
/// ../../../xcrop/orchestrator/build.ps1), reused here rather than re-implementing crop
/// profiles, suitability scoring, and the elevation/climate connectors a second time in
/// C#. Runs on its own port (8757), distinct from xcrop desktop's own instance (8756), so
/// both can be open at once without one's orchestrator refusing to bind the other's port.
/// </summary>
public sealed class OrchestratorProcess : IDisposable
{
    public const int Port = 8757;

    private static readonly HttpClient s_http = new() { Timeout = TimeSpan.FromSeconds(5) };

    private readonly object _lock = new();
    private Process? _process;

    public bool IsRunning
    {
        get
        {
            lock (_lock)
            {
                return _process is { HasExited: false };
            }
        }
    }

    /// <summary>
    /// Starts the orchestrator if it isn't already running, and waits until it answers
    /// healthy. Safe to call before every tool invocation - a fast no-op once it's already
    /// up, so callers don't need to track startup state themselves.
    /// </summary>
    public async Task EnsureRunningAsync(CancellationToken token)
    {
        lock (_lock)
        {
            if (!IsRunning)
                _process = StartProcess();
        }

        await WaitUntilHealthyAsync(token);
    }

    private static Process StartProcess()
    {
        var exePath = ResolveOrchestratorExePath()
            ?? throw new InvalidOperationException(
                "Could not find xcrop-orchestrator.exe. Build it first: cd xcrop\\orchestrator, then " +
                ".venv\\Scripts\\pip install -r requirements-dev.txt and .\\build.ps1 - or set the " +
                "XCROP_ORCHESTRATOR_PATH environment variable to an already-built copy.");

        var startInfo = new ProcessStartInfo
        {
            FileName = exePath,
            UseShellExecute = false,
            CreateNoWindow = true, // no console window popping up behind ArcGIS Pro
        };
        startInfo.ArgumentList.Add("--port");
        startInfo.ArgumentList.Add(Port.ToString());
        startInfo.ArgumentList.Add("--host");
        startInfo.ArgumentList.Add("127.0.0.1");

        // See xcrop/desktop/electron/main.ts's identical env vars for why: numpy (a
        // shapely dependency) links OpenBLAS, which can throw "Memory allocation still
        // failed after 10 retries" on a machine already low on free memory unless BLAS is
        // pinned to a single thread. Costs nothing here - shapely's per-request geometry
        // ops on one AOI polygon are tiny, never something that benefits from multi-threading.
        startInfo.EnvironmentVariables["OPENBLAS_NUM_THREADS"] = "1";
        startInfo.EnvironmentVariables["OMP_NUM_THREADS"] = "1";

        return Process.Start(startInfo)
            ?? throw new InvalidOperationException($"Process.Start returned null for '{exePath}'.");
    }

    private static async Task WaitUntilHealthyAsync(CancellationToken token)
    {
        var deadline = DateTime.UtcNow.AddSeconds(20);
        while (DateTime.UtcNow < deadline)
        {
            token.ThrowIfCancellationRequested();
            try
            {
                using var response = await s_http.GetAsync($"http://127.0.0.1:{Port}/health", token);
                if (response.IsSuccessStatusCode)
                    return;
            }
            catch
            {
                // Not up yet - keep polling until the deadline.
            }
            await Task.Delay(300, token);
        }

        throw new TimeoutException("xcrop-orchestrator.exe did not become healthy within 20 seconds.");
    }

    /// <summary>
    /// This Add-in and xcrop are sibling projects under the same repo root (see other
    /// cross-project comments in this codebase, e.g. Config/SettingsViewModel.cs
    /// referencing backend/app/routes/chat.py by relative path) - walk up from this
    /// assembly's own install location looking for xcrop/orchestrator/dist/ alongside it.
    /// XCROP_ORCHESTRATOR_PATH overrides this for anyone running the Add-in from a
    /// location where that layout doesn't hold (e.g. a standalone distributed copy).
    /// </summary>
    private static string? ResolveOrchestratorExePath()
    {
        var overridePath = Environment.GetEnvironmentVariable("XCROP_ORCHESTRATOR_PATH");
        if (!string.IsNullOrWhiteSpace(overridePath) && File.Exists(overridePath))
            return overridePath;

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 10 && dir is not null; i++, dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "xcrop", "orchestrator", "dist", "xcrop-orchestrator.exe");
            if (File.Exists(candidate))
                return candidate;
        }

        return null;
    }

    public void Dispose()
    {
        lock (_lock)
        {
            if (_process is { HasExited: false })
            {
                try
                {
                    _process.Kill(entireProcessTree: true);
                }
                catch
                {
                    // Best-effort - ArcGIS Pro is shutting down either way.
                }
            }
            _process?.Dispose();
            _process = null;
        }
    }
}

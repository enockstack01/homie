using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;

namespace xGIS.AddIn.Orchestrator;

/// <summary>Thrown when the orchestrator returns a non-success response - message is its
/// own "detail" field verbatim, already meant to be read by a person (or, here, narrated
/// by Claude), matching how xcrop desktop's own lib/api.ts surfaces the same field.</summary>
public sealed class OrchestratorException : Exception
{
    public OrchestratorException(string message) : base(message)
    {
    }
}

/// <summary>
/// REST client for the xcrop orchestrator (see OrchestratorProcess). Plain HttpClient +
/// System.Text.Json, matching Agent/ClaudeAgentService.cs's own no-SDK convention rather
/// than generating a client for a handful of endpoints.
/// </summary>
public sealed class OrchestratorClient
{
    private static readonly HttpClient s_http = new();
    private readonly string _baseUrl = $"http://127.0.0.1:{OrchestratorProcess.Port}";

    public async Task<JsonElement> ListCropsAsync(CancellationToken token)
    {
        using var response = await s_http.GetAsync($"{_baseUrl}/crops", token);
        return await ParseAsync(response, token);
    }

    /// <summary>
    /// Re-pushes the Homie API key into the orchestrator's in-memory settings (see
    /// xcrop/orchestrator/app/config.py - it never persists the key to its own disk).
    /// Best-effort: a failed prime just means the eventual /analyze or /chat call surfaces
    /// its own clear "no API key configured" error, not a reason to fail the whole turn.
    /// </summary>
    public async Task PrimeApiKeyAsync(string apiKey, CancellationToken token)
    {
        try
        {
            using var body = JsonContent.Create(new { homie_api_key = apiKey });
            using var response = await s_http.PutAsync($"{_baseUrl}/settings", body, token);
        }
        catch
        {
            // Best-effort - see summary above.
        }
    }

    public async Task<JsonElement> CreateProjectAsync(string name, JsonElement aoiGeoJson, CancellationToken token)
    {
        using var body = JsonContent.Create(new { name, aoi_geojson = aoiGeoJson });
        using var response = await s_http.PostAsync($"{_baseUrl}/projects", body, token);
        return await ParseAsync(response, token);
    }

    public async Task<JsonElement> AnalyzeAsync(string projectId, string cropId, CancellationToken token)
    {
        using var body = JsonContent.Create(new { project_id = projectId, crop_id = cropId });
        using var response = await s_http.PostAsync($"{_baseUrl}/analyze", body, token);
        return await ParseAsync(response, token);
    }

    private static async Task<JsonElement> ParseAsync(HttpResponseMessage response, CancellationToken token)
    {
        var text = await response.Content.ReadAsStringAsync(token);
        using var doc = JsonDocument.Parse(text);
        var root = doc.RootElement.Clone();

        if (!response.IsSuccessStatusCode)
        {
            var detail = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("detail", out var d)
                ? d.GetString()
                : text;
            throw new OrchestratorException(detail ?? $"Orchestrator request failed ({(int)response.StatusCode}).");
        }

        return root;
    }
}

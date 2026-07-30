using System.IO;
using System.Text.Json;
using ArcGIS.Desktop.Framework.Contracts;

namespace xGIS.AddIn.Config;

/// <summary>
/// Single shared instance (xGISModule.Current.Settings) so the Settings window and the
/// chat dockpane are always looking at the same state. Backend URL and the confirmation
/// toggle persist to a small local JSON file; the API key never goes in that file - it
/// stays in Windows Credential Manager via CredentialStore. Model choice used to live
/// here too, but now lives on the account instead (chosen in the Homie dashboard) - the
/// backend gateway derives the model to bill/call from the signed-in account's own
/// preference, never from anything the Add-in sends (see backend/app/routes/chat.py's
/// handle_chat_request), so there is nothing for this Add-in to configure anymore.
/// </summary>
public sealed class SettingsViewModel : PropertyChangedBase
{
    private static readonly string SettingsFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "xGIS", "settings.json");

    private const string DefaultBackendBaseUrl = "http://127.0.0.1:8000";

    private bool _confirmBeforeWrite = true;
    private string _backendBaseUrl = DefaultBackendBaseUrl;

    public SettingsViewModel()
    {
        Load();
    }

    /// <summary>
    /// Master switch for ToolSafety's confirmation gate. Off is meant for trusted,
    /// throwaway scratch projects only - keep it on by default.
    /// </summary>
    public bool ConfirmBeforeDestructiveWrite
    {
        get => _confirmBeforeWrite;
        set
        {
            if (SetProperty(ref _confirmBeforeWrite, value))
                Save();
        }
    }

    /// <summary>
    /// Where the xGIS backend gateway (backend/app/main.py) is reachable. Defaults to a
    /// local dev server; point this at wherever the gateway is actually deployed once it
    /// isn't running on the same machine as ArcGIS Pro.
    /// </summary>
    public string BackendBaseUrl
    {
        get => _backendBaseUrl;
        set
        {
            var normalized = string.IsNullOrWhiteSpace(value) ? DefaultBackendBaseUrl : value.Trim();
            if (SetProperty(ref _backendBaseUrl, normalized))
                Save();
        }
    }

    /// <summary>
    /// The xGIS API key: a Clerk Machine secret key (looks like "ak_...", provisioned by
    /// an xGIS admin via the backend/Clerk Backend API - not self-service from a personal
    /// Clerk account, and not an Anthropic key). The backend gateway holds the only real
    /// Anthropic API key. Same UX as before (Windows Credential Manager, never in a
    /// project or config file), just a different credential underneath - see
    /// docs/ARCHITECTURE.md's "Why no Anthropic SDK" section for the full story.
    /// </summary>
    public string? ApiKey
    {
        get => CredentialStore.GetApiKey();
        set
        {
            if (!string.IsNullOrWhiteSpace(value))
                CredentialStore.SetApiKey(value);
            NotifyPropertyChanged(nameof(ApiKey));
        }
    }

    public bool HasApiKey => !string.IsNullOrWhiteSpace(ApiKey);

    private void Load()
    {
        try
        {
            if (!File.Exists(SettingsFilePath))
                return;

            var stored = JsonSerializer.Deserialize<StoredSettings>(File.ReadAllText(SettingsFilePath));
            if (stored is null)
                return;

            if (!string.IsNullOrWhiteSpace(stored.BackendBaseUrl))
                _backendBaseUrl = stored.BackendBaseUrl;
            _confirmBeforeWrite = stored.ConfirmBeforeDestructiveWrite;
        }
        catch
        {
            // Corrupt/unreadable settings file - fall back to defaults rather than crash module load.
        }
    }

    private void Save()
    {
        try
        {
            var directory = Path.GetDirectoryName(SettingsFilePath)!;
            Directory.CreateDirectory(directory);
            var json = JsonSerializer.Serialize(new StoredSettings(_confirmBeforeWrite, _backendBaseUrl));
            File.WriteAllText(SettingsFilePath, json);
        }
        catch
        {
            // Best-effort persistence; an in-memory-only setting for this session is an
            // acceptable degradation, not a reason to surface an error to the user.
        }
    }

    private sealed record StoredSettings(bool ConfirmBeforeDestructiveWrite, string BackendBaseUrl);
}

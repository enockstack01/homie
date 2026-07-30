using System.Collections.ObjectModel;
using System.Windows.Input;
using ArcGIS.Desktop.Framework;
using ArcGIS.Desktop.Framework.Contracts;
using ArcGIS.Desktop.Framework.Threading.Tasks;
using xGIS.AddIn.Agent;
using xGIS.AddIn.Chat;

namespace xGIS.AddIn.UI;

/// <summary>
/// Backs the "xGIS Chat" dockpane. Owns the visible transcript and the per-turn
/// CancellationTokenSource; delegates the actual Claude/tool loop to ClaudeAgentService.
/// Implements IConfirmationPrompt so the agent can pop the Allow/Deny modal without
/// depending on WPF itself.
/// </summary>
internal sealed class ChatDockpaneViewModel : DockPane, IConfirmationPrompt
{
    private const string DockPaneId = "xGIS_ChatDockpane";

    private CancellationTokenSource? _turnCts;

    private string _inputText = string.Empty;
    private bool _isBusy;

    public ObservableCollection<ChatMessage> History { get; } = new();

    public string InputText
    {
        get => _inputText;
        set => SetProperty(ref _inputText, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        set => SetProperty(ref _isBusy, value);
    }

    public ICommand SendCommand { get; }
    public ICommand StopCommand { get; }

    public ChatDockpaneViewModel()
    {
        SendCommand = new RelayCommand(async () => await SendAsync(), () => !IsBusy && !string.IsNullOrWhiteSpace(InputText));
        StopCommand = new RelayCommand(() => _turnCts?.Cancel(), () => IsBusy);
    }

    internal static void Show()
    {
        FrameworkApplication.DockPaneManager.Find(DockPaneId)?.Activate();
    }

    private async Task SendAsync()
    {
        var text = InputText.Trim();
        if (string.IsNullOrEmpty(text) || IsBusy)
            return;

        InputText = string.Empty;
        IsBusy = true;
        _turnCts = new CancellationTokenSource();

        try
        {
            // Constructed fresh each turn (cheap - no network call in the constructor)
            // so a Settings change to the API key or model takes effect immediately,
            // rather than being baked into a cached AnthropicClient from an earlier turn.
            var agent = new ClaudeAgentService(xGISModule.Current.Settings, xGISModule.Current.AuditLogger, this);
            await agent.RunTurnAsync(text, History, _turnCts.Token);
        }
        catch (OperationCanceledException)
        {
            History.Add(ChatMessage.Status("Stopped."));
        }
        catch (InvalidOperationException ex)
        {
            // Typically: no API key configured yet.
            History.Add(ChatMessage.Error(ex.Message));
        }
        finally
        {
            IsBusy = false;
            _turnCts?.Dispose();
            _turnCts = null;
        }
    }

    public async Task<bool> ConfirmOnUiThreadAsync(string summary)
    {
        // ConfirmationDialog.Show already marshals to the UI thread and blocks the
        // calling async continuation, which is fine here since it resumes on the UI
        // thread by default (see ClaudeAgentService for why we don't ConfigureAwait(false)).
        return await Task.FromResult(ConfirmationDialog.Show(summary));
    }
}

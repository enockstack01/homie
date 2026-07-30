using System.Windows;
using System.Windows.Media;
using ArcGIS.Desktop.Framework;
using xGIS.AddIn.Config;

namespace xGIS.AddIn.UI;

public partial class SettingsWindow : Window
{
    private readonly SettingsViewModel _settings;

    private SettingsWindow(SettingsViewModel settings)
    {
        InitializeComponent();
        _settings = settings;

        ConfirmCheckBox.IsChecked = settings.ConfirmBeforeDestructiveWrite;
        BackendUrlTextBox.Text = settings.BackendBaseUrl;

        // Pre-fill with whatever is already stored (masked by default) so opening
        // Settings always shows the real current state - "Show" reveals it, editing
        // and Save replaces it, there is no separate "leave blank to keep it" rule to
        // remember.
        var existingKey = settings.ApiKey ?? string.Empty;
        ApiKeyPasswordBox.Password = existingKey;
        ApiKeyTextBox.Text = existingKey;

        SetApiKeyStatus(settings.HasApiKey
            ? "Currently stored in Windows Credential Manager. Check \"Show\" to view it, or edit and Save to replace it."
            : "No key stored yet - paste your xGIS API key above and Save.",
            Brushes.Gray);
    }

    /// <summary>Opens the modal against the shared xGISModule.Current.Settings instance.</summary>
    public static void ShowDialogForCurrentSettings()
    {
        var window = new SettingsWindow(xGISModule.Current.Settings)
        {
            Owner = FrameworkApplication.Current.MainWindow
        };
        window.ShowDialog();
    }

    private void ShowKeyCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        if (ShowKeyCheckBox.IsChecked == true)
        {
            ApiKeyTextBox.Text = ApiKeyPasswordBox.Password;
            ApiKeyTextBox.Visibility = Visibility.Visible;
            ApiKeyPasswordBox.Visibility = Visibility.Collapsed;
        }
        else
        {
            ApiKeyPasswordBox.Password = ApiKeyTextBox.Text;
            ApiKeyPasswordBox.Visibility = Visibility.Visible;
            ApiKeyTextBox.Visibility = Visibility.Collapsed;
        }
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        var newKey = ShowKeyCheckBox.IsChecked == true ? ApiKeyTextBox.Text : ApiKeyPasswordBox.Password;

        if (string.IsNullOrWhiteSpace(newKey))
        {
            SetApiKeyStatus("Enter an API key before saving.", Brushes.Firebrick);
            return;
        }

        _settings.ApiKey = newKey;
        _settings.BackendBaseUrl = BackendUrlTextBox.Text;
        _settings.ConfirmBeforeDestructiveWrite = ConfirmCheckBox.IsChecked ?? true;

        SetApiKeyStatus($"Saved to Windows Credential Manager at {DateTime.Now:t}.", Brushes.SeaGreen);
    }

    private void SetApiKeyStatus(string text, Brush color)
    {
        ApiKeyStatusText.Text = text;
        ApiKeyStatusText.Foreground = color;
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
    }
}

using System.Windows;
using ArcGIS.Desktop.Framework;

namespace xGIS.AddIn.UI;

public partial class ConfirmationDialog : Window
{
    private ConfirmationDialog(string summary)
    {
        InitializeComponent();
        SummaryText.Text = summary;
    }

    /// <summary>
    /// Shows the modal on the UI thread and returns true only if the user clicked Allow.
    /// Safe to call from an async continuation that has resumed on the UI thread (the
    /// normal case here, since ClaudeAgentService never uses ConfigureAwait(false)).
    /// </summary>
    public static bool Show(string summary)
    {
        var dialog = new ConfirmationDialog(summary) { Owner = FrameworkApplication.Current.MainWindow };
        return dialog.ShowDialog() == true;
    }

    private void Allow_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
    }

    private void Deny_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }
}

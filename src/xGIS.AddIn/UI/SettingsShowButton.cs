using ArcGIS.Desktop.Framework.Contracts;

namespace xGIS.AddIn.UI;

internal sealed class SettingsShowButton : Button
{
    protected override void OnClick() => SettingsWindow.ShowDialogForCurrentSettings();
}

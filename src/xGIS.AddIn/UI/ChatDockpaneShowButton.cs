using ArcGIS.Desktop.Framework.Contracts;

namespace xGIS.AddIn.UI;

internal sealed class ChatDockpaneShowButton : Button
{
    protected override void OnClick() => ChatDockpaneViewModel.Show();
}

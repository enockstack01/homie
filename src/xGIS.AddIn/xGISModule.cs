using ArcGIS.Desktop.Framework;
using ArcGIS.Desktop.Framework.Contracts;
using xGIS.AddIn.Config;
using xGIS.AddIn.Logging;

namespace xGIS.AddIn;

internal sealed class xGISModule : Module
{
    private static xGISModule? _this;

    public static xGISModule Current =>
        _this ??= (xGISModule)FrameworkApplication.FindModule("xGIS_Module");

    private SettingsViewModel? _settings;
    private AuditLogger? _auditLogger;

    /// <summary>
    /// One instance for the whole add-in lifetime so the Settings window and the chat
    /// dockpane are always reading/writing the same state (see SettingsViewModel's own
    /// persistence for what survives across ArcGIS Pro sessions). Lazy rather than an
    /// eager field initializer so a problem constructing either can never block the
    /// module itself from loading - it would only fail the specific control that first
    /// touches it.
    /// </summary>
    public SettingsViewModel Settings => _settings ??= new SettingsViewModel();

    public AuditLogger AuditLogger => _auditLogger ??= new AuditLogger();

    protected override bool CanUnload() => true;
}

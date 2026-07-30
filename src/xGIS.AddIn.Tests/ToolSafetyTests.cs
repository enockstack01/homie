using xGIS.AddIn.Tools;
using Xunit;

namespace xGIS.AddIn.Tests;

public class ToolSafetyTests
{
    [Theory]
    [InlineData("CopyFeatures_management", "CopyFeatures")]
    [InlineData("Buffer_analysis", "Buffer")]
    [InlineData("NoAliasHere", "NoAliasHere")]
    public void BaseName_StripsToolboxAlias(string toolNameWithAlias, string expected)
    {
        Assert.Equal(expected, ToolSafety.BaseName(toolNameWithAlias));
    }

    [Theory]
    [InlineData("DeleteFeatures_management", true)]
    [InlineData("DeleteField_management", true)]
    [InlineData("Overwrite_management", true)]
    [InlineData("TruncateTable_management", true)]
    [InlineData("RemoveField_management", true)]
    [InlineData("Erase_analysis", true)]
    [InlineData("CopyFeatures_management", false)]
    [InlineData("Buffer_analysis", false)]
    [InlineData("AddField_management", false)]
    public void LooksDestructive_ClassifiesByBaseNamePrefix(string toolNameWithAlias, bool expected)
    {
        Assert.Equal(expected, ToolSafety.LooksDestructive(toolNameWithAlias));
    }
}

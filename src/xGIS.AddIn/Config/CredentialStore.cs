using System.Runtime.InteropServices;

namespace xGIS.AddIn.Config;

/// <summary>
/// Stores the xGIS API key (a Clerk-issued key for the backend gateway - see
/// SettingsViewModel.ApiKey) in Windows Credential Manager (per-user, DPAPI-encrypted at
/// rest) instead of any file that could end up in source control. Falls back to the
/// XGIS_API_KEY environment variable for local development only.
/// </summary>
public static class CredentialStore
{
    private const string TargetName = "xGIS:ApiKey";

    public static string? GetApiKey()
    {
        if (TryReadCredential(TargetName, out var fromVault))
            return fromVault;

        return Environment.GetEnvironmentVariable("XGIS_API_KEY", EnvironmentVariableTarget.User)
               ?? Environment.GetEnvironmentVariable("XGIS_API_KEY");
    }

    public static void SetApiKey(string apiKey)
    {
        WriteCredential(TargetName, apiKey);
    }

    public static void DeleteApiKey()
    {
        CredDelete(TargetName, CredType.Generic, 0);
    }

    private static bool TryReadCredential(string target, out string? value)
    {
        value = null;
        if (!CredRead(target, CredType.Generic, 0, out var credPtr) || credPtr == IntPtr.Zero)
            return false;

        try
        {
            var credential = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
            if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0)
                return false;

            value = Marshal.PtrToStringUni(credential.CredentialBlob, credential.CredentialBlobSize / 2);
            return true;
        }
        finally
        {
            CredFree(credPtr);
        }
    }

    private static void WriteCredential(string target, string secret)
    {
        var secretBytes = System.Text.Encoding.Unicode.GetBytes(secret);
        var blob = Marshal.AllocHGlobal(secretBytes.Length);
        try
        {
            Marshal.Copy(secretBytes, 0, blob, secretBytes.Length);

            var credential = new CREDENTIAL
            {
                Type = CredType.Generic,
                TargetName = target,
                CredentialBlobSize = secretBytes.Length,
                CredentialBlob = blob,
                Persist = CredPersist.LocalMachine,
                UserName = Environment.UserName
            };

            if (!CredWrite(ref credential, 0))
                throw new InvalidOperationException(
                    $"Failed to write credential to Windows Credential Manager (Win32 error {Marshal.GetLastWin32Error()}).");
        }
        finally
        {
            Marshal.FreeHGlobal(blob);
        }
    }

    private enum CredType : uint { Generic = 1 }
    private enum CredPersist : uint { LocalMachine = 2 }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public CredType Type;
        [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
        [MarshalAs(UnmanagedType.LPWStr)] public string? Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public CredPersist Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        [MarshalAs(UnmanagedType.LPWStr)] public string? TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)] public string? UserName;
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredWrite(ref CREDENTIAL credential, uint flags);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(string target, CredType type, uint flags, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredDelete(string target, CredType type, uint flags);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr credentialPtr);
}

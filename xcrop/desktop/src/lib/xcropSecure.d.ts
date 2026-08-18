export {};

declare global {
  interface Window {
    // Exposed by electron/preload.ts - bridges to the OS-backed credential store
    // (electron/credentialStore.ts) rather than doing filesystem/safeStorage access
    // directly in the renderer.
    xcropSecure: {
      getApiKey(): Promise<string | null>;
      setApiKey(apiKey: string): Promise<boolean>;
      clearApiKey(): Promise<void>;
    };
  }
}

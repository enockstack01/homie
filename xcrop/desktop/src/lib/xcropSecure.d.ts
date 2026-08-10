export {};

declare global {
  interface Window {
    // Exposed by electron/preload.ts - bridges to the OS-backed credential store
    // (electron/credentialStore.ts) and the browser-based Clerk sign-in handoff
    // (electron/main.ts's protocol handler) rather than doing either directly in the
    // renderer.
    xcropSecure: {
      getApiKey(): Promise<string | null>;
      setApiKey(apiKey: string): Promise<boolean>;
      clearApiKey(): Promise<void>;
      openSignIn(): Promise<void>;
      /** Fires once the xcrop://auth-callback handoff has stored a new key and primed
       * the orchestrator with it. Returns an unsubscribe function. */
      onSignedIn(callback: () => void): () => void;
    };
  }
}

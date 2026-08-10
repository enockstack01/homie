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
      /** Fires once the xcrop://auth-callback handoff has stored a new key. `success` is
       * true only if the orchestrator also validated and accepted it (see
       * electron/main.ts's handleAuthCallbackUrl) - false means the key was received but
       * priming failed (e.g. couldn't reach the backend), with `error` describing why.
       * Returns an unsubscribe function. */
      onSignedIn(callback: (result: { success: boolean; error?: string }) => void): () => void;
    };
  }
}

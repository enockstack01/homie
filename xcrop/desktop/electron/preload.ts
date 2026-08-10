import { contextBridge, ipcRenderer } from "electron";

// Bridges the renderer to Electron main's OS-backed credential store (see
// credentialStore.ts) and the browser-based sign-in handoff (see main.ts's
// registerProtocolHandler/handleAuthCallbackUrl) - the renderer never touches the
// filesystem, safeStorage, or shell.openExternal directly, only these IPC calls, keeping
// contextIsolation/nodeIntegration as they are.
contextBridge.exposeInMainWorld("xcropSecure", {
  getApiKey: (): Promise<string | null> => ipcRenderer.invoke("xcrop:getApiKey"),
  setApiKey: (apiKey: string): Promise<boolean> => ipcRenderer.invoke("xcrop:setApiKey", apiKey),
  clearApiKey: (): Promise<void> => ipcRenderer.invoke("xcrop:clearApiKey"),
  openSignIn: (): Promise<void> => ipcRenderer.invoke("xcrop:openSignIn"),
  onSignedIn: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("xcrop:signed-in", listener);
    return () => ipcRenderer.removeListener("xcrop:signed-in", listener);
  },
});

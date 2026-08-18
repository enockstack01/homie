import { contextBridge, ipcRenderer } from "electron";

// Bridges the renderer to Electron main's OS-backed credential store (see
// credentialStore.ts) - the renderer never touches the filesystem or safeStorage
// directly, only these IPC calls, keeping contextIsolation/nodeIntegration as they are.
contextBridge.exposeInMainWorld("xcropSecure", {
  getApiKey: (): Promise<string | null> => ipcRenderer.invoke("xcrop:getApiKey"),
  setApiKey: (apiKey: string): Promise<boolean> => ipcRenderer.invoke("xcrop:setApiKey", apiKey),
  clearApiKey: (): Promise<void> => ipcRenderer.invoke("xcrop:clearApiKey"),
});

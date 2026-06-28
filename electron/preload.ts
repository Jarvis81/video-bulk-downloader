import { contextBridge, ipcRenderer } from "electron";
import type { Platform } from "@vbd/shared";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  pickFolder: (initialDir?: string): Promise<string | null> =>
    ipcRenderer.invoke("pick-folder", initialDir),
  login: (platform: Platform): Promise<string | null> =>
    ipcRenderer.invoke("login", platform),
});

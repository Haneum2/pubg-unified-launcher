import { contextBridge, ipcRenderer } from 'electron';
import type { LauncherApi } from '../shared/types';

const api: LauncherApi = {
  getState: () => ipcRenderer.invoke('getState'),
  selectServer: (server) => ipcRenderer.invoke('selectServer', server),
  chooseSteamFolder: () => ipcRenderer.invoke('chooseSteamFolder'),
  launch: () => ipcRenderer.invoke('launch'),
  getProfile: () => ipcRenderer.invoke('getProfile'),
  saveProfile: (p) => ipcRenderer.invoke('saveProfile', p),
  pickProgram: () => ipcRenderer.invoke('pickProgram'),
  resetRecords: () => ipcRenderer.invoke('resetRecords'),
  openLink: (url) => ipcRenderer.invoke('openLink', url),
  createShortcuts: () => ipcRenderer.invoke('createShortcuts'),
  checkUpdate: () => ipcRenderer.invoke('checkUpdate'),
  downloadUpdate: () => ipcRenderer.invoke('downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('installUpdate'),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
};

contextBridge.exposeInMainWorld('launcher', api);

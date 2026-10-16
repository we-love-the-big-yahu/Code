'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('imagePlotter', {
  state: () => ipcRenderer.invoke('drawing:state'),
  permission: () => ipcRenderer.invoke('drawing:permission'),
  chooseArea: () => ipcRenderer.invoke('drawing:choose-area'),
  start: (plan, options) => ipcRenderer.invoke('drawing:start', plan, options),
  stop: () => ipcRenderer.invoke('drawing:stop'),
  onProgress: callback => { const fn = (_, data) => callback(data); ipcRenderer.on('drawing:progress', fn); return () => ipcRenderer.removeListener('drawing:progress', fn); }
});

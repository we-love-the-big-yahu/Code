'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('areaPicker', {
  choose: rect => ipcRenderer.send('drawing:area-picked', rect),
  cancel: () => ipcRenderer.send('drawing:area-cancel')
});

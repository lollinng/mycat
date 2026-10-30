const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  on: (channel, fn) => ipcRenderer.on(channel, (_event, value) => fn(value)),
  settings: () => ipcRenderer.invoke('settings'),
  // pet window
  setInteractive: (on) => ipcRenderer.send('set-interactive', on),
  setHeight: (h) => ipcRenderer.send('set-height', h),
  saveTree: (t) => ipcRenderer.send('save-tree', t),
  clicked: (at) => ipcRenderer.send('clicked', at),
  menu: () => ipcRenderer.send('menu'),
  // panel window
  data: () => ipcRenderer.invoke('data'),
  saveFields: (doc) => ipcRenderer.invoke('save-fields', doc),
  saveNotes: (doc) => ipcRenderer.invoke('save-notes', doc),
  copy: (text) => ipcRenderer.invoke('copy', text),
  focusPanel: (on) => ipcRenderer.invoke('panel-focus', on),
  hidePanel: () => ipcRenderer.send('panel-hide'),
});

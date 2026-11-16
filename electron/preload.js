const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  platform: process.platform,
  version: '0.1.0',
});

contextBridge.exposeInMainWorld('projectApi', {
  save: (data) => ipcRenderer.invoke('project:save', data),
  open: () => ipcRenderer.invoke('project:open'),
});

contextBridge.exposeInMainWorld('logoApi', {
  match: (categories) => ipcRenderer.invoke('logo:match', { categories }),
  resolve: (keys) => ipcRenderer.invoke('logo:resolve', { keys }),
});

contextBridge.exposeInMainWorld('excelApi', {
  saveTemplate: (spec, rows) => ipcRenderer.invoke('excel:template', { spec, rows }),
  importFile: (spec) => ipcRenderer.invoke('excel:import', { spec }),
  analyze: (spec) => ipcRenderer.invoke('excel:analyze', { spec }),
});

contextBridge.exposeInMainWorld('svgApi', {
  save: (svg, filename) => ipcRenderer.invoke('svg:save', { svg, filename }),
});

contextBridge.exposeInMainWorld('aiApi', {
  status: () => ipcRenderer.invoke('ai:status'),
  setKey: (key) => ipcRenderer.invoke('ai:setKey', { key }),
  advise: (chartList) => ipcRenderer.invoke('ai:advise', { chartList }),
});

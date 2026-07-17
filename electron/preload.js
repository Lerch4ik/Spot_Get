const { contextBridge, ipcRenderer } = require('electron')

// Wraps an IPC channel so that calling the returned subscriber function
// multiple times (e.g. because the renderer bundle got hot-reloaded and
// re-ran its init code) never results in more than one active listener.
// Without this, every re-registration stacked another `ipcRenderer.on`
// on top of the old ones, so a single main-process event fired the
// renderer callback N times (visible as "duplicate" downloads/tracks).
function makeEventBridge(channel) {
  return (cb) => {
    ipcRenderer.removeAllListeners(channel)
    const listener = (_, data) => cb(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: makeEventBridge('window:maximizeChanged'),

  cancelAllDownloads: () => ipcRenderer.invoke('download:cancelAll'),

  // File system
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  showFolder: (path) => ipcRenderer.invoke('shell:openFolder', path),
  showInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),

  // electron-store
  getStore: (key) => ipcRenderer.invoke('store:get', key),
  setStore: (key, value) => ipcRenderer.invoke('store:set', key, value),

  // Export / Import
  exportHistory: (data) => ipcRenderer.invoke('export:history', data),
  importHistory: () => ipcRenderer.invoke('import:history'),
  exportStats: (data) => ipcRenderer.invoke('export:stats', data),
  importLibrary: () => ipcRenderer.invoke('library:import'),
  getLibraryDir: () => ipcRenderer.invoke('library:getDir'),

  // Download
  startDownload: (opts) => ipcRenderer.invoke('download:start', opts),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  checkSpotdl:  () => ipcRenderer.invoke('download:checkSpotdl'),
  checkYtdlp:   () => ipcRenderer.invoke('download:checkYtdlp'),
  checkTools:  () => ipcRenderer.invoke('download:checkTools'),
  redownloadTools: () => ipcRenderer.invoke('download:redownloadTools'),
  readArtwork: (spotgetUrl) => ipcRenderer.invoke('artwork:read', spotgetUrl),

  // YouTube cookies (bot-check bypass) — automatic in-app login
  cookiesStatus: () => ipcRenderer.invoke('cookies:status'),
  loginYouTube: () => ipcRenderer.invoke('cookies:login'),
  clearCookies: () => ipcRenderer.invoke('cookies:clear'),

  // Subscribe to download events from main process
  onDownloadProgress: makeEventBridge('download:progress'),
  onNewTrack: makeEventBridge('download:newTrack'),
  onTrackSkipped: makeEventBridge('download:trackSkipped'),
  onTrackCompleted: makeEventBridge('download:trackCompleted'),
  onTotalTracks: makeEventBridge('download:totalTracks'),
  onDownloadStats: makeEventBridge('download:stats'),
  onDownloadMeta: makeEventBridge('download:meta'),
  onTrackFailed: makeEventBridge('download:trackFailed'),
  onBotWalled: makeEventBridge('download:botWalled'),

  // Logs
  getLogsPath: () => ipcRenderer.invoke('logs:getPath'),
  openLogsFolder: () => ipcRenderer.invoke('logs:openFolder'),

  // Auto-update (GitHub Releases)
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  onUpdateProgress: makeEventBridge('update:progress')
})

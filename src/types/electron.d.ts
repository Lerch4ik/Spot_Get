/**
 * TypeScript declarations for the Electron API
 * exposed via the preload script (contextBridge)
 */

export interface ElectronAPI {
  // Window controls
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void

  // File system
  openFolder: () => Promise<string | null>
  showFolder: (path: string) => Promise<void>
  showInFolder: (path: string) => Promise<void>

  // electron-store
  getStore: (key: string) => Promise<any>
  setStore: (key: string, value: any) => Promise<void>

  // Export / Import
  exportHistory: (data: any[]) => Promise<{ success: boolean; filePath?: string }>
  importHistory: () => Promise<{ success: boolean; data?: any[]; error?: string }>
  exportStats: (data: any) => Promise<{ success: boolean; filePath?: string }>
  importLibrary: () => Promise<{ success: boolean; tracks?: any[]; folder?: string; error?: string }>
  getLibraryDir: () => Promise<{ tracks: any[]; folder?: string }>

  // YouTube cookies (bot-check bypass) — automatic in-app login
  cookiesStatus?: () => Promise<{ hasCookies: boolean; path: string }>
  loginYouTube?: () => Promise<{ success: boolean; count?: number; error?: string }>
  clearCookies?: () => Promise<{ success: boolean }>
  onBotWalled?: (cb: (data: { parentId: string }) => void) => () => void

  // Auto-update (GitHub Releases)
  getAppVersion?: () => Promise<string>
  checkForUpdate?: () => Promise<{
    updateAvailable: boolean
    currentVersion: string
    latestVersion?: string
    notes?: string
    releaseUrl?: string
    hasInstaller?: boolean
    error?: string
  }>
  downloadUpdate?: () => Promise<{ success: boolean; path?: string; error?: string }>
  onUpdateProgress?: (
    cb: (data: { phase: 'downloading' | 'installing' | 'error'; percent?: number; received?: number; total?: number; error?: string }) => void
  ) => () => void
  openLogsFolder?: () => Promise<void>

  // Platform
  platform: string
  isElectron: boolean
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}

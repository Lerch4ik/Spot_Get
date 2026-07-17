"use client"

import { create } from "zustand"

// Phases of the update lifecycle, shared between the Sidebar "Update" button
// and the Settings "Check for updates" control so they always stay in sync.
export type UpdatePhase =
  | "idle"          // haven't checked yet
  | "checking"      // querying GitHub Releases
  | "available"     // a newer release exists
  | "up-to-date"    // installed version is latest
  | "downloading"   // installer is downloading
  | "installing"    // launching installer / quitting
  | "error"         // last check/download failed

interface UpdaterState {
  phase: UpdatePhase
  currentVersion: string
  latestVersion: string
  notes: string
  releaseUrl: string
  hasInstaller: boolean
  progress: number
  error: string
  progressUnsub: (() => void) | null

  init: () => void
  check: (silent?: boolean) => Promise<void>
  download: () => Promise<void>
}

export const useUpdater = create<UpdaterState>((set, get) => ({
  phase: "idle",
  currentVersion: "",
  latestVersion: "",
  notes: "",
  releaseUrl: "",
  hasInstaller: false,
  progress: 0,
  error: "",
  progressUnsub: null,

  // Wire up the download-progress stream once and grab the app version.
  init: () => {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined
    if (!api) return
    api.getAppVersion?.().then((v) => set({ currentVersion: v || "" })).catch(() => {})
    if (!get().progressUnsub && api.onUpdateProgress) {
      const unsub = api.onUpdateProgress((data) => {
        if (data.phase === "downloading") {
          set({ phase: "downloading", progress: data.percent ?? 0 })
        } else if (data.phase === "installing") {
          set({ phase: "installing", progress: 100 })
        } else if (data.phase === "error") {
          set({ phase: "error", error: data.error || "Update failed" })
        }
      })
      set({ progressUnsub: unsub })
    }
  },

  check: async (silent = true) => {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined
    // No Electron API (e.g. web preview): updates only work in the desktop app.
    if (!api?.checkForUpdate) {
      if (!silent) set({ phase: "error", error: "Updates are only available in the desktop app" })
      return
    }
    // Don't clobber an in-progress download with a background re-check.
    const p = get().phase
    if (p === "downloading" || p === "installing") return
    if (!silent) set({ phase: "checking", error: "" })
    try {
      const res = await api.checkForUpdate()
      if (res.error) {
        set({ phase: silent ? "idle" : "error", error: res.error, currentVersion: res.currentVersion || get().currentVersion })
        return
      }
      set({
        currentVersion: res.currentVersion || get().currentVersion,
        latestVersion: res.latestVersion || "",
        notes: res.notes || "",
        releaseUrl: res.releaseUrl || "",
        hasInstaller: !!res.hasInstaller,
        phase: res.updateAvailable ? "available" : "up-to-date",
        error: "",
      })
    } catch (e: any) {
      set({ phase: silent ? "idle" : "error", error: e?.message || "Check failed" })
    }
  },

  download: async () => {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined
    if (!api?.downloadUpdate) return
    // If the release has no .exe asset, fall back to opening the release page.
    if (!get().hasInstaller) {
      const url = get().releaseUrl
      if (url) window.open(url, "_blank")
      return
    }
    set({ phase: "downloading", progress: 0, error: "" })
    try {
      const res = await api.downloadUpdate()
      if (!res.success) {
        set({ phase: "error", error: res.error || "Download failed" })
      }
      // On success the app quits itself to run the installer.
    } catch (e: any) {
      set({ phase: "error", error: e?.message || "Download failed" })
    }
  },
}))

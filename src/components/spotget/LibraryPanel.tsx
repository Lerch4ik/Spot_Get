'use client'

import { useEffect, useState } from 'react'
import { Music, Play, FolderOpen, Download, FolderInput } from 'lucide-react'
import { useSpotgetStore, buildDownloadedTracks, buildImportedTracks } from '@/lib/store'
import { translations } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { AddToPlaylistButton } from './AddToPlaylistButton'
import { TrackArtwork } from './TrackArtwork'

type LibraryTab = 'downloaded' | 'imported'

export function LibraryPanel() {
  const {
    lang,
    libraryTracks,
    libraryFolder,
    loadLibrary,
    playTrack,
    addToQueue,
    downloads,
  } = useSpotgetStore()
  const t = translations[lang]

  const [activeTab, setActiveTab] = useState<LibraryTab>('downloaded')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getLibraryDir) {
      window.electronAPI.getLibraryDir().then((result: any) => {
        if (result?.tracks?.length) {
          loadLibrary(result.tracks, result.folder || '')
        }
      })
    }
  }, [loadLibrary])

  const handleImport = async () => {
    if (!window.electronAPI?.importLibrary) return
    const result = await window.electronAPI.importLibrary()
    if (result?.tracks?.length) {
      loadLibrary(result.tracks, result.folder || '')
    }
  }

  // Build "downloaded" tracks from completed downloads in history
  const downloadedTracks = buildDownloadedTracks(downloads)
  // "Imported" = the audio files scanned from the user-chosen import folder,
  // which is completely independent of the download folder.
  const importedTracks = buildImportedTracks(libraryTracks)

  const currentTracks = activeTab === 'downloaded' ? downloadedTracks : importedTracks

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.myLibrary}</h1>
        {activeTab === 'imported' && (
          <Button variant="outline" size="sm" onClick={handleImport}>
            <FolderOpen className="w-4 h-4 mr-2" />
            {t.importLibrary}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border">
        <button
          onClick={() => setActiveTab('downloaded')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'downloaded'
              ? 'glass-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Download className="w-4 h-4" />
          {t.downloaded}
          {downloadedTracks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {downloadedTracks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('imported')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'imported'
              ? 'glass-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderInput className="w-4 h-4" />
          {t.imported}
          {importedTracks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {importedTracks.length}
            </span>
          )}
        </button>
      </div>

      {/* Folder info for imported tab */}
      {activeTab === 'imported' && libraryFolder && (
        <p className="text-xs text-muted-foreground truncate">{libraryFolder}</p>
      )}

      {/* Track list */}
      {currentTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Music className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            {activeTab === 'downloaded' ? t.noDownloadedTracks : t.importLibraryDesc}
          </p>
          {activeTab === 'imported' && (
            <Button onClick={handleImport}>
              <FolderOpen className="w-4 h-4 mr-2" />
              {t.browseFolder}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">
            {currentTracks.length} {t.tracks}
          </p>
          {currentTracks.map((track: any) => (
            <div key={track.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 group transition-colors">
              <div className="w-10 h-10 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <TrackArtwork
                  url={track.thumbnailUrl}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  fallback={<Music className="w-5 h-5 text-green-400" />}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground">{track.artist}</p>
              </div>
              <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                {track.format}
              </span>
              <AddToPlaylistButton track={track} />
              <button
                onClick={() => {
                  playTrack(track, currentTracks)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-white/10 text-green-400"
                title="Play"
              >
                <Play className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

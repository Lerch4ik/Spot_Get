'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Music, Heart, ListMusic, Plus, Trash2, X, Check, Edit3, MoreHorizontal, FolderHeart, Download, FolderInput } from 'lucide-react'
import { useSpotgetStore, buildDownloadedTracks, buildImportedTracks, type PlaylistData } from '@/lib/store'
import { translations } from '@/lib/i18n'
import { formatTime } from './MiniPlayer'
import { AddToPlaylistButton } from './AddToPlaylistButton'
import { TrackArtwork } from './TrackArtwork'
import { VirtualList } from './VirtualList'
import { TrackListControls, sortTracks, filterTracks, type TrackSortMode } from './TrackListControls'

const PLAYLIST_COLORS = ['#1ed760', '#3498db', '#e74c3c', '#e67e22', '#9b59b6', '#1abc9c', '#f39c12', '#fa2d48', '#ff5500', '#ffcc00']

export function PlayerPanel() {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    likedTrackIds,
    toggleLike,
    playlists,
    addPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    getPlaylistTracks,
    playPlaylist,
    libraryTracks,
    downloads,
    lang,
  } = useSpotgetStore()
  const t = translations[lang]

  // Downloaded tracks (from completed downloads) + imported library tracks.
  // Imported tracks come from the user-chosen import folder, which is separate
  // from the download folder — the two lists never overlap.
  const downloadedTracks = buildDownloadedTracks(downloads)
  const importedTracks = buildImportedTracks(libraryTracks)
  const allTracks = [...downloadedTracks, ...importedTracks]

  // Track durations are scanned app-wide right at startup (see page.tsx).

  const likedTracks = allTracks.filter((tr) => likedTrackIds.has(tr.id))

  // Tab for the "All Tracks" section: downloaded vs imported (like My Library)
  const [tracksTab, setTracksTab] = useState<'downloaded' | 'imported'>('downloaded')
  const [trackSearch, setTrackSearch] = useState('')
  const [trackSort, setTrackSort] = useState<TrackSortMode>('default')
  const baseTracks = tracksTab === 'downloaded' ? downloadedTracks : importedTracks
  // Search + sort applied here; the virtual list renders only visible rows.
  const visibleTracks = sortTracks(filterTracks(baseTracks, trackSearch), trackSort)

  // Playlist creation state
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('')
  const [newPlaylistColor, setNewPlaylistColor] = useState('#1ed760')

  // Track addition state
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null)

  // Expanded playlist state
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null)

  // Editing playlist state
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return
    addPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim(), newPlaylistColor)
    setNewPlaylistName('')
    setNewPlaylistDesc('')
    setNewPlaylistColor('#1ed760')
    setShowCreatePlaylist(false)
  }

  const handleStartEdit = (pl: PlaylistData) => {
    setEditingPlaylist(pl.id)
    setEditName(pl.name)
    setEditDesc(pl.description)
  }

  const handleSaveEdit = (id: string) => {
    updatePlaylist(id, { name: editName, description: editDesc })
    setEditingPlaylist(null)
  }

  return (
    <div className="relative max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Ambient glow ────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[340px] rounded-full opacity-60"
        style={{
          background: "radial-gradient(ellipse at center, rgba(30,215,96,0.14) 0%, rgba(34,211,238,0.05) 45%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />

      {/* ── Hero ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative pt-8 text-center space-y-3"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          <span className="text-white">{lang === 'ru' ? 'Твоя ' : 'Your '}</span>
          <span
            style={{
              background: "linear-gradient(90deg, #1ed760 0%, #4ade80 50%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {lang === 'ru' ? 'музыка' : 'music'}
          </span>
        </h1>
        <p className="text-[13px] text-white/35">{lang === 'ru' ? 'Коллекция, любимые треки и плейлисты' : 'Your music collection & playlists'}</p>
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreatePlaylist(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold text-black transition-colors"
            style={{ background: 'linear-gradient(90deg, #1ed760, #4ade80)', boxShadow: '0 8px 28px rgba(30,215,96,0.25)' }}
          >
            <Plus className="w-4 h-4" />
            {lang === 'ru' ? 'Новый плейлист' : 'New Playlist'}
          </motion.button>
        </div>
      </motion.div>

      {/* Create Playlist Modal */}
      <AnimatePresence>
        {showCreatePlaylist && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl border-[1.5px] border-primary/25 bg-primary/[0.05] backdrop-blur-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                {lang === 'ru' ? 'Создать плейлист' : 'Create Playlist'}
              </h3>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowCreatePlaylist(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{lang === 'ru' ? 'Название' : 'Name'}</label>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="My Awesome Playlist"
                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_rgba(30,215,96,0.2)] transition-all placeholder:text-muted-foreground/50"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{lang === 'ru' ? 'Описание (необязательно)' : 'Description (optional)'}</label>
              <input
                type="text"
                value={newPlaylistDesc}
                onChange={(e) => setNewPlaylistDesc(e.target.value)}
                placeholder="What's this playlist about?"
                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_rgba(30,215,96,0.2)] transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{lang === 'ru' ? 'Цвет' : 'Color'}</label>
              <div className="flex gap-2 flex-wrap">
                {PLAYLIST_COLORS.map((c) => (
                  <motion.button
                    key={c}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setNewPlaylistColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      newPlaylistColor === c ? 'scale-110' : ''
                    }`}
                    style={{
                      backgroundColor: c,
                      boxShadow: newPlaylistColor === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : 'none',
                    }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(30,215,96,0.3)] transition-shadow"
              >
                {lang === 'ru' ? 'Создать' : 'Create'}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowCreatePlaylist(false)}
                className="px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Currently Playing Card */}
      {currentTrack && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5"
        >
          <p className="text-[10px] text-primary font-semibold uppercase tracking-widest mb-3">{t.nowPlaying}</p>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
              style={{ backgroundColor: currentTrack.color || '#1ed760' }}
            >
              <TrackArtwork
                url={currentTrack.thumbnailUrl}
                alt={currentTrack.title}
                className="absolute inset-0 w-full h-full object-cover"
                fallback={<span className="text-white text-xl font-bold">{currentTrack.title.charAt(0)}</span>}
              />
              {isPlaying && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
                  <motion.div animate={{ height: [2, 6, 2] }} transition={{ duration: 0.5, repeat: Infinity }} className="w-0.5 bg-white rounded-full" />
                  <motion.div animate={{ height: [4, 2, 4] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }} className="w-0.5 bg-white rounded-full" />
                  <motion.div animate={{ height: [2, 5, 2] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }} className="w-0.5 bg-white rounded-full" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{currentTrack.title}</h3>
              <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
              <p className="text-xs text-muted-foreground/60 truncate">{currentTrack.album}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Playlists Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <FolderHeart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{lang === 'ru' ? 'Плейлисты' : 'Playlists'}</h3>
          <span className="text-xs text-muted-foreground ml-auto">{playlists.length}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {playlists.map((pl) => {
            const tracks = getPlaylistTracks(pl.id)
            const isExpanded = expandedPlaylist === pl.id

            return (
              <motion.div
                key={pl.id}
                layout
                className={`rounded-2xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden transition-colors ${
                  isExpanded ? 'col-span-1 sm:col-span-2 !border-primary/25' : 'hover:!border-primary/20'
                }`}
              >
                {/* Playlist header */}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => playPlaylist(pl.id)}
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden group"
                      style={{ backgroundColor: pl.color + '20' }}
                    >
                      <ListMusic className="w-5 h-5" style={{ color: pl.color }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Play className="w-4 h-4 text-white fill-current" />
                      </div>
                    </motion.button>

                    <div className="flex-1 min-w-0">
                      {editingPlaylist === pl.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-2 py-1 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:border-primary"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(pl.id)}
                          />
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSaveEdit(pl.id)}
                            className="p-1 rounded-lg bg-primary/10 text-primary"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </motion.button>
                        </div>
                      ) : (
                        <h4 className="text-sm font-semibold truncate" style={{ color: pl.color }}>{pl.name}</h4>
                      )}

                      {editingPlaylist === pl.id ? (
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                          className="w-full px-2 py-0.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:border-primary mt-1"
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">{pl.description || `${tracks.length} tracks`}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setAddingToPlaylist(addingToPlaylist === pl.id ? null : pl.id)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Add tracks"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setExpandedPlaylist(isExpanded ? null : pl.id)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                        title="Expand"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Expanded: playlist tracks */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border"
                    >
                      <div className="p-3 space-y-0.5">
                        {tracks.length > 0 ? tracks.map((track) => (
                          <div
                            key={track.id}
                            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary cursor-pointer group"
                            onClick={() => playTrack(track, tracks)}
                          >
                            <div
                              className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 overflow-hidden"
                              style={{ backgroundColor: track.color + '25' }}
                            >
                              <TrackArtwork
                                url={track.thumbnailUrl}
                                alt={track.title}
                                className="w-full h-full object-cover"
                                fallback={<Music className="w-3 h-3" style={{ color: track.color }} />}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{track.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground/40">{formatTime(track.duration)}</span>
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={(e) => { e.stopPropagation(); removeTrackFromPlaylist(pl.id, track.id) }}
                              className="p-1 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </motion.button>
                          </div>
                        )) : (
                          <p className="text-xs text-muted-foreground text-center py-3">{lang === 'ru' ? 'Пока нет треков. Добавьте!' : 'No tracks yet. Add some!'}</p>
                        )}
                      </div>

                      {/* Playlist footer actions */}
                      <div className="px-3 pb-3 flex gap-2">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleStartEdit(pl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          {lang === 'ru' ? 'Редактировать' : 'Edit'}
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { deletePlaylist(pl.id); setExpandedPlaylist(null) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          {lang === 'ru' ? 'Удалить' : 'Delete'}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add tracks to playlist */}
                <AnimatePresence>
                  {addingToPlaylist === pl.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border"
                    >
                      <div className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{lang === 'ru' ? 'Добавить треки в' : 'Add tracks to'} {pl.name}</p>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                          {allTracks
                            .filter((t) => !pl.trackIds.includes(t.id))
                            .map((track) => (
                              <div
                                key={track.id}
                                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary cursor-pointer group"
                              >
                                <div
                                  className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 overflow-hidden"
                                  style={{ backgroundColor: track.color + '25' }}
                                >
                                  <TrackArtwork
                                    url={track.thumbnailUrl}
                                    alt={track.title}
                                    className="w-full h-full object-cover"
                                    fallback={<Music className="w-3 h-3" style={{ color: track.color }} />}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{track.title}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                                </div>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => addTrackToPlaylist(pl.id, track.id)}
                                  className="p-1.5 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Plus className="w-3 h-3" />
                                </motion.button>
                              </div>
                            ))}
                        </div>
                        {allTracks.filter((t) => !pl.trackIds.includes(t.id)).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">{lang === 'ru' ? 'Все треки уже добавлены!' : 'All tracks already added!'}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Liked Songs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-4 h-4 text-primary fill-current" />
          <h3 className="text-sm font-semibold">{lang === 'ru' ? 'Избранные песни' : 'Liked Songs'}</h3>
          <span className="text-xs text-muted-foreground ml-auto">{likedTracks.length}</span>
          {likedTracks.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (likedTracks.length > 0) playTrack(likedTracks[0], likedTracks)
              }}
              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </motion.button>
          )}
        </div>

        {likedTracks.length > 0 ? (
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {likedTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer group"
                onClick={() => playTrack(track, likedTracks)}
              >
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: track.color + '30' }}>
                  <TrackArtwork
                    url={track.thumbnailUrl}
                    alt={track.title}
                    className="w-full h-full object-cover"
                    fallback={<Music className="w-3 h-3" style={{ color: track.color }} />}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{track.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                </div>
                <Play className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            {lang === 'ru' ? 'Пока нет избранных песен. Нажмите на сердечко!' : 'No liked songs yet. Tap the heart icon!'}
          </p>
        )}
      </motion.div>

      {/* All Tracks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-3xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <ListMusic className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{lang === 'ru' ? 'Все треки' : 'All Tracks'}</h3>
          <span className="text-xs text-muted-foreground ml-auto">{allTracks.length}</span>
        </div>

        {/* Downloaded / Imported tabs — same separation as My Library */}
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border mb-4">
          <button
            onClick={() => setTracksTab('downloaded')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tracksTab === 'downloaded'
                ? 'glass-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            {t.downloaded}
            {downloadedTracks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                {downloadedTracks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTracksTab('imported')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tracksTab === 'imported'
                ? 'glass-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderInput className="w-3.5 h-3.5" />
            {t.imported}
            {importedTracks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                {importedTracks.length}
              </span>
            )}
          </button>
        </div>

        {visibleTracks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {tracksTab === 'downloaded'
              ? (lang === 'ru' ? 'Пока нет скачанных треков' : 'No downloaded tracks yet')
              : (lang === 'ru' ? 'Пока нет импортированных треков' : 'No imported tracks yet')}
          </p>
        )}

        <TrackListControls search={trackSearch} onSearch={setTrackSearch} sort={trackSort} onSort={setTrackSort} lang={lang} />
        <VirtualList
          items={visibleTracks}
          itemHeight={60}
          maxHeight={384}
          renderItem={(track: any, index: number) => {
            const isCurrent = currentTrack?.id === track.id
            const isLiked = likedTrackIds.has(track.id)
            return (
              <motion.div
                key={track.id}
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer group transition-colors ${
                  isCurrent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-secondary'
                }`}
                onClick={() => playTrack(track, visibleTracks)}
              >
                <span className={`text-xs w-5 text-center flex-shrink-0 ${isCurrent ? 'text-primary font-bold' : 'text-muted-foreground/40'}`}>
                  {isCurrent && isPlaying ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                  ) : (
                    index + 1
                  )}
                </span>

                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: track.color + '25' }}
                >
                  <TrackArtwork
                    url={track.thumbnailUrl}
                    alt={track.title}
                    className="w-full h-full object-cover"
                    fallback={
                      <span className="text-xs font-bold" style={{ color: track.color }}>
                        {track.title.charAt(0)}
                      </span>
                    }
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isCurrent ? 'text-primary' : ''}`}>
                    {track.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                </div>

                <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">
                  {formatTime(track.duration)}
                </span>

                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => { e.stopPropagation(); toggleLike(track.id) }}
                  className={`p-1 flex-shrink-0 ${isLiked ? 'text-primary' : 'text-muted-foreground/20 opacity-0 group-hover:opacity-100'}`}
                >
                  <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
                </motion.button>
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <AddToPlaylistButton track={track} />
                </div>
              </motion.div>
            )
          }}
        />
      </motion.div>
    </div>
  )
}

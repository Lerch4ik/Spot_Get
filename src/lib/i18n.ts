export type Lang = 'en' | 'ru'

export const translations = {
  en: {
    // Sidebar
    download: 'Download',
    stats: 'Statistics',
    history: 'History',
    settings: 'Settings',
    player: 'Player',
    // DownloadPanel
    downloadMusic: 'Download Music',
    pasteLink: 'Paste a Spotify, YouTube or SoundCloud link',
    startDownload: 'Start Download',
    activeDownloads: 'Active Downloads',
    downloadedFiles: 'Downloaded Files',
    noActiveDownloads: 'No active downloads',
    noDownloadsYet: 'No downloads yet',
    // HistoryPanel
    downloadHistory: 'Download History',
    clearHistory: 'Clear History',
    exportHistory: 'Export History',
    importHistory: 'Import History',
    noHistory: 'No download history yet',
    // StatsPanel
    statistics: 'Statistics',
    exportStats: 'Export Stats',
    totalDownloads: 'Total Downloads',
    successRate: 'Success Rate',
    totalSize: 'Total Size',
    avgSpeed: 'Avg Speed',
    // SettingsPanel
    settingsTitle: 'Settings',
    outputDirectory: 'Output Directory',
    format: 'Format',
    bitrate: 'Bitrate',
    skipExisting: 'Skip Existing Files',
    saveSettings: 'Save Settings',
    // Library
    myLibrary: 'My Library',
    importLibrary: 'Import Library',
    importLibraryDesc: 'Select a folder with your music files',
    browseFolder: 'Browse Folder',
    libraryLoaded: 'Library loaded',
    tracks: 'tracks',
    downloaded: 'Downloaded',
    imported: 'Imported',
    noDownloadedTracks: 'No downloaded tracks yet',
    // Player
    nowPlaying: 'Now Playing',
    queue: 'Queue',
    // Footer
    connected: 'Connected',
    // Common
    cancel: 'Cancel',
    retry: 'Retry',
    remove: 'Remove',
    search: 'Search',
    close: 'Close',

    pasteUrlHelp: "Paste a track, album, playlist, or artist link",
    placeholderUrl: "https://open.spotify.com/...",
  },
  ru: {
    // Sidebar
    download: 'Скачать',
    stats: 'Статистика',
    history: 'История',
    settings: 'Настройки',
    player: 'Плеер',
    // DownloadPanel
    downloadMusic: 'Скачать музыку',
    pasteLink: 'Вставьте ссылку Spotify, YouTube или SoundCloud',
    startDownload: 'Начать загрузку',
    activeDownloads: 'Активные загрузки',
    downloadedFiles: 'Загруженные файлы',
    noActiveDownloads: 'Нет активных загрузок',
    noDownloadsYet: 'Нет загрузок',
    // HistoryPanel
    downloadHistory: 'История загрузок',
    clearHistory: 'Очистить историю',
    exportHistory: 'Экспорт истории',
    importHistory: 'Импорт истории',
    noHistory: 'История загрузок пуста',
    // StatsPanel
    statistics: 'Статистика',
    exportStats: 'Экспорт статистики',
    totalDownloads: 'Всего загрузок',
    successRate: 'Успешных',
    totalSize: 'Общий размер',
    avgSpeed: 'Средняя скорость',
    // SettingsPanel
    settingsTitle: 'Настройки',
    outputDirectory: 'Папка сохранения',
    format: 'Формат',
    bitrate: 'Битрейт',
    skipExisting: 'Пропускать существующие файлы',
    saveSettings: 'Сохранить настройки',
    // Library
    myLibrary: 'Моя библиотека',
    importLibrary: 'Импорт библиотеки',
    importLibraryDesc: 'Выберите папку с вашей музыкой',
    browseFolder: 'Выбрать папку',
    libraryLoaded: 'Библиотека загружена',
    tracks: 'треков',
    downloaded: 'Скачанные',
    imported: 'Импортированные',
    noDownloadedTracks: 'Пока нет скачанных треков',
    // Player
    nowPlaying: 'Сейчас играет',
    queue: 'Очередь',
    // Footer
    connected: 'Подключено',
    // Common
    cancel: 'Отмена',
    retry: 'Повторить',
    remove: 'Удалить',
    search: 'Поиск',
    close: 'Закрыть',

    pasteUrlHelp: "Вставьте ссылку на трек, альбом, плейлист или исполнителя",
    placeholderUrl: "https://open.spotify.com/...",
  }
}

export type TranslationKey = keyof typeof translations.en

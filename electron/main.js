// Prevent recursive spawning
if (process.env.ELECTRON_IS_CHILD) {
  process.exit(0)
}

const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, session } = require('electron')
const path = require('path')
const { spawn, execFile, execSync } = require('child_process')
const { StringDecoder } = require('string_decoder')
const fs = require('fs')
const http = require('http')
const os = require('os')
const { pathToFileURL } = require('url')

// Force Python and child processes to use UTF-8 on Windows
process.env.PYTHONUTF8 = "1"
process.env.PYTHONIOENCODING = "utf-8"

// ── Portable data root ──────────────────────────────────────────────
// Keep everything the app writes — binaries (spotdl/yt-dlp), ffmpeg + Deno,
// cookies, logs and config — inside a single "data" folder next to the
// executable. That way the uninstaller (which removes the install folder)
// wipes every file the app created, leaving nothing behind. Falls back to
// the OS userData dir when that folder isn't writable (e.g. a per-machine
// install into Program Files) or while running in dev.
let _TOOLS_HOME = null
;(function initPortableData() {
  if (!app.isPackaged) { _TOOLS_HOME = os.homedir(); return }
  try {
    const exeDir = path.dirname(app.getPath('exe'))
    const dataDir = path.join(exeDir, 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    const probe = path.join(dataDir, '.write-test')
    fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe)
    app.setPath('userData', dataDir)   // MUST run before electron-store is created
    _TOOLS_HOME = dataDir
    console.log('[portable] data dir:', dataDir)
  } catch (e) {
    console.error('[portable] not writable next to exe, using default userData:', e.message)
    _TOOLS_HOME = os.homedir()
  }
})()

// Home used only for locating/saving the app's tool runtimes (ffmpeg, Deno,
// ~/.spotdl). NOT the user's home — the Music output folder stays on the real
// profile.
function getToolsHome() {
  return _TOOLS_HOME || os.homedir()
}

// Child-process env for spotdl / yt-dlp: redirect HOME/USERPROFILE so spotdl
// downloads ffmpeg and Deno into <data>/.spotdl instead of the real profile.
function toolsEnv(extra) {
  const home = getToolsHome()
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    ...(extra || {}),
  }
}

const Store = require('electron-store')

const store = new Store({
  defaults: {
    settings: {
      outputDirectory: path.join(os.homedir(), 'Music', 'Spotget'),
      defaultFormat: 'mp3',
      defaultBitrate: '320k',
      skipExisting: true,
      scanThreads: 4,
      theme: 'dark',
    },
    history: []
  }
})

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const PORT = 3000
// Bind AND connect on the exact same literal IPv4 address. Using "localhost"
// on the client is the #1 cause of the black-screen bug on Windows: Node/Next
// binds the server to 127.0.0.1, but Chromium resolves "localhost" to IPv6
// ::1 first, which nothing is listening on → ECONNREFUSED → blank window.
const SERVER_HOST = '127.0.0.1'
const SERVER_URL = `http://${SERVER_HOST}:${PORT}`

// ── Crash safety: log everything fatal instead of dying silently ──
// (flog is defined below; fall back to console if it isn't ready yet)
function safeFlog(...parts) {
  try { flog(...parts) } catch (_) { console.error(...parts) }
}
process.on('uncaughtException', (err) => {
  safeFlog('[FATAL uncaughtException]', err?.stack || err?.message || String(err))
  try {
    dialog.showErrorBox('Spot — критическая ошибка',
      `${err?.message || err}\n\nПолный лог: ${(() => { try { return getLogFilePath() } catch (_) { return 'userData/logs/spot.log' } })()}`)
  } catch (_) {}
})
process.on('unhandledRejection', (reason) => {
  safeFlog('[FATAL unhandledRejection]', reason?.stack || reason?.message || String(reason))
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'spotget',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    }
  }
])

let mainWindow = null
let splashWindow = null
let nextServer = null

// Active downloads map: id -> { process, cancelled, pollInterval }
const activeDownloads = new Map()

function killProcessTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    try { execSync(`taskkill /F /T /PID ${pid}`, { timeout: 3000 }) } catch (_) {}
    try { execSync('taskkill /F /IM spotdl.exe /T', { timeout: 3000 }) } catch (_) {}
    try { execSync('taskkill /F /IM ffmpeg.exe /T', { timeout: 3000 }) } catch (_) {}
  } else {
    try { process.kill(-pid, 'SIGTERM') } catch (_) {}
    try { process.kill(-pid, 'SIGKILL') } catch (_) {}
  }
}

function killAllActive() {
  for (const [, entry] of activeDownloads) {
    if (entry.pollInterval) clearInterval(entry.pollInterval)
    if (entry.proc && entry.proc.pid) killProcessTree(entry.proc.pid)
  }
  activeDownloads.clear()
}

process.on('exit', () => { killAllActive() })

// ── Splash window ──
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420, height: 280, frame: false, transparent: false,
    resizable: false, center: true, skipTaskbar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: { contextIsolation: false, nodeIntegration: false },
  })
  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
  return new Promise(resolve => {
    splashWindow.webContents.once('did-finish-load', () => {
      splashWindow.webContents.executeJavaScript(`
        window.__retryTools = () => {
          window.dispatchEvent(new MessageEvent('message', { data: { type: 'reset', payload: null } }))
          window.dispatchEvent(new MessageEvent('message', { data: { type: 'progress', payload: 0 } }))
          window.dispatchEvent(new MessageEvent('message', { data: { type: 'status', payload: 'Retrying...' } }))
        }
      `).catch(() => {})
      resolve()
    })
  })
}

function splashSend(type, payload) {
  if (!splashWindow || splashWindow.isDestroyed()) return
  splashWindow.webContents.executeJavaScript(
    `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify({ type, payload })} }))`
  ).catch(() => {})
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
}

const crypto = require('crypto')

// ── Windows-safe spotget:// URL helpers ──
// IMPORTANT: the scheme is registered as `standard: true`, so Chromium applies
// full URL normalization. A URL like spotget:///C:/Users/... gets rewritten by
// Chromium into spotget://c/Users/... (drive letter parsed as hostname, colon
// dropped) which used to break playback with 404s. To survive normalization we
// use a dummy "file" host: spotget://file/C:/Users/file.mp3
// On Unix: /home/user/file.mp3 → spotget://file/home/user/file.mp3
function pathToSpotgetUrl(absolutePath) {
  if (!absolutePath) return null
  // Normalize all backslashes to forward slashes
  let normalized = absolutePath.replace(/\\/g, '/')

  // Handle Windows drive letters: "C:/Users/..."
  // The colon after the drive letter must NOT be encoded — it's safe inside
  // the path component and must round-trip exactly.
  const driveMatch = normalized.match(/^([a-zA-Z]):(.*)/)
  if (driveMatch) {
    const driveLetter = driveMatch[1]  // "C"
    const restOfPath  = driveMatch[2]  // "/Users/playa/Downloads/..."
    // Encode each path segment individually (spaces → %20, etc.) but NOT the colon
    const encodedSegments = restOfPath
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')
    return `spotget://file/${driveLetter}:${encodedSegments}`
  }

  // Non-Windows absolute paths: encode each segment (path starts with /)
  return `spotget://file/${normalized.split('/').filter(Boolean).map(seg => encodeURIComponent(seg)).join('/')}`
}

// Reverses pathToSpotgetUrl: converts a spotget:// URL back to a native file path.
// Handles ALL historical formats:
//   spotget://file/C:/Users/...   (current, with dummy host)
//   spotget:///C:/Users/...       (legacy triple-slash)
//   spotget://c/Users/...         (legacy after Chromium normalization: drive
//                                  letter swallowed as hostname, colon dropped)
//   spotget://file/home/user/...  (unix with dummy host)
function spotgetUrlToPath(spotgetUrl) {
  if (!spotgetUrl) return ''
  let raw = String(spotgetUrl).replace(/^spotget:\/\//i, '')
  // Strip the dummy "file" host if present
  if (/^file\//i.test(raw)) raw = raw.slice(5)
  // Strip any leading slashes: "/C:/..." → "C:/..."
  raw = raw.replace(/^\/+/, '')
  // Strip query/hash that Chromium may append
  raw = raw.split('?')[0].split('#')[0]
  // Decode URI components (%20 → space, Cyrillic, etc.)
  try { raw = decodeURIComponent(raw) } catch (_) {}
  // Recover drive letters mangled by Chromium host-parsing:
  // "c/Users/..." (single letter, no colon) → "c:/Users/..."
  if (/^[a-zA-Z]\//.test(raw)) raw = raw[0] + ':' + raw.slice(1)
  if (process.platform === 'win32') {
    raw = raw.replace(/\//g, '\\')
  } else if (!/^[a-zA-Z]:/.test(raw)) {
    // Unix absolute path lost its leading slash during stripping
    raw = '/' + raw
  }
  return path.normalize(raw)
}

// ── Auto-download tools ──
let _BIN_DIR = null
function getBinDir() {
  if (!_BIN_DIR) _BIN_DIR = path.join(app.getPath('userData'), 'bin')
  return _BIN_DIR
}

function getBinPath(name) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return path.join(getBinDir(), `${name}${ext}`)
}

function downloadFile(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('Too many redirects'))
    const https = require('https')
    const tmp = dest + '.tmp'
    const file = fs.createWriteStream(tmp)

    const cleanup = (cb) => {
      file.destroy()
      setImmediate(() => { try { fs.unlinkSync(tmp) } catch (_) {} ; if (cb) cb() })
    }

    https.get(url, { headers: { 'User-Agent': 'SpotGet/2.0' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume()
        cleanup(() => downloadFile(res.headers.location, dest, onProgress, redirects + 1).then(resolve).catch(reject))
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        cleanup(() => reject(new Error(`HTTP ${res.statusCode}`)))
        return
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let downloaded = 0
      res.on('data', chunk => {
        downloaded += chunk.length
        if (total && onProgress) onProgress(Math.floor(downloaded / total * 100))
      })
      res.pipe(file)
      file.on('finish', () => {
        file.close((err) => {
          if (err) return reject(err)
          try {
            fs.renameSync(tmp, dest)
            if (process.platform !== 'win32') {
              try { fs.chmodSync(dest, 0o755) } catch (_) {}
            }
            resolve()
          } catch (renameErr) {
            reject(renameErr)
          }
        })
      })
      file.on('error', err => cleanup(() => reject(err)))
    }).on('error', err => cleanup(() => reject(err)))
  })
}

async function ensureTools() {
  fs.mkdirSync(getBinDir(), { recursive: true })

  async function getSpotdlUrl() {
    return new Promise((resolve) => {
      const https = require('https')
      https.get(
        'https://api.github.com/repos/spotDL/spotify-downloader/releases/latest',
        { headers: { 'User-Agent': 'SpotGet/2.0', 'Accept': 'application/vnd.github+json' } },
        (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            try {
              const release = JSON.parse(data)
              const asset = release.assets?.find(a =>
                process.platform === 'win32'
                  ? a.name.includes('win32') && a.name.endsWith('.exe')
                  : a.name.includes('linux') && !a.name.endsWith('.exe')
              ) || release.assets?.find(a =>
                process.platform === 'win32' ? a.name.endsWith('.exe') : !a.name.endsWith('.exe')
              )
              resolve(asset?.browser_download_url || null)
            } catch (_) { resolve(null) }
          })
        }
      ).on('error', () => resolve(null))
    })
  }

  const TOOLS = [
    { name: 'spotdl', file: getBinPath('spotdl'), getUrl: getSpotdlUrl },
    {
      name: 'yt-dlp', file: getBinPath('yt-dlp'),
      getUrl: async () => process.platform === 'win32'
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    },
  ]

  function isValidBinary(filePath) {
    if (!fs.existsSync(filePath)) return false
    const sizeMB = fs.statSync(filePath).size / 1024 / 1024
    console.log(`[isValidBinary] ${path.basename(filePath)}: ${sizeMB.toFixed(1)} MB`)
    return sizeMB >= 1
  }

  for (let i = 0; i < TOOLS.length; i++) {
    const tool = TOOLS[i]
    const baseProgress = i * 45

    if (isValidBinary(tool.file)) {
      splashSend('tool', { name: tool.name, state: 'skip' })
      splashSend('progress', baseProgress + 45)
      continue
    }

    try { if (fs.existsSync(tool.file)) fs.unlinkSync(tool.file) } catch (_) {}

    splashSend('tool', { name: tool.name, state: 'loading' })
    splashSend('status', `Downloading ${tool.name}...`)

    try {
      const url = await tool.getUrl()
      if (!url) throw new Error('Could not resolve download URL')
      console.log(`[ensureTools] Downloading ${tool.name} from: ${url}`)
      await downloadFile(url, tool.file, (pct) => {
        splashSend('progress', baseProgress + Math.floor(pct * 0.45))
      })
      if (isValidBinary(tool.file)) {
        splashSend('tool', { name: tool.name, state: 'done' })
        splashSend('progress', baseProgress + 45)
        console.log(`[ensureTools] ${tool.name} OK at ${tool.file}`)
      } else {
        throw new Error(`Downloaded file too small`)
      }
    } catch (err) {
      console.error(`[ensureTools] Failed to download ${tool.name}:`, err.message)
      splashSend('tool', { name: tool.name, state: 'error' })
      splashSend('status', `${tool.name} unavailable — will retry next launch`)
      splashSend('progress', baseProgress + 45)
      await new Promise(r => setTimeout(r, 1500))
    }
  }
}

// ── File logging ──
// Everything important is duplicated into userData/logs/spot.log so users can
// attach it when reporting problems. Survives app restarts (append mode).
let _logStream = null
function getLogFilePath() {
  return path.join(app.getPath('userData'), 'logs', 'spot.log')
}
function flog(...parts) {
  const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
  console.log(line)
  try {
    if (!_logStream) {
      const logDir = path.join(app.getPath('userData'), 'logs')
      fs.mkdirSync(logDir, { recursive: true })
      _logStream = fs.createWriteStream(getLogFilePath(), { flags: 'a' })
      _logStream.write(`\n──── session start ${new Date().toISOString()} ────\n`)
    }
    _logStream.write(`[${new Date().toISOString().substring(11, 19)}] ${line}\n`)
  } catch (_) { /* logging must never crash the app */ }
}

// ── Spotify oEmbed: fetch the real playlist/album/track name ──
// spotdl's console output mangles non-ASCII (Cyrillic) names on Windows, so we
// ask Spotify's public oEmbed endpoint instead — it returns proper UTF-8 JSON
// and needs no authentication.
function fetchSpotifyTitle(spotifyUrl) {
  return new Promise((resolve) => {
    try {
      const https = require('https')
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`
      const req = https.get(oembedUrl, { timeout: 8000 }, (res) => {
        let body = ''
        res.on('data', (d) => { body += d })
        res.on('end', () => {
          try {
            const json = JSON.parse(body)
            resolve(json && json.title ? String(json.title) : null)
          } catch (_) { resolve(null) }
        })
      })
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    } catch (_) { resolve(null) }
  })
}

// ── Provision spotdl runtime deps (ffmpeg + Deno) ──
// spotdl 4.5+ needs Deno to solve YouTube's JS challenge; without it every
// YouTube download fails with "AudioProviderError: YT-DLP download error /
// Some YouTube downloads require Deno". ffmpeg is needed to convert/tag the
// audio. spotdl can fetch both into its own data dir via CLI flags, so we
// trigger that once and remember success with a marker file.
let _spotdlDepsPromise = null
function ensureSpotdlDeps(onStatus) {
  if (_spotdlDepsPromise) return _spotdlDepsPromise
  _spotdlDepsPromise = (async () => {
    const spotdlBin = findSpotdl()
    if (!spotdlBin) {
      console.warn('[ensureSpotdlDeps] spotdl not found, skipping')
      return
    }

    const runFlag = (flag, markerName, label, timeoutMs) =>
      new Promise((resolve) => {
        const marker = path.join(getBinDir(), markerName)
        if (fs.existsSync(marker)) return resolve()
        if (onStatus) onStatus(label)
        console.log(`[ensureSpotdlDeps] running spotdl ${flag} ...`)
        let done = false
        const finish = (ok) => {
          if (done) return
          done = true
          if (ok) { try { fs.writeFileSync(marker, 'ok') } catch (_) {} }
          resolve()
        }
        let proc
        try {
          proc = spawn(spotdlBin, [flag], {
            env: toolsEnv({
              PYTHONIOENCODING: 'utf-8',
              PYTHONUTF8: '1',
              PYTHONUNBUFFERED: '1',
            }),
          })
        } catch (e) {
          console.error(`[ensureSpotdlDeps] spawn failed for ${flag}:`, e.message)
          return finish(false)
        }
        const onOutput = (d) => {
          const text = String(d)
          console.log(`[spotdl ${flag}]`, text.trim())
          // spotdl asks "... is already installed. Do you want to overwrite it? (y/N):"
          // Answer "n" automatically — already installed means we're done.
          if (/already installed/i.test(text) || /\(y\/N\)/i.test(text)) {
            try { proc.stdin && proc.stdin.write('n\n') } catch (_) {}
            // Already present — mark as ready and stop waiting
            finish(true)
            try { proc.kill() } catch (_) {}
          }
        }
        proc.stdout && proc.stdout.on('data', onOutput)
        proc.stderr && proc.stderr.on('data', onOutput)
        proc.on('close', (code) => finish(code === 0))
        proc.on('error', () => finish(false))
        setTimeout(() => { try { proc && proc.kill() } catch (_) {} ; finish(false) }, timeoutMs)
      })

    console.log('[ensureSpotdlDeps] provisioning ffmpeg + Deno...')
    await runFlag('--download-ffmpeg', '.ffmpeg-ready', 'Setting up audio converter...', 240000)
    await runFlag('--download-deno',   '.deno-ready',   'Setting up YouTube downloader...', 240000)
    console.log('[ensureSpotdlDeps] done')
  })()
  return _spotdlDepsPromise
}

// ── Find binaries ──
function findSpotdl() {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const name = `spotdl${ext}`
  const userBin = path.join(app.getPath('userData'), 'bin', name)
  if (fs.existsSync(userBin)) return userBin
  if (app.isPackaged) {
    const resBin = path.join(process.resourcesPath, 'bin', name)
    if (fs.existsSync(resBin)) return resBin
  }
  if (!app.isPackaged) {
    const devBin = path.join(__dirname, '..', 'bin', name)
    if (fs.existsSync(devBin)) return devBin
  }
  return null
}

function findYtdlp() {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const name = `yt-dlp${ext}`
  const userBin = path.join(app.getPath('userData'), 'bin', name)
  if (fs.existsSync(userBin)) return userBin
  if (app.isPackaged) {
    const resBin = path.join(process.resourcesPath, 'bin', name)
    if (fs.existsSync(resBin)) return resBin
  }
  if (!app.isPackaged) {
    const devBin = path.join(__dirname, '..', 'bin', name)
    if (fs.existsSync(devBin)) return devBin
  }
  return null
}

function detectUrlPlatform(url) {
  if (/spotify\.com/i.test(url))           return 'spotify'
  if (/music\.apple\.com/i.test(url))      return 'apple'
  if (/music\.yandex\.(ru|com)/i.test(url)) return 'yandex'
  if (/soundcloud\.com/i.test(url))        return 'soundcloud'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  return 'unknown'
}

// ── Start embedded Next.js server ──
function startNextServer() {
  if (isDev) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const serverPath = path.join(process.resourcesPath, 'standalone', 'server.js')
    // Launch the standalone Next server with Electron's OWN bundled Node
    // runtime (process.execPath + ELECTRON_RUN_AS_NODE=1) instead of a bare
    // `node`. End users don't have Node.js installed, so `spawn('node', ...)`
    // fails with ENOENT on a clean machine and the window stays black. Running
    // the Electron binary in "run as node" mode guarantees a Node runtime.
    if (!fs.existsSync(serverPath)) {
      safeFlog('[Next] server.js NOT FOUND at', serverPath)
      return reject(new Error('standalone/server.js missing'))
    }
    safeFlog('[Next] starting server:', serverPath)
    nextServer = spawn(process.execPath, [serverPath], {
      cwd: path.join(process.resourcesPath, 'standalone'),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(PORT),
        HOSTNAME: SERVER_HOST,
      },
      stdio: 'pipe',
    })
    let resolved = false
    const done = () => { if (!resolved) { resolved = true; clearInterval(poll); resolve() } }
    nextServer.stdout.on('data', (data) => {
      const text = data.toString('utf8')
      safeFlog('[Next]', text.trim())
      if (text.includes('Ready') || text.includes('started') || text.includes('Listening')) done()
    })
    nextServer.stderr.on('data', (data) => { safeFlog('[Next:err]', data.toString('utf8').trim()) })
    nextServer.on('error', (err) => { safeFlog('[Next] spawn error:', err?.message); reject(err) })
    nextServer.on('exit', (code) => { safeFlog('[Next] server process exited with code', String(code)) })
    const poll = setInterval(() => {
      http.get(SERVER_URL, (res) => {
        if (res.statusCode < 500) { done() }
      }).on('error', () => {})
    }, 500)
    setTimeout(() => { done() }, 30000)
  })
}

// ── Create main window ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, webSecurity: false,
    },
    icon: path.join(__dirname, 'icon.ico'),  // Windows app window + taskbar icon
    show: false, titleBarStyle: 'hidden',
  })
  mainWindow.loadURL(SERVER_URL)
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximizeChanged', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximizeChanged', false))
  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })

  // In dev the Next server may still be compiling when we load — retry instead
  // of leaving a dead white window. Every failure is logged to spot.log.
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    safeFlog(`[window] did-fail-load code=${code} desc=${desc} url=${url} — retrying in 1.5s`)
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(SERVER_URL)
      }
    }, 1500)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    safeFlog('[window] render-process-gone:', JSON.stringify(details))
  })
  // ── Reload-loop detector ──
  // In dev, HMR full-reloads happen when the Next watcher keeps seeing file
  // changes (OneDrive/antivirus touching the project folder, stale .next from
  // a previous production build, etc.). If we see too many reloads in a short
  // window, warn the user with concrete fixes instead of looping forever.
  let loadTimestamps = []
  let loopWarned = false
  mainWindow.webContents.on('did-finish-load', () => {
    safeFlog('[window] did-finish-load OK, url=', mainWindow?.webContents?.getURL?.())
    const now = Date.now()
    loadTimestamps = loadTimestamps.filter((t) => now - t < 15000)
    loadTimestamps.push(now)
    if (isDev && !loopWarned && loadTimestamps.length >= 8) {
      loopWarned = true
      safeFlog('[window] RELOAD LOOP DETECTED: ' + loadTimestamps.length + ' reloads in 15s')
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Spot — цикл перезагрузок',
        message: 'Обнаружен цикл перезагрузок дев-сервера Next.js',
        detail:
          'Файлы проекта постоянно "меняются", и дев-сервер бесконечно пересобирается.\n\n' +
          'Как исправить:\n' +
          '1. Закройте приложение, удалите папку .next в проекте и запустите снова.\n' +
          '2. Если проект лежит в Downloads/OneDrive — переместите его в папку без синхронизации (например, C:\\dev\\spot).\n' +
          '3. Либо запускайте стабильный режим без пересборок: npm run electron:stable',
      })
    }
  })

  // ── Deep diagnostics: mirror the renderer console + navigations into spot.log ──
  // This is what reveals WHY the page reload-loops (error text, who navigates).
  const levelNames = ['debug', 'info', 'warn', 'error']
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const lvl = levelNames[level] || level
    safeFlog(`[renderer:${lvl}] ${message} (${(sourceId || '').split('/').pop()}:${line})`)
  })
  mainWindow.webContents.on('did-start-navigation', (_e, url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) safeFlog('[window] did-start-navigation →', url)
  })
  mainWindow.webContents.on('will-navigate', (_e, url) => {
    safeFlog('[window] will-navigate →', url)
  })
  mainWindow.webContents.on('unresponsive', () => safeFlog('[window] renderer unresponsive'))
}

// ── IPC: Window controls ──
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

// ── IPC: File system ──
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('shell:openFolder', async (_, folderPath) => {
  if (fs.existsSync(folderPath)) {
    shell.openPath(folderPath)
    return true
  }
  return false
})
ipcMain.handle('shell:showItemInFolder', async (_, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath)
    return true
  }
  return false
})

// ── IPC: electron-store ──
ipcMain.handle('store:get', (_, key) => store.get(key))
ipcMain.handle('store:set', (_, key, val) => { store.set(key, val) })

// ── IPC: YouTube cookies (bot-check bypass) ──
// The ONLY reliable way past YouTube's "Sign in to confirm you're not a bot"
// wall on a flagged IP is real account cookies. Rather than making a
// non-technical user install a browser extension and export cookies.txt, we
// open a real login window INSIDE the app (Electron's own Chromium), let them
// sign in once, then read the cookies straight out of that session and write
// them to cookies.txt automatically. Zero manual steps.
function getCookiesPath() {
  return path.join(app.getPath('userData'), 'cookies.txt')
}
function hasCookies() {
  try {
    const p = getCookiesPath()
    return fs.existsSync(p) && fs.statSync(p).size > 0
  } catch (_) { return false }
}

// Dedicated persistent session so the YouTube login is isolated from the app
// and survives restarts (the user only logs in once).
function getYtSession() {
  return session.fromPartition('persist:youtube')
}

// Serialize Electron cookie objects → Netscape cookies.txt (what yt-dlp reads).
async function exportCookiesToNetscape() {
  const ytSession = getYtSession()
  // Collect cookies for every Google/YouTube domain that matters.
  const domains = ['youtube.com', 'google.com', '.youtube.com', '.google.com']
  const seen = new Map()
  for (const url of ['https://www.youtube.com', 'https://youtube.com', 'https://accounts.google.com', 'https://google.com']) {
    try {
      const cookies = await ytSession.cookies.get({ url })
      for (const c of cookies) seen.set(`${c.domain}|${c.name}`, c)
    } catch (_) {}
  }
  // Also grab everything the session knows (covers subdomains like music.*)
  try {
    const all = await ytSession.cookies.get({})
    for (const c of all) {
      if (/youtube\.com$|google\.com$/i.test(c.domain || '')) seen.set(`${c.domain}|${c.name}`, c)
    }
  } catch (_) {}

  const lines = ['# Netscape HTTP Cookie File', '# Generated by Spot', '']
  let count = 0
  let hasAuth = false
  for (const c of seen.values()) {
    const domain = c.domain.startsWith('.') ? c.domain : c.domain
    const includeSub = c.domain.startsWith('.') ? 'TRUE' : 'FALSE'
    const cpath = c.path || '/'
    const secure = c.secure ? 'TRUE' : 'FALSE'
    // Session cookies (no expiry) → give them a far-future expiry so yt-dlp keeps them.
    const expiry = c.expirationDate ? Math.floor(c.expirationDate) : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
    lines.push([domain, includeSub, cpath, secure, expiry, c.name, c.value].join('\t'))
    count++
    if (/^(SID|SAPISID|__Secure-3PSID|LOGIN_INFO)$/i.test(c.name)) hasAuth = true
  }
  if (count === 0) return { success: false, error: 'no-cookies' }
  fs.writeFileSync(getCookiesPath(), lines.join('\n'), 'utf-8')
  flog(`[cookies] exported ${count} cookies from login session (auth cookies present: ${hasAuth})`)
  return { success: true, count, hasAuth }
}

ipcMain.handle('cookies:status', () => ({ hasCookies: hasCookies(), path: getCookiesPath() }))

// Open an in-app YouTube login window. Resolves once the user is signed in
// (detected by the presence of auth cookies) and cookies have been exported.
let ytLoginWindow = null
ipcMain.handle('cookies:login', async () => {
  if (ytLoginWindow && !ytLoginWindow.isDestroyed()) {
    ytLoginWindow.focus()
    return { success: false, error: 'already-open' }
  }
  return await new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      try { if (ytLoginWindow && !ytLoginWindow.isDestroyed()) ytLoginWindow.close() } catch (_) {}
      resolve(result)
    }

    ytLoginWindow = new BrowserWindow({
      width: 520,
      height: 680,
      parent: mainWindow || undefined,
      modal: false,
      title: 'Вход в YouTube',
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:youtube',
        // A real desktop Chrome UA so Google shows the normal login form.
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // Poll for auth cookies; when the user finishes signing in, export + close.
    const ytSession = getYtSession()
    const poll = setInterval(async () => {
      try {
        const cookies = await ytSession.cookies.get({ url: 'https://www.youtube.com' })
        const signedIn = cookies.some((c) => /^(SID|__Secure-3PSID|LOGIN_INFO)$/i.test(c.name))
        if (signedIn) {
          clearInterval(poll)
          const res = await exportCookiesToNetscape()
          flog('[cookies] login detected, export result:', JSON.stringify(res))
          finish(res.success ? { success: true, count: res.count } : { success: false, error: res.error })
        }
      } catch (_) {}
    }, 1500)

    ytLoginWindow.on('closed', () => {
      clearInterval(poll)
      ytLoginWindow = null
      // If closed before sign-in, still try a final export (maybe they were
      // already logged in from a previous session).
      exportCookiesToNetscape()
        .then((res) => finish(res.success && res.hasAuth ? { success: true, count: res.count } : { success: false, error: 'cancelled' }))
        .catch(() => finish({ success: false, error: 'cancelled' }))
    })

    ytLoginWindow.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/')
    flog('[cookies] opened YouTube login window')
  })
})

ipcMain.handle('cookies:clear', async () => {
  try { fs.existsSync(getCookiesPath()) && fs.unlinkSync(getCookiesPath()) } catch (_) {}
  // Also wipe the login session so "Remove" fully logs the user out.
  try { await getYtSession().clearStorageData() } catch (_) {}
  return { success: true }
})

// ── IPC: Export / Import ──
ipcMain.handle('export:history', async (_, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Download History',
    defaultPath: path.join(app.getPath('downloads'), 'spotget-history.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return false
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('[export:history]', err)
    return false
  }
})

ipcMain.handle('import:history', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Download History',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    console.error('[import:history]', err)
    return null
  }
})

ipcMain.handle('export:stats', async (_, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Download Stats',
    defaultPath: path.join(app.getPath('downloads'), 'spotget-stats.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return false
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('[export:stats]', err)
    return false
  }
})

// ── Module-level artwork extractor (used by library scanner + download handler) ──
function extractArtworkFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    const buf = fs.readFileSync(filePath)

    // ── ID3v2 (MP3) ──
    if (buf.length > 10 && buf.slice(0, 3).toString('ascii') === 'ID3') {
      const ver = buf[3]
      const id3Size =
        ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) |
        ((buf[8] & 0x7f) << 7)  |  (buf[9] & 0x7f)
      let offset = 10
      if (buf[5] & 0x40) {
        const extSize = ((buf[10] & 0x7f) << 21) | ((buf[11] & 0x7f) << 14) |
                        ((buf[12] & 0x7f) << 7)  |  (buf[13] & 0x7f)
        offset += extSize
      }
      const end = Math.min(10 + id3Size, buf.length)
      while (offset + 10 < end) {
        const frameId = buf.slice(offset, offset + 4).toString('ascii')
        if (frameId === '\0\0\0\0') break
        let frameSize
        if (ver >= 4) {
          frameSize = ((buf[offset+4] & 0x7f) << 21) | ((buf[offset+5] & 0x7f) << 14) |
                      ((buf[offset+6] & 0x7f) << 7)  |  (buf[offset+7] & 0x7f)
        } else {
          frameSize = (buf[offset+4] << 24) | (buf[offset+5] << 16) |
                      (buf[offset+6] << 8)  |  buf[offset+7]
        }
        if (frameSize <= 0 || frameSize > end - offset - 10) break
        offset += 10
        if (frameId === 'APIC' && frameSize > 4) {
          // Robust approach: instead of walking the encoding/mime/description
          // fields (which breaks on UTF-16 descriptions — they contain 0x00
          // bytes and use a double-null terminator), scan the frame body for
          // the actual image signature. Bulletproof for every encoding.
          const frame = buf.slice(offset, offset + frameSize)
          const jpgIdx = frame.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
          const pngIdx = frame.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
          let imgStart = -1
          let mime = 'image/jpeg'
          if (jpgIdx !== -1 && (pngIdx === -1 || jpgIdx < pngIdx)) {
            imgStart = jpgIdx
          } else if (pngIdx !== -1) {
            imgStart = pngIdx
            mime = 'image/png'
          }
          if (imgStart !== -1) {
            const imgBuf = frame.slice(imgStart)
            return `data:${mime};base64,${imgBuf.toString('base64')}`
          }
        }
        offset += frameSize
      }

      // Last-resort for malformed ID3 tags: scan the whole tag area for an
      // image signature (padding after EOI is tolerated by browsers).
      const tagArea = buf.slice(10, end)
      const jIdx = tagArea.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
      const pIdx = tagArea.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      if (jIdx !== -1 && (pIdx === -1 || jIdx < pIdx)) {
        return `data:image/jpeg;base64,${tagArea.slice(jIdx).toString('base64')}`
      }
      if (pIdx !== -1) {
        return `data:image/png;base64,${tagArea.slice(pIdx).toString('base64')}`
      }
    }

    // ── FLAC ──
    if (buf.length > 4 && buf.slice(0, 4).toString('ascii') === 'fLaC') {
      let offset = 4
      while (offset + 4 < buf.length) {
        const blockHeader = buf[offset]
        const blockType = blockHeader & 0x7f
        const isLast   = (blockHeader & 0x80) !== 0
        const blockSize =
          (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]
        offset += 4
        if (blockType === 6 && blockSize > 8) {
          let i = offset
          i += 4
          const mimeLen = buf.readUInt32BE(i); i += 4
          const mime = buf.slice(i, i + mimeLen).toString('ascii'); i += mimeLen
          const descLen = buf.readUInt32BE(i); i += 4 + descLen
          i += 16
          const dataLen = buf.readUInt32BE(i); i += 4
          const imgBuf  = buf.slice(i, i + dataLen)
          return `data:${mime || 'image/jpeg'};base64,${imgBuf.toString('base64')}`
        }
        offset += blockSize
        if (isLast) break
      }
    }

    // ── M4A / MP4 (iTunes 'covr' atom) ──
    // Scan for the 'covr' atom, then read its nested 'data' atom payload.
    // A linear scan is safe because atom names are 4 ASCII bytes and we
    // validate the structure before extracting.
    if (buf.length > 12 && buf.slice(4, 8).toString('ascii') === 'ftyp') {
      let idx = buf.indexOf('covr')
      while (idx !== -1 && idx + 24 < buf.length) {
        // The 'data' atom should follow: [size:4]['data':4][type:4][locale:4][payload]
        const dataIdx = buf.indexOf('data', idx)
        if (dataIdx !== -1 && dataIdx - idx < 16 && dataIdx + 12 < buf.length) {
          const dataSize = buf.readUInt32BE(dataIdx - 4)
          const payloadStart = dataIdx + 12
          const payloadEnd = dataIdx - 4 + dataSize
          if (dataSize > 16 && payloadEnd <= buf.length) {
            const imgBuf = buf.slice(payloadStart, payloadEnd)
            // Validate image signature: JPEG (FFD8) or PNG (8950)
            if (imgBuf[0] === 0xff && imgBuf[1] === 0xd8) {
              return `data:image/jpeg;base64,${imgBuf.toString('base64')}`
            }
            if (imgBuf[0] === 0x89 && imgBuf[1] === 0x50) {
              return `data:image/png;base64,${imgBuf.toString('base64')}`
            }
          }
        }
        idx = buf.indexOf('covr', idx + 4)
      }
    }
  } catch (err) {
    try { flog('[extractArtwork] error for', filePath, ':', err.message) } catch (_) {}
  }
  try { flog('[extractArtwork] no embedded artwork found in', path.basename(filePath)) } catch (_) {}
  return null
}

// ── Locate ffmpeg for the yt-dlp fallback ──
// spotdl --download-ffmpeg saves it into ~/.spotdl/. Also check our bin dir and PATH.
function findFfmpeg() {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const candidates = [
    path.join(getToolsHome(), '.spotdl', `ffmpeg${ext}`),
    path.join(os.homedir(), '.spotdl', `ffmpeg${ext}`), // legacy real-home location
    path.join(getBinDir(), `ffmpeg${ext}`),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch (_) {}
  }
  return null // yt-dlp will try PATH by itself
}

// ── Locate Deno for yt-dlp's JS challenge solver ──
// Without a JS runtime YouTube flags the client as a bot ("Sign in to confirm
// you're not a bot"). spotdl's --download-deno saves deno into ~/.spotdl/.
function findDeno() {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const candidates = [
    path.join(getToolsHome(), '.spotdl', `deno${ext}`),
    path.join(getToolsHome(), '.deno', 'bin', `deno${ext}`),
    path.join(os.homedir(), '.spotdl', `deno${ext}`),        // legacy real-home location
    path.join(os.homedir(), '.deno', 'bin', `deno${ext}`),
    path.join(getBinDir(), `deno${ext}`),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch (_) {}
  }
  return null
}

// ── Detect installed browsers to source YouTube cookies from ──
// YouTube's bot-check is bypassed by sending real browser cookies
// (--cookies-from-browser). Firefox first: its cookie DB is always readable,
// while Chrome/Edge use app-bound encryption yt-dlp can't always crack.
function detectCookieBrowsers() {
  const home = os.homedir()
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
  const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const candidates = process.platform === 'win32' ? [
    ['firefox', path.join(roaming, 'Mozilla', 'Firefox', 'Profiles')],
    ['chrome',  path.join(local, 'Google', 'Chrome', 'User Data')],
    ['edge',    path.join(local, 'Microsoft', 'Edge', 'User Data')],
    ['brave',   path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
    ['opera',   path.join(roaming, 'Opera Software', 'Opera Stable')],
    ['vivaldi', path.join(local, 'Vivaldi', 'User Data')],
  ] : [
    ['firefox', path.join(home, '.mozilla', 'firefox')],
    ['chrome',  path.join(home, '.config', 'google-chrome')],
    ['chromium', path.join(home, '.config', 'chromium')],
  ]
  const found = []
  for (const [name, dir] of candidates) {
    try { if (fs.existsSync(dir)) found.push(name) } catch (_) {}
  }
  return found
}

// ── yt-dlp self-update (once per app session) ──
// YouTube breaks old yt-dlp builds constantly; spotdl bundles its own copy
// that we can't update, but our standalone yt-dlp.exe CAN self-update and
// serves as the fallback downloader.
let _ytdlpUpdated = false
function updateYtdlp(ytdlpBin) {
  return new Promise((resolve) => {
    if (_ytdlpUpdated) return resolve()
    _ytdlpUpdated = true
    flog('[yt-dlp] self-updating to nightly (freshest YouTube fixes)...')
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    try {
      // Nightly channel ships YouTube extractor fixes days before stable —
      // essential since YouTube changes its bot-check frequently.
  const proc = spawn(ytdlpBin, ['--update-to', 'nightly'], { env: toolsEnv() })
  proc.stdout.on('data', (d) => flog('[yt-dlp update]', String(d).trim()))
      proc.stderr.on('data', (d) => flog('[yt-dlp update err]', String(d).trim()))
      proc.on('close', finish)
      proc.on('error', finish)
      setTimeout(() => { try { proc.kill() } catch (_) {} ; finish() }, 120000)
    } catch (_) { finish() }
  })
}

// ── Folder artwork fallback: cover.jpg / folder.jpg / <basename>.jpg next to the track ──
function findFolderArtwork(audioFilePath) {
  try {
    const dir = path.dirname(audioFilePath)
    const base = path.basename(audioFilePath, path.extname(audioFilePath))
    const candidates = [
      `${base}.jpg`, `${base}.jpeg`, `${base}.png`,
      'cover.jpg', 'cover.jpeg', 'cover.png',
      'folder.jpg', 'folder.jpeg', 'folder.png',
      'front.jpg', 'front.png', 'albumart.jpg', 'AlbumArt.jpg', 'AlbumArtSmall.jpg',
    ]
    for (const name of candidates) {
      const p = path.join(dir, name)
      if (fs.existsSync(p)) {
        const imgBuf = fs.readFileSync(p)
        const mime = (imgBuf[0] === 0x89 && imgBuf[1] === 0x50) ? 'image/png' : 'image/jpeg'
        return `data:${mime};base64,${imgBuf.toString('base64')}`
      }
    }
  } catch (_) {}
  return null
}

// ── App-owned cache dirs (kept OUT of the user's music folder) ──
// Artwork thumbnails and fallback temp downloads used to be written as hidden
// .spotget-art / .spotget-fb folders next to the music. That cluttered the
// user's library folder, so both now live in the app's data directory instead.
function getArtCacheDir() {
  const dir = path.join(app.getPath('userData'), 'artwork-cache')
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) } catch (_) {}
  return dir
}
function getFallbackTmpDir() {
  const dir = path.join(app.getPath('userData'), 'fallback-tmp')
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) } catch (_) {}
  return dir
}
// Remove legacy hidden cache folders left inside a music/output directory by
// older versions so existing users' folders get cleaned automatically.
function cleanupLegacyCacheFolders(dir) {
  if (!dir) return
  for (const name of ['.spotget-fb', '.spotget-art']) {
    try { fs.rmSync(path.join(dir, name), { recursive: true, force: true }) } catch (_) {}
  }
}

// ── Save artwork data-URI to the app artwork cache, return spotget:// URL ──
function saveArtworkToFile(dataUri, trackId, artDir = getArtCacheDir()) {
  try {
    if (!dataUri) return null
    if (!fs.existsSync(artDir)) fs.mkdirSync(artDir, { recursive: true })
    const ext = dataUri.startsWith('data:image/png') ? '.png' : '.jpg'
    // Sanitize trackId for use as filename: decode URI components first,
    // then replace any remaining unsafe characters. This prevents double-encoding
    // when trackId contains %3A, %5C etc. from encodeURIComponent.
    const safeName = decodeURIComponent(trackId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100)
    const artFile = path.join(artDir, `${safeName}${ext}`)
    const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(artFile, Buffer.from(base64Data, 'base64'))
    return pathToSpotgetUrl(artFile)
  } catch (_) { return null }
}

// ── Imported library ────────────────────────────────────────────────
// The "Imported" tab is completely independent of the download folder. It
// simply reads the audio files found in a folder the user picks, IN PLACE
// (nothing is copied anywhere). The chosen folder is persisted so it can be
// re-scanned automatically on the next launch.
const musicExts = ['.mp3', '.flac', '.ogg', '.wav', '.m4a']

// Scan a folder recursively and return track objects for every audio file.
function scanMusicFolder(rootDir) {
  const tracks = []
  if (!rootDir || !fs.existsSync(rootDir)) return tracks
  const artDir = getArtCacheDir()

  function scan(dir) {
    let list
    try { list = fs.readdirSync(dir) } catch (_) { return }
    for (const file of list) {
      const fullPath = path.join(dir, file)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          if (file === '.spotget-art' || file === '.spotget-fb') continue
          scan(fullPath)
        } else if (musicExts.includes(path.extname(file).toLowerCase())) {
          const name = path.basename(file, path.extname(file))
          // Files are commonly named "Artist - Title.ext" (artist first).
          const idx = name.indexOf(' - ')
          const artist = idx >= 0 ? name.substring(0, idx).trim() : 'Unknown Artist'
          const title  = idx >= 0 ? name.substring(idx + 3).trim() : name
          const ext = path.extname(file).toLowerCase().replace('.', '')
          const trackId = `lib-${crypto.createHash('md5').update(fullPath).digest('hex')}`

          let thumbnailUrl = ''
          try {
            const artworkDataUri = extractArtworkFromFile(fullPath) || findFolderArtwork(fullPath)
            if (artworkDataUri) {
              const saved = saveArtworkToFile(artworkDataUri, trackId, artDir)
              if (saved) thumbnailUrl = saved
            }
          } catch (_) {}

          tracks.push({
            id: trackId,
            title,
            artist,
            album: 'Imported',
            duration: 0,
            thumbnailUrl,
            audioUrl: pathToSpotgetUrl(fullPath),
            filePath: fullPath,
            format: ext.toUpperCase(),
            color: '#1ed760',
          })
        }
      } catch (_) {}
    }
  }

  scan(rootDir)
  return tracks
}

// Load the previously imported folder (if any) on startup.
ipcMain.handle('library:getDir', () => {
  const importFolder = store.get('importFolder') || null
  if (!importFolder || !fs.existsSync(importFolder)) {
    return { success: true, tracks: [], folder: null }
  }
  const tracks = scanMusicFolder(importFolder)
  return { success: true, tracks, folder: importFolder }
})

// Let the user pick a folder to import from. Reads it in place (no copying)
// and remembers it for next time.
ipcMain.handle('library:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder to import music from',
    properties: ['openDirectory'],
  })

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    const prev = store.get('importFolder') || null
    return { success: false, tracks: prev ? scanMusicFolder(prev) : [], folder: prev }
  }

  const importFolder = result.filePaths[0]
  store.set('importFolder', importFolder)
  const tracks = scanMusicFolder(importFolder)
  return { success: true, tracks, folder: importFolder }
})

// Helper to pre-detect spotdl track count for playlists/albums
function getSpotdlTrackCount(spotdlBin, url) {
  return new Promise((resolve) => {
    // Run spotdl url --query "[url]" with no download to see how many tracks it resolves
    // or run a fast dry-run. Actually we can do an exec with meta-only:
    // "spotdl url --dry-run"
  const proc = spawn(spotdlBin, [url, '--dry-run', '--log-level', 'INFO'], {
    env: toolsEnv({ PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', LANG: 'ru_RU.UTF-8', LC_ALL: 'ru_RU.UTF-8' })
  })

    proc.stdout.setEncoding('utf-8');
    proc.stderr.setEncoding('utf-8');

    const decoder = new StringDecoder('utf8');
    let out = ''
    proc.stdout.on('data', d => out += decoder.write(d))
    proc.stderr.on('data', d => out += decoder.write(d))
    proc.on('close', () => {
      out += decoder.end()
      // Look for logs like "Found X songs in ..."
      const match = out.match(/Found (\d+) songs/i)
      if (match) {
        resolve(parseInt(match[1], 10))
      } else {
        resolve(null)
      }
    })
    // safety timeout
    setTimeout(() => {
      try { proc.kill() } catch(_) {}
      resolve(null)
    }, 8000)
  })
}

// Map child-track id to parent-download id
const trackToParentMap = new Map()
function resolveDownloadParentId(id) {
  return trackToParentMap.get(id) || id
}

// ── IPC: Download logic ──
ipcMain.handle('download:start', async (event, { id, url, format, bitrate, concurrency }) => {
  console.log(`[download:start] ID=${id} URL=${url} format=${format} bitrate=${bitrate}`)
  
  const spotdlBin = findSpotdl()
  const ytdlpBin = findYtdlp()

  if (!spotdlBin || !ytdlpBin) {
    console.error('[download:start] spotdl or ytdlp binaries missing!')
    return { success: false, errorCode: 'TOOLS_MISSING' }
  }

  const platform = detectUrlPlatform(url)
  const settings = store.get('settings') || {}
  const outDir = settings.outputDirectory || path.join(os.homedir(), 'Music', 'Spotget')

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const cleanUrl = url.trim()
  const br = bitrate || '320k'
  // "Skip Existing Downloads" setting (Advanced): default ON when unset.
  const skipExisting = settings.skipExisting !== false

  const isYtdlpOnly = ['yandex', 'soundcloud', 'youtube'].includes(platform)

  if (isYtdlpOnly) {
    // ──── YT-DLP / Yandex / Soundcloud Pipeline ────
    const ext = format === 'mp3' ? 'mp3' : format === 'flac' ? 'flac' : format === 'wav' ? 'wav' : 'ogg'
    const args = [
      '--extract-audio',
      '--audio-format', ext,
      '--audio-quality', br === '320k' ? '0' : br === '256k' ? '2' : br === '192k' ? '4' : '9',
      '-o', path.join(outDir, '%(title)s - %(artist,creator)s.%(ext)s'),
      '--newline',
      // Skip Existing: tell yt-dlp not to overwrite files that already exist.
      ...(skipExisting ? ['--no-overwrites'] : ['--force-overwrites']),
      cleanUrl
    ]
    console.log('[yt-dlp]', ytdlpBin, args.join(' '))

  const proc = spawn(ytdlpBin, args, {
    env: toolsEnv({ PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', LANG: 'ru_RU.UTF-8', LC_ALL: 'ru_RU.UTF-8' })
  })

    proc.stdout.setEncoding('utf-8');
    proc.stderr.setEncoding('utf-8');

    activeDownloads.set(id, { proc, cancelled: false })

    return new Promise((resolve) => {
      let errStr = ''
      let lastPercent = 0
      const decoder = new StringDecoder('utf8');

      proc.stdout.on('data', (chunk) => {
        const line = decoder.write(chunk)
        const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/)
        if (match) {
          const pct = Math.floor(parseFloat(match[1]))
          if (pct > lastPercent) {
            lastPercent = pct
            if (!event.sender.isDestroyed()) {
              event.sender.send('download:progress', { id, progress: pct })
            }
          }
        }
      })

      proc.stderr.on('data', (chunk) => {
        errStr += decoder.write(chunk)
      })

      proc.on('close', (code) => {
        errStr += decoder.end()
        const entry = activeDownloads.get(id)
        activeDownloads.delete(id)

        if (entry?.cancelled) {
          console.log(`[download:start] yt-dlp run cancelled for ${id}`)
          return resolve({ success: false, cancelled: true })
        }

        if (code === 0) {
          resolve({ success: true, fileSize: '—' })
        } else {
          resolve({ success: false, error: errStr || `Exit code ${code}` })
        }
      })

      proc.on('error', (err) => {
        activeDownloads.delete(id)
        resolve({ success: false, errorCode: 'SPAWN_ERROR', error: err.message })
      })
    })

  } else {
    // ──── SPOTDL Pipeline ────
    const args = [
      'download',
      cleanUrl,
      '--output', outDir,
      '--format', (format || 'mp3').toLowerCase(),
      '--bitrate', br,
      // Skip Existing: skip songs whose output file already exists (else re-download).
      '--overwrite', skipExisting ? 'skip' : 'force',
      '--log-level', 'INFO',
      '--threads', String(concurrency),
      '--simple-tui',
      // When YouTube Music blocks the client, retry via regular YouTube.
      '--audio', 'youtube-music', 'youtube',
      '--max-retries', '3',
    ]

    // ── Bot-wall bypass for spotdl's bundled yt-dlp ──
    // Prefer imported cookies (only reliable fix for a flagged IP); otherwise
    // fall back to the tv/default player clients which don't require login.
    {
      const cookiesPath = getCookiesPath()
      const useCookies = hasCookies()
      const ytArgs = useCookies
        ? `--cookies "${cookiesPath}" --extractor-args "youtube:player_client=default,tv,web"`
        : `--extractor-args "youtube:player_client=tv,default"`
      args.push('--yt-dlp-args', ytArgs)
      flog('[spotdl] bot-bypass:', useCookies ? 'using imported cookies.txt' : 'player_client=tv (no cookies)')
    }
    flog('[spotdl]', spotdlBin, args.join(' '))
    flog('[spotdl] output dir:', outDir)
    flog('[spotdl] log file:', getLogFilePath())

    // Make sure ffmpeg + Deno are provisioned before starting — otherwise every
    // YouTube track fails. Cached promise: resolves instantly if already done.
    await ensureSpotdlDeps()

    // Fetch the real (UTF-8) playlist/album name from Spotify oEmbed — the
    // spotdl console output loses Cyrillic on Windows. Fire-and-forget.
    if (/open\.spotify\.com/.test(cleanUrl)) {
      fetchSpotifyTitle(cleanUrl).then((title) => {
        if (title && !event.sender.isDestroyed()) {
          flog('[download:meta] resolved Spotify title:', title)
          event.sender.send('download:meta', { id, title })
        }
      })
    }

    let totalTracks = 1
    let completedTracks = 0
    let trackIndexCounter = 0 

    const detectedCount = await getSpotdlTrackCount(spotdlBin, cleanUrl)
    if (detectedCount) {
      totalTracks = detectedCount
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:totalTracks', { id, totalTracks: detectedCount })
        event.sender.send('download:stats', { id, completedTracks: 0, totalTracks: detectedCount })
      }
    }

    const proc = spawn(spotdlBin, args, {
      env: toolsEnv({
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        PEP540: '1',
        PYTHONUNBUFFERED: '1'
      })
    })

    const downloadSession = {
      proc,
      cancelled: false,
      pollInterval: null
    }
    activeDownloads.set(id, downloadSession)

    return new Promise((resolve) => {
      // spotdl.exe on Windows can print Cyrillic in the legacy ANSI codepage
      // (windows-1251) even though we request UTF-8 via PYTHONIOENCODING.
      // Decoding those bytes as UTF-8 produced replacement characters that
      // cleanText() stripped, so track titles arrived blank
      // ("Zheka -    : Downloading") — which broke card matching and
      // de-duplication. Buffer raw bytes, split into complete lines, then
      // decode each line as strict UTF-8 with a windows-1251 fallback.
      const utf8Strict = new TextDecoder('utf-8', { fatal: true })
      const cp1251Decoder = new TextDecoder('windows-1251')
      const decodeLine = (buf) => {
        try { return utf8Strict.decode(buf) }
        catch (_) { try { return cp1251Decoder.decode(buf) } catch (_) { return buf.toString('utf8') } }
      }
      const splitBufferLines = (buf) => {
        const out = []
        let start = 0
        for (let i = 0; i < buf.length; i++) {
          const b = buf[i]
          if (b === 0x0A || b === 0x0D) { // \n or \r (in-place progress updates)
            if (i > start) out.push(buf.subarray(start, i))
            start = i + 1
          }
        }
        return { lines: out, rest: Buffer.from(buf.subarray(start)) }
      }
      let stdoutBytes = Buffer.alloc(0)
      let stderrBytes = Buffer.alloc(0)
      let errStr = ''
      let failedTracks = 0
      let lastErrorLine = ''
      // yt-dlp fallback queue: spotdl prints the failed YouTube URL on the
      // line right after "AudioProviderError: YT-DLP download error -"
      let failedUrls = []
      const queuedFallbackUrls = new Set()  // de-dupe: spotdl reprints the same failed URL on every retry/source
      let expectFailedUrl = false
      let expectSuccessUrl = false
      // URLs that spotdl DID download successfully (possibly after retries).
      // spotdl retries failed tracks up to --max-retries times: an early
      // attempt can fail (queueing the URL for the yt-dlp fallback) and a
      // later retry can succeed. Without this set the fallback re-downloaded
      // such tracks, creating "Title (1).mp3" duplicates.
      const succeededUrls = new Set()
      let fbIndex = 0            // next queue position the worker will take
      let fbSucceeded = 0
      let fbPromise = null       // current worker run (for awaiting drain on close)

      // ── Concurrent yt-dlp fallback worker ──
      // Runs WHILE spotdl is still processing the rest of the playlist, so the
      // user sees recovered tracks immediately instead of waiting for all 42
      // failures to accumulate. Serial (1 download at a time) to avoid rate
      // limiting. spotdl's bundled yt-dlp is often too old for YouTube's
      // latest countermeasures; our standalone copy self-updates first.
      const runFallbackWorker = async () => {
        const ytdlpBin = (() => {
          try {
            const p = getBinPath('yt-dlp')
            return fs.existsSync(p) ? p : null
          } catch (_) { return null }
        })()
        if (!ytdlpBin) {
          flog('[fallback] standalone yt-dlp not found — skipping fallback')
          fbIndex = failedUrls.length
          return
        }
        await updateYtdlp(ytdlpBin)
        const ffmpegBin = findFfmpeg()
        const fmt = (format || 'mp3').toLowerCase()

        // JS runtime: without Deno, YouTube can't be unlocked and flags us as
        // a bot. spotdl already downloaded Deno into ~/.spotdl/ — point our
        // standalone yt-dlp at it explicitly.
        const denoBin = findDeno()
        flog('[fallback] deno:', denoBin || 'NOT FOUND', '| ffmpeg:', ffmpegBin || 'from PATH')

        // Bot-check bypass strategies, tried in order until one works; the
        // winning strategy sticks for the rest of the queue.
        //
        // YouTube's default "web" client is bot-walled. The tv / android_vr /
        // web_safari / ios player clients still serve streams WITHOUT login,
        // which is the reliable fix (cookies-from-browser fails on Windows due
        // to Chrome/Edge app-bound cookie encryption — see the old logs).
        // Browser cookies are kept only as a last-ditch attempt.
        const browsers = detectCookieBrowsers()
        const cookiesPath = getCookiesPath()
        const strategies = [
          // Imported cookies.txt first — the only thing that reliably beats a
          // flagged IP. With a real session, the default/web client works.
          ...(hasCookies() ? [
            { label: 'cookies.txt', args: ['--cookies', cookiesPath, '--extractor-args', 'youtube:player_client=default,tv,web'] },
          ] : []),
          { label: 'client:tv', args: ['--extractor-args', 'youtube:player_client=tv'] },
          { label: 'client:android_vr', args: ['--extractor-args', 'youtube:player_client=android_vr'] },
          { label: 'client:web_safari', args: ['--extractor-args', 'youtube:player_client=web_safari'] },
          { label: 'client:ios', args: ['--extractor-args', 'youtube:player_client=ios'] },
          { label: 'client:mweb', args: ['--extractor-args', 'youtube:player_client=mweb'] },
          ...browsers.map((b) => ({
            label: `cookies:${b}`,
            args: ['--cookies-from-browser', b, '--extractor-args', 'youtube:player_client=tv,web'],
          })),
          { label: 'default', args: [] },
        ]
        let strategyIdx = 0

        while (fbIndex < failedUrls.length && !downloadSession.cancelled) {
          const i = fbIndex++
          // Skip tracks that spotdl managed to download on a later retry —
          // re-downloading them created "Title (1).mp3" duplicates.
          if (succeededUrls.has(failedUrls[i])) {
            flog(`[fallback] #${i + 1} already downloaded by spotdl — skipping`)
            continue
          }
          // music.youtube.com links often stay blocked; plain youtube.com works more often
          const url = failedUrls[i].replace('music.youtube.com', 'www.youtube.com')
          const trackId = `${id}-fb-${i}`
          if (!event.sender.isDestroyed()) {
            event.sender.send('download:newTrack', {
              id: trackId, parentId: id,
              title: `Повторная загрузка: трек ${i + 1}`, artist: '',
            })
          }

          // Download into a dedicated per-track temp folder. This removes the
          // race with spotdl (which writes into outDir concurrently) so we
          // always know EXACTLY which file this fallback produced — the root
          // cause of the duplicate cards and the stuck "Повторная загрузка"
          // cards was the old "newest file in outDir" guess picking a file
          // that belonged to a different track.
          const fbTmpDir = path.join(getFallbackTmpDir(), `${id}-${i}`)
          try { fs.rmSync(fbTmpDir, { recursive: true, force: true }) } catch (_) {}
          try { fs.mkdirSync(fbTmpDir, { recursive: true }) } catch (_) {}

          let ok = false
          let trackBotBlocked = false
          // Try current strategy; on bot-error advance to the next and retry
          // the SAME track. Once a strategy succeeds it stays selected.
          for (let s = strategyIdx; s < strategies.length && !ok && !downloadSession.cancelled; s++) {
            const strat = strategies[s]
            flog(`[fallback] downloading #${i + 1} via ${strat.label}: ${url}`)
            const fbArgs = [
              '-x', '--audio-format', fmt, '--audio-quality', '0',
              '--embed-thumbnail', '--embed-metadata', '--no-playlist',
              '--no-mtime', '--force-overwrites',
              // Small randomized delay so many tracks don't trip rate limiting
              '--sleep-requests', '1', '--sleep-interval', '1', '--max-sleep-interval', '5',
              '-o', path.join(fbTmpDir, '%(artist,creator,uploader)s - %(title)s.%(ext)s'),
              ...strat.args,
            ]
            if (denoBin) fbArgs.push('--js-runtimes', `deno:${denoBin}`)
            if (ffmpegBin) fbArgs.push('--ffmpeg-location', ffmpegBin)
            fbArgs.push(url)

            let botBlocked = false
            ok = await new Promise((res) => {
              let finished = false
              const fin = (v) => { if (!finished) { finished = true; res(v) } }
              try {
                const fb = spawn(ytdlpBin, fbArgs, { env: toolsEnv() })
                fb.stdout.on('data', (d) => {
                  const text = String(d)
                  const m = text.match(/\[download\]\s+([\d.]+)%/)
                  if (m && !event.sender.isDestroyed()) {
                    event.sender.send('download:progress', {
                      id: trackId, progress: Math.min(Math.floor(parseFloat(m[1])), 99),
                    })
                  }
                })
                fb.stderr.on('data', (d) => {
                  const text = String(d).trim()
                  if (/Sign in to confirm|not a bot|could not.*cookies|unsupported browser|could not find.*database/i.test(text)) {
                    botBlocked = true
                  }
                  flog(`[fallback #${i + 1} ${strat.label} err]`, text.substring(0, 300))
                })
                fb.on('close', (c) => fin(c === 0))
                fb.on('error', (e) => { flog(`[fallback #${i + 1} spawn error]`, e.message); fin(false) })
                setTimeout(() => { try { fb.kill() } catch (_) {} ; fin(false) }, 300000)
              } catch (e) { flog(`[fallback #${i + 1} exception]`, e.message); fin(false) }
            })

            if (botBlocked) trackBotBlocked = true
            if (ok) {
              strategyIdx = s // this strategy works — keep it for the rest
            } else if (botBlocked || strat.args.length > 0) {
              // Bot-blocked or a cookie source failed to read — try the next one
              flog(`[fallback] strategy ${strat.label} failed for #${i + 1}, trying next`)
            } else {
              break // no-cookies also failed with a non-bot error — give up on this track
            }
          }

          // Early abort: if the very first track was bot-walled on EVERY
          // strategy and no cookies.txt is imported, hammering 41 more tracks
          // is pointless — YouTube has flagged this IP/session. Stop and tell
          // the user to import cookies (the only real fix).
          if (!ok && trackBotBlocked && !hasCookies() && fbSucceeded === 0 && i === 0) {
            flog('[fallback] IP/session bot-walled on all clients and no cookies imported — aborting fallback')
            fbIndex = failedUrls.length // drain the queue so we stop
            if (!event.sender.isDestroyed()) {
              event.sender.send('download:botWalled', { parentId: id })
              event.sender.send('download:trackCompleted', {
                id: trackId, title: 'Нужны cookies YouTube — см. настройки', artist: '',
              })
            }
            break
          }

          if (ok) {
            // Locate the single audio file yt-dlp produced in the temp folder,
            // then move it into outDir (resolving any name collision with a
            // track spotdl already saved). Because the temp folder held only
            // this track, there is zero ambiguity about which file it is.
            let finalPath = null
            let duplicateOfExisting = false
            try {
              const exts = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.opus']
              const produced = fs.readdirSync(fbTmpDir)
                .filter(f => exts.includes(path.extname(f).toLowerCase()))
              if (produced.length > 0) {
                const srcPath = path.join(fbTmpDir, produced[0])
                const destPath = path.join(outDir, produced[0])
                if (succeededUrls.has(failedUrls[i]) || fs.existsSync(destPath)) {
                  // spotdl saved this track itself (e.g. a retry succeeded
                  // while we were downloading) — discard our copy instead of
                  // creating a "Title (1).mp3" duplicate.
                  duplicateOfExisting = true
                  flog(`[fallback] #${i + 1} — track already saved by spotdl, discarding duplicate`)
                } else {
                  try { fs.renameSync(srcPath, destPath) }
                  catch (_) { fs.copyFileSync(srcPath, destPath) }
                  finalPath = destPath
                }
              }
            } catch (e) {
              flog(`[fallback] move failed for #${i + 1}: ${e.message}`)
            }
            try { fs.rmSync(fbTmpDir, { recursive: true, force: true }) } catch (_) {}

            if (finalPath) {
              fbSucceeded++
              flog(`[fallback] track #${i + 1} downloaded OK -> ${finalPath} (${fbSucceeded} recovered so far)`)
              // Pass the EXACT file path so completion is never associated with
              // another track's file (fixes duplicates + stuck cards).
              markTrackDone(trackId, '', '', finalPath)
            } else if (duplicateOfExisting) {
              if (!event.sender.isDestroyed()) {
                event.sender.send('download:trackCompleted', {
                  id: trackId, title: `Уже скачан — дубликат пропущен`, artist: '',
                })
              }
            } else {
              flog(`[fallback] track #${i + 1} reported OK but no audio file found`)
              if (!event.sender.isDestroyed()) {
                event.sender.send('download:trackCompleted', {
                  id: trackId, title: `Не удалось: трек ${i + 1}`, artist: '',
                })
              }
            }
          } else {
            flog(`[fallback] track #${i + 1} FAILED too`)
            try { fs.rmSync(fbTmpDir, { recursive: true, force: true }) } catch (_) {}
            if (!event.sender.isDestroyed()) {
              event.sender.send('download:trackCompleted', {
                id: trackId, title: `Не удалось: трек ${i + 1}`, artist: '',
              })
            }
          }
        }
      }

      // Start (or restart) the worker; only one loop runs at a time.
      const kickFallbackWorker = () => {
        if (fbPromise) return
        fbPromise = runFallbackWorker()
          .catch((e) => flog('[fallback] worker crashed:', e.message))
          .finally(() => { fbPromise = null })
      }

      // Map: artistKey -> { trackId, title, artist }
      // Needed because spotdl runs --threads N in parallel: multiple tracks
      // are "Downloading" simultaneously. A single currentTrackId variable
      // was overwritten by the last started track, causing ": Done" lines
      // to complete the wrong card.
      const activeTracks = new Map()
      const completedTrackIds = new Set()  // Prevent double-completion
      // De-dupe cards: spotdl reprints "Artist - Title: Downloading" once per
      // audio source (youtube-music, youtube) and per retry (--max-retries),
      // and can reprint skip lines too. Without this, the SAME track spawned a
      // brand-new identical card every time. Key by normalized artist+title.
      const seenTrackKeys = new Map()  // normKey -> trackId
      const normKey = (s) => (s || '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '')
      let currentTrackId = null  // kept for close() fallback only
      let currentTitle   = ''
      let currentArtist  = ''

      // ── Single source of truth for the session counters ──
      // Prior code updated `completedTracks` from BOTH spotdl's "N/M complete"
      // progress line AND markTrackDone, which double-counted (e.g. 45/42).
      // And `failedTracks` only ever grew, so tracks the fallback later
      // recovered still showed as failed. emitStats() derives everything from
      // authoritative sources every time it's called:
      //   completed = unique finished track IDs, clamped to the real total
      //   failed    = spotdl failures MINUS the ones the fallback recovered
      const emitStats = () => {
        completedTracks = Math.min(completedTrackIds.size, totalTracks)
        const netFailed = Math.max(0, failedTracks - fbSucceeded)
        if (!event.sender.isDestroyed()) {
          event.sender.send('download:stats', { id, completedTracks, totalTracks, failedTracks: netFailed })
          // Keep the card's failure badge in sync (it can now go DOWN when the
          // fallback recovers a previously-failed track).
          event.sender.send('download:trackFailed', { parentId: id, failedTracks: netFailed })
        }
      }

      const artistKey = (str) => (str || '').toLowerCase().replace(/[\-\s,]+$/, '').trim().substring(0, 20)

      const finishTrackByArtist = (artistStr, pct) => {
        const key = artistKey(artistStr)
        const entry = activeTracks.get(key)
        if (!entry || event.sender.isDestroyed()) return
        const safePct = Math.min(pct, 99)
        event.sender.send('download:progress', {
          id: entry.trackId, progress: safePct,
          title: entry.title, artist: entry.artist,
        })
      }

      const finishCurrentTrack = (pct) => {
        if (!currentTrackId || event.sender.isDestroyed()) return
        const safePct = Math.min(pct, 99)
        event.sender.send('download:progress', {
          id: currentTrackId, progress: safePct,
          title: currentTitle, artist: currentArtist,
        })
      }

      // extractArtworkFromFile is defined at module level (above library:getDir)

      // Find the most recently modified audio file in outDir that matches artist/title.
      // For YouTube tracks title == artist (fallback), so we search by artist name first,
      // then fall back to the newest file in the folder.
      const findTrackFile = (title, artist) => {
        try {
          const exts = ['.mp3', '.flac', '.ogg', '.wav', '.m4a']
          const files = fs.readdirSync(outDir)
            .filter(f => exts.includes(path.extname(f).toLowerCase()))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(outDir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime)
          if (files.length === 0) return null

          const lowerTitle  = (title  || '').toLowerCase().replace(/[-\s]+$/, '').trim()
          const lowerArtist = (artist || '').toLowerCase().replace(/[-\s]+$/, '').trim()

          // 1. Try matching by both artist and title
          if (lowerArtist && lowerTitle && lowerArtist !== lowerTitle) {
            const both = files.find(f => {
              const n = f.name.toLowerCase()
              return n.includes(lowerArtist.substring(0, 10)) && n.includes(lowerTitle.substring(0, 10))
            })
            if (both) return path.join(outDir, both.name)
          }

          // 2. Try matching by artist alone (covers YouTube tracks with empty/fallback title)
          if (lowerArtist && lowerArtist.length > 2) {
            const byArtist = files.find(f => f.name.toLowerCase().includes(lowerArtist.substring(0, 10)))
            if (byArtist) return path.join(outDir, byArtist.name)
          }

          // 3. Fall back to newest file
          return path.join(outDir, files[0].name)
        } catch (_) { return null }
      }

      const markTrackDone = (trackId, title, artist, explicitFile) => {
        if (downloadSession.cancelled) return
        if (completedTrackIds.has(trackId)) {
          console.log(`[markTrackDone] SKIP duplicate completion for ${trackId}`)
          return
        }
        // Prefer an explicit, known file path (fallback worker downloads each
        // track to its own folder, so there's no ambiguity/race). Only fall
        // back to the fuzzy newest-file search when no explicit path is given.
        const filePath = (explicitFile && fs.existsSync(explicitFile))
          ? explicitFile
          : findTrackFile(title, artist)

        // Only count a completion when a real file exists on disk. This keeps
        // the session counter EXACTLY in sync with the "Downloaded" library
        // (which lists only playable files) — fixing the 44-vs-41 mismatch
        // where spotdl reported a track done but its file was never located.
        if (!filePath || !fs.existsSync(filePath)) {
          flog(`[markTrackDone] no file on disk for "${artist} - ${title}" (${trackId}) — not counting`)
          return
        }
        completedTrackIds.add(trackId)

        // Read real title/artist from the filename — spotdl saves as "Artist - Title.ext"
        // and the filename contains correct Cyrillic even when stdout encoding lost it
        let realTitle  = title
        let realArtist = artist
        if (filePath) {
          const basename = path.basename(filePath, path.extname(filePath))
          const sepIdx = basename.indexOf(' - ')
          if (sepIdx > 0) {
            const fromFile_artist = basename.substring(0, sepIdx).trim()   // before " - " = Artist
            const fromFile_title  = basename.substring(sepIdx + 3).trim()  // after " - " = Title
            if (fromFile_artist) realArtist = fromFile_artist
            if (fromFile_title)  realTitle  = fromFile_title
            console.log(`[markTrackDone] from filename: title="${realTitle}" artist="${realArtist}"`)
          }
        }

        let artworkUrl = null
        let audioUrl = null
        let fileSizeBytes = 0
        if (filePath && fs.existsSync(filePath)) {
          audioUrl = pathToSpotgetUrl(filePath)
          try { fileSizeBytes = fs.statSync(filePath).size } catch (_) {}
          try {
            const artDir = getArtCacheDir()
            const artwork = extractArtworkFromFile(filePath)
            artworkUrl = saveArtworkToFile(artwork, trackId, artDir)
          } catch (err) {
            console.log(`[markTrackDone] artwork save failed: ${err.message}`)
          }
        }
        const fileSize = fileSizeBytes ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB` : '—'
        console.log(`[markTrackDone] id=${trackId} title="${realTitle}" artist="${realArtist}" file="${filePath}" size=${fileSize} artwork=${artworkUrl || 'null'}`)
        if (!event.sender.isDestroyed()) {
          event.sender.send('download:trackCompleted', { id: trackId, title: realTitle, artist: realArtist, artwork: artworkUrl, audioUrl, filePath, fileSize, fileSizeBytes })
        }
        emitStats()
      }

      const cleanText = (str) => {
        if (!str) return ''
        // Убираем ANSI-последовательности
        let cleaned = str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
        // Убираем маркеры заменяющих символов UTF-8 (кракозябры)
        cleaned = cleaned.replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        return cleaned.trim()
      }

      proc.stdout.on('data', (chunk) => {
        // Buffer raw bytes and split into complete lines; each line is
        // decoded as strict UTF-8 with a windows-1251 fallback (see above).
        const split = splitBufferLines(Buffer.concat([stdoutBytes, chunk]))
        stdoutBytes = split.rest
        const lines = split.lines.map(decodeLine)

        for (let rawLine of lines) {
          const line = cleanText(rawLine)
          if (!line) continue
          
          // ──── Log every non-empty line (console + file) ────
          flog(`[spotdl stdout] "${line}"`)

          // ── 0. Track download failures ────────────────────��────────────
          // "AudioProviderError: YT-DLP download error - <url>" means the
          // track did NOT download even though spotdl counts it as "complete".
          if (/AudioProviderError|LookupError|FFmpegError|Traceback/i.test(line)) {
            failedTracks++
            lastErrorLine = line
            expectSuccessUrl = false
            // If the failed URL is on the SAME line, queue it directly and do
            // not wait for the next bare-URL line (which, with --threads 4,
            // could belong to a DIFFERENT, successful track).
            const sameLineUrl = /AudioProviderError/i.test(line) ? line.match(/https?:\/\/\S+/) : null
            if (sameLineUrl) {
              expectFailedUrl = false
              const failedUrl = sameLineUrl[0]
              if (!succeededUrls.has(failedUrl) && !queuedFallbackUrls.has(failedUrl)) {
                queuedFallbackUrls.add(failedUrl)
                failedUrls.push(failedUrl)
                flog(`[spotdl] queued for yt-dlp fallback (same line): ${failedUrl}`)
                kickFallbackWorker()
              }
            } else {
              expectFailedUrl = /AudioProviderError/i.test(line)
            }
            flog(`[spotdl FAILED track #${failedTracks}] ${line}`)
            if (!event.sender.isDestroyed()) {
              // Carry the reason once; emitStats keeps the net failed count in sync.
              event.sender.send('download:trackFailed', {
                parentId: id,
                failedTracks: Math.max(0, failedTracks - fbSucceeded),
                reason: line,
              })
            }
          } else if (/^https?:\/\//.test(line)) {
            const bareUrl = line.trim()
            if (expectSuccessUrl) {
              // URL right after a `Downloaded "..."` line = the track DID
              // download. Remember it so the yt-dlp fallback never
              // re-downloads it (a failed early attempt may have queued this
              // URL, then a spotdl retry succeeded → "Title (1).mp3" dupes).
              expectSuccessUrl = false
              expectFailedUrl = false
              succeededUrls.add(bareUrl)
            } else if (expectFailedUrl) {
              // Queue the failed YouTube URL and start the fallback worker
              // immediately (runs concurrently with spotdl).
              expectFailedUrl = false
              // De-dupe: spotdl prints the SAME failed URL again on every retry
              // (--max-retries) and every audio source. Without this, the same
              // track was queued — and later shown — multiple times.
              if (succeededUrls.has(bareUrl)) {
                flog(`[spotdl] URL already downloaded — not queueing: ${bareUrl}`)
              } else if (!queuedFallbackUrls.has(bareUrl)) {
                queuedFallbackUrls.add(bareUrl)
                failedUrls.push(bareUrl)
                flog(`[spotdl] queued for yt-dlp fallback: ${bareUrl}`)
                kickFallbackWorker()
              } else {
                flog(`[spotdl] duplicate failed URL ignored: ${bareUrl}`)
              }
            }
          }

          // 1. Общее число треков
          const totalMatch = line.match(/Found (\d+) songs/i)
          if (totalMatch) {
            totalTracks = parseInt(totalMatch[1], 10)
            if (!event.sender.isDestroyed()) {
              event.sender.send('download:totalTracks', { id, totalTracks })
              event.sender.send('download:stats', { id, completedTracks, totalTracks })
            }
          }

          // ── 2. Старт загрузки нового трека ────────────────────────────�����������─
          let title = ''
          let artist = ''
          let isNewTrack = false

          // spotdl --simple-tui format: "Artist - Title : Downloading"
          // For Russian names we must NOT split on the first " - " because
          // track titles often contain " - " themselves. Instead we split on
          // the LAST " - " before ": Downloading" to get artist correctly.
          // Also: YouTube tracks often have empty title in metadata, so we 
          // accept "Artist - " (with empty title after dash).
          const processMatch = line.match(/^(.+?)\s*:\s*Downloading/i)
          
          // Also parse "Downloaded" format for tracks with empty titles:
          // Downloaded "Artist - Title": or Downloaded "Artist - ":
          const downloadedMatch = line.match(/^Downloaded\s+"(.+?)"\s*:\s*$/i)
          if (downloadedMatch) {
            // The next bare-URL line belongs to this SUCCESSFUL download.
            expectSuccessUrl = true
            expectFailedUrl = false
          }

          // Helper: split "Artist - Title" — accepts empty/whitespace title.
          // YouTube tracks have no title in metadata so spotdl outputs "Artist -   :"
          // Use FIRST " - " (not last): artist names rarely contain " - " but titles might.
          const splitArtistTitle = (raw) => {
            const s = cleanText(raw)
            const idx = s.indexOf(' - ')
            if (idx < 0) return { artist: s.trim(), title: '' }
            return { artist: s.substring(0, idx).trim(), title: s.substring(idx + 3).trim() }
          }

          if (processMatch) {
            const parsed = splitArtistTitle(processMatch[1])
            if (parsed.artist) {
              artist = parsed.artist
              title  = parsed.title
              isNewTrack = true
              console.log(`[spotdl parsed newTrack] artist="${artist}" title="${title || '(empty)'}"`)
            } else {
              console.log(`[spotdl rejected fragment] no artist in "${processMatch[1]}"`)
            }
          } else if (downloadedMatch) {
            // 'Downloaded' lines signal completion only — never spawn a new track card.
            // Duplicates were caused by treating this as isNewTrack = true.
            console.log(`[spotdl downloaded skip-new-track] "${downloadedMatch[1]}"`)
          }

          if (isNewTrack && (title || artist)) {
            // Use artist as title fallback for YouTube tracks with empty metadata title
            // Strip trailing " -" or " -," from display (artifact of spotdl empty-title output)
            const cleanTrailing = (s) => s.replace(/\s*[\-,]+\s*$/, '').trim()
            const hadRealTitle = !!(title && title.trim())
            if (!title) title = cleanTrailing(artist)
            artist = cleanTrailing(artist)

            // Ignore garbage-only strings: just dashes, commas, spaces, question marks, or empty
            if ((!title && !artist) || /^[\-?,\s]+$/.test(title) || /^[\-?,\s]+$/.test(artist)) {
              console.log(`[spotdl skip garbage] title="${title}" artist="${artist}"`)
              continue
            }

            // ── De-dupe: spotdl reprints "Downloading" for the same track once
            // per audio source and per retry. Reuse the existing card instead of
            // spawning an identical duplicate (fixes repeated rows in the list).
            // Only de-dupe when spotdl printed a REAL title. With an empty
            // title the key collapsed to just the artist name, which merged
            // DIFFERENT tracks by the same artist into one card — tracks went
            // missing from the list.
            const dupKey = hadRealTitle ? normKey(`${artist} ${title}`) : ''
            if (dupKey && seenTrackKeys.has(dupKey)) {
              const existingId = seenTrackKeys.get(dupKey)
              currentTrackId = existingId
              currentTitle = title
              currentArtist = artist
              console.log(`[spotdl dedupe newTrack] reuse ${existingId} for "${dupKey}"`)
              continue
            }

            const trackId = `${id}-track-${trackIndexCounter++}`
            trackToParentMap.set(trackId, id)

            // Key = artistKey + index so same-artist parallel tracks don't collide
            const aKey = `${artistKey(artist)}__${trackIndexCounter - 1}`
            activeTracks.set(aKey, { trackId, title, artist, aKey })
            if (dupKey) seenTrackKeys.set(dupKey, trackId)
            // Also update single-var fallback (used by close() handler)
            currentTrackId = trackId
            currentTitle = title
            currentArtist = artist

            // No placeholder artwork — the renderer will show the platform icon instead.
            // Real artwork will be injected via onTrackCompleted once the file is written
            // and we can read its ID3/FLAC tag (see markTrackDone below).
            if (!event.sender.isDestroyed()) {
              console.log(`[IPC send download:newTrack] trackId=${trackId} title="${title}" artist="${artist}" parent=${id}`)
              event.sender.send('download:newTrack', {
                parentId: id, 
                id: trackId,
                title,
                artist,
                platform,
                format,
                bitrate,
                artwork: null   // null = no placeholder; icon is shown instead
              })
            }
          }

          // 3. Прогресс трека
          const progressMatch = line.match(/(\d+(?:\.\d+)?)%/i)
          if (progressMatch && currentTrackId) {
            const pct = Math.floor(parseFloat(progressMatch[1]))
            if (pct % 25 === 0) console.log(`[spotdl progress] id=${currentTrackId} ${pct}%`)
            finishCurrentTrack(pct)
          }

          // 3b. Count progress (e.g., "1/42 complete" or "5/42 complete")
          const countMatch = line.match(/(\d+)\/(\d+)\s*complete/i)
          if (countMatch) {
            const total = parseInt(countMatch[2], 10)
            if (total > 0 && total > totalTracks) {
              totalTracks = total
              if (!event.sender.isDestroyed()) {
                event.sender.send('download:totalTracks', { id, totalTracks })
              }
            }
            // Do NOT trust spotdl's "N complete" for the completed counter — it
            // counts processed tracks (incl. failures). emitStats derives the
            // real count from verified completions.
            emitStats()
          }

          // 4. Пропуск существующего трека
          // Match both "Skipping Artist - Title (file already exists)" and
          // "Artist - Title : Skipped" — spotdl uses different formats
          const skipMatch = line.match(/Skipping\s+(.+?)\s*\(.*already exists\)/i)
              || line.match(/^(.+?)\s*:\s*Skipped/i)
          if (skipMatch) {
            const fileStr = cleanText(skipMatch[1])
            // De-dupe: don't add a skip card if this track already has a card.
            // Only de-dupe skips when the string has a real title after
            // "Artist - " — otherwise different no-title tracks by the same
            // artist would collapse into one card and go missing.
            const skipDashIdx = fileStr.indexOf(' - ')
            const skipHasTitle = skipDashIdx > 0 && fileStr.substring(skipDashIdx + 3).trim().length > 0
            const skipKey = skipHasTitle ? normKey(fileStr) : ''
            if (skipKey && seenTrackKeys.has(skipKey)) {
              console.log(`[spotdl dedupe skip] already have card for "${skipKey}"`)
              continue
            }
            const skippedTrackId = `${id}-track-skip-${trackIndexCounter++}`
            trackToParentMap.set(skippedTrackId, id)
            if (skipKey) seenTrackKeys.set(skipKey, skippedTrackId)
            
            console.log(`[spotdl skipped] id=${skippedTrackId} file="${fileStr}"`)

            // Try to get artwork from the existing file on disk
            const existingFile = findTrackFile(fileStr, '')
            let skippedArtwork = null
            if (existingFile) {
              try {
                const artDir = getArtCacheDir()
                skippedArtwork = saveArtworkToFile(extractArtworkFromFile(existingFile), skippedTrackId, artDir)
              } catch (_) {}
            }
            
            let skippedBytes = 0
            if (existingFile) { try { skippedBytes = fs.statSync(existingFile).size } catch (_) {} }
            if (!event.sender.isDestroyed()) {
              const skippedAudioUrl = existingFile ? pathToSpotgetUrl(existingFile) : null
              event.sender.send('download:trackSkipped', {
                parentId: id,
                id: skippedTrackId,
                title: fileStr,
                artist: 'Local File',
                artwork: skippedArtwork,
                audioUrl: skippedAudioUrl,
                filePath: existingFile || null,
                fileSize: skippedBytes ? `${(skippedBytes / 1024 / 1024).toFixed(1)} MB` : 'Skipped',
                fileSizeBytes: skippedBytes,
              })
            }
            markTrackDone(skippedTrackId, fileStr, 'Local File')
          }

          // 5. Завершение трека
          const doneMatch = line.match(/^(.+?)\s*:\s*(?:Done|Complete(?:d)?)\b/i)
          if (doneMatch) {
            const doneString = cleanText(doneMatch[1])
            // Artist is everything before the FIRST " - " in the Done line
            const doneIdx = doneString.indexOf(' - ')
            const doneArtistRaw = doneIdx >= 0 ? doneString.substring(0, doneIdx).trim() : doneString.trim()
            const doneTitleRaw  = doneIdx >= 0 ? doneString.substring(doneIdx + 3).trim() : ''

            // Find the matching track entry by artist prefix match
            // (key includes index suffix: "pizza__12", so we can't use .get())
            const doneArtistPrefix = artistKey(doneArtistRaw)
            let entry = null
            let doneKey = null
            for (const [k, v] of activeTracks) {
              if (k.startsWith(doneArtistPrefix + '__')) { entry = v; doneKey = k; break }
            }

            if (entry) {
              console.log(`[spotdl :Done] key="${doneKey}" -> trackId=${entry.trackId} artist="${entry.artist}"`)
              finishTrackByArtist(doneArtistRaw, 100)
              markTrackDone(entry.trackId, doneTitleRaw || entry.title, doneArtistRaw || entry.artist)
              activeTracks.delete(doneKey)
              // Keep single-var fallback in sync
              if (currentTrackId === entry.trackId) {
                currentTrackId = null; currentTitle = ''; currentArtist = ''
              }
            } else if (currentTrackId && !completedTrackIds.has(currentTrackId)) {
              // Fallback: no map entry found, use single-var (single-track downloads)
              // Skip if currentTrackId was already completed (e.g. garbage track :Done matched wrong card)
              console.log(`[spotdl :Done fallback] currentId=${currentTrackId} line="${doneString}"`)
              finishCurrentTrack(100)
              markTrackDone(currentTrackId, doneTitleRaw || currentTitle, doneArtistRaw || currentArtist)
              currentTrackId = null; currentTitle = ''; currentArtist = ''
            }
          }
        }
      })

      proc.stderr.on('data', (chunk) => {
        const split = splitBufferLines(Buffer.concat([stderrBytes, chunk]))
        stderrBytes = split.rest
        const stderrLines = split.lines.map(decodeLine)
        if (stderrLines.length) errStr += stderrLines.join('\n') + '\n'

        // Also parse stderr — some spotdl versions output progress here
        for (const rawLine of stderrLines) {
          const sLine = cleanText(rawLine)
          if (!sLine) continue
          console.log(`[spotdl stderr] "${sLine}"`)

          const sProgress = sLine.match(/(\d+(?:\.\d+)?)%/i)
          if (sProgress && currentTrackId) {
            finishCurrentTrack(Math.floor(parseFloat(sProgress[1])))
          }
          const sCount = sLine.match(/(\d+)\/(\d+)\s*complete/i)
          if (sCount) {
            const t = parseInt(sCount[2], 10)
            if (t > 0 && t > totalTracks) {
              totalTracks = t
              if (!event.sender.isDestroyed()) {
                event.sender.send('download:totalTracks', { id, totalTracks })
              }
            }
            emitStats()
          }
        }
      })

      proc.on('close', async (code) => {
        stdoutBytes = Buffer.alloc(0) // discard any unterminated partial line
        activeDownloads.delete(id)

        if (downloadSession.cancelled) {
          return resolve({ success: false, cancelled: true })
        }

        // If a track was still "in progress" when spotdl exited, its final
        // ": Done" line likely got lost in an unflushed buffer. Finalize it
        // now instead of leaving the card stuck at 99% with no artwork.
        if (currentTrackId && code === 0) {
          markTrackDone(currentTrackId, currentTitle, currentArtist)
          currentTrackId = null
        }

        // ── Drain the concurrent yt-dlp fallback worker ──────────────
        // The worker started as soon as the first track failed; here we just
        // wait until the remaining queue is empty before finalizing.
        if (failedUrls.length > 0 && !downloadSession.cancelled) {
          flog(`[fallback] spotdl finished; waiting for fallback queue (${failedUrls.length - fbIndex} remaining)`)
          while ((fbPromise || fbIndex < failedUrls.length) && !downloadSession.cancelled) {
            if (!fbPromise) kickFallbackWorker()
            if (fbPromise) await fbPromise
          }
          flog(`[fallback] queue drained: ${fbSucceeded}/${failedUrls.length} recovered`)
        }

        // Remove this session's fallback temp folders + any legacy hidden cache
        // folders older versions wrote into the music/output directory, so the
        // user's music folder is left with nothing but the audio files.
        try {
          for (const name of fs.readdirSync(getFallbackTmpDir())) {
            if (name.startsWith(`${id}-`)) {
              fs.rmSync(path.join(getFallbackTmpDir(), name), { recursive: true, force: true })
            }
          }
        } catch (_) {}
        cleanupLegacyCacheFolders(outDir)

        const actuallyDownloaded = completedTrackIds.size
        // Reconcile the total to reality: spotdl sometimes reports a "Found N"
        // that differs from what actually processed. The true total is
        // completed + still-failed, so the counter never shows e.g. 45/42.
        const netFailedFinal = Math.max(0, failedTracks - fbSucceeded)
        if (actuallyDownloaded + netFailedFinal > totalTracks) {
          totalTracks = actuallyDownloaded + netFailedFinal
          if (!event.sender.isDestroyed()) {
            event.sender.send('download:totalTracks', { id, totalTracks })
          }
        }
        emitStats()
        flog(`[spotdl close] code=${code} downloaded=${actuallyDownloaded} netFailed=${netFailedFinal} total=${totalTracks}`)
        flog(`[spotdl close] full log saved to: ${getLogFilePath()}`)

        // spotdl exits with code 0 even when EVERY track failed ("N/N complete"
        // counts failures too). Report an honest error so the UI doesn't
        // pretend everything downloaded.
        if (code === 0 && failedTracks > 0 && actuallyDownloaded === 0) {
          return resolve({
            success: false,
            errorCode: 'ALL_TRACKS_FAILED',
            error:
              `Ни один из ${totalTracks} треков не скачался (${failedTracks} ошибок), ` +
              `включая резервную загрузку через yt-dlp. YouTube блокирует загрузки ` +
              `с вашего IP — включите VPN и повторите. ` +
              `Полный лог: ${getLogFilePath()}`,
          })
        }

        resolve(code === 0 ? { success: true, fileSize: '—', failedTracks } : { success: false, error: cleanText(errStr) || `Exit code ${code}` })
      })

      proc.on('error', (err) => {
        activeDownloads.delete(id)
        resolve({ success: false, errorCode: 'SPAWN_ERROR', error: err.message })
      })
    })
  }
})

// ── Cancel download — FIXED: also kill all spotdl/ffmpeg processes ──
ipcMain.handle('download:cancel', (_, id) => {
  const parentId = resolveDownloadParentId(id)
  const entry = activeDownloads.get(parentId)
  if (!entry) {
    console.log(`[download:cancel] no entry found for ${parentId}`)
    return { success: false }
  }

  console.log(`[download:cancel] cancelling ${parentId}, pid=${entry.proc?.pid}, pollInterval=${!!entry.pollInterval}, cancelledBefore=${entry.cancelled}`)
  entry.cancelled = true

  // Clear folder polling interval immediately
  if (entry.pollInterval) {
    clearInterval(entry.pollInterval)
  }

  // Forcefully kill process tree
  if (entry.proc && entry.proc.pid) {
    killProcessTree(entry.proc.pid)
  }

  activeDownloads.delete(parentId)
  return { success: true }
})

// Cancel ALL active downloads at once
ipcMain.handle('download:cancelAll', () => {
  console.log(`[download:cancelAll] cancelling ${activeDownloads.size} active downloads`)
  for (const [parentId, entry] of activeDownloads) {
    entry.cancelled = true
    if (entry.pollInterval) clearInterval(entry.pollInterval)
    if (entry.proc && entry.proc.pid) killProcessTree(entry.proc.pid)
  }
  activeDownloads.clear()
  return { success: true }
})

// ── Logs ──
ipcMain.handle('logs:getPath', () => getLogFilePath())
ipcMain.handle('logs:openFolder', () => {
  const logPath = getLogFilePath()
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    if (fs.existsSync(logPath)) {
      shell.showItemInFolder(logPath)
    } else {
      shell.openPath(path.dirname(logPath))
    }
    return { success: true, path: logPath }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Tool checks
ipcMain.handle('download:checkSpotdl', () => { const p = findSpotdl(); return { found: !!p, path: p } })
ipcMain.handle('download:checkYtdlp', () => { const p = findYtdlp(); return { found: !!p, path: p } })
ipcMain.handle('download:checkTools', () => ({
  spotdl: { found: !!findSpotdl(), path: findSpotdl() },
  ytdlp: { found: !!findYtdlp(), path: findYtdlp() },
}))

// Read artwork file and return as base64 data URI
ipcMain.handle('artwork:read', (_, spotgetUrl) => {
  try {
    const filePath = spotgetUrlToPath(spotgetUrl)
    if (!filePath || !fs.existsSync(filePath)) return null
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (e) {
    console.error('[artwork:read]', e)
    return null
  }
})

ipcMain.handle('download:redownloadTools', async () => {
  try {
    const ext = process.platform === 'win32' ? '.exe' : ''
    for (const name of ['spotdl', 'yt-dlp']) {
      const p = getBinPath(name)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    await ensureTools()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── Auto-update via GitHub Releases ────────────────────────────────
// Checks the latest published Release of the repo, compares its tag to the
// installed version, and (on request) downloads the .exe installer with
// progress and launches it. Robust against manual release uploads — it reads
// the public Releases API directly, no latest.yml required.
const UPDATE_REPO = 'Lerch4ik/Spot_Get'

// Parse "v2.1.0" / "2.1.0" → [2,1,0]; returns true if `remote` > `local`.
function isNewerVersion(remote, local) {
  const norm = (v) => String(v || '').trim().replace(/^v/i, '').split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const a = norm(remote), b = norm(local)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

// GET JSON from the GitHub API (needs a User-Agent header).
function ghGetJson(apiUrl) {
  const https = require('https')
  return new Promise((resolve, reject) => {
    const req = https.get(apiUrl, {
      headers: { 'User-Agent': 'SpotGet-Updater', 'Accept': 'application/vnd.github+json' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); ghGetJson(res.headers.location).then(resolve, reject); return
      }
      if (res.statusCode !== 200) {
        res.resume()
        const err = new Error(`GitHub API ${res.statusCode}`)
        err.statusCode = res.statusCode
        reject(err)
        return
      }
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { raw += c })
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch (e) { reject(e) } })
    })
    req.on('timeout', () => req.destroy(new Error('GitHub API timeout')))
    req.on('error', reject)
  })
}

// Download a URL to `dest`, following redirects, reporting progress bytes.
function downloadWithProgress(url, dest, onProgress) {
  const https = require('https')
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'SpotGet-Updater' },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        downloadWithProgress(res.headers.location, dest, onProgress).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Download ${res.statusCode}`)); return }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const out = fs.createWriteStream(dest)
      res.on('data', (chunk) => {
        received += chunk.length
        try { onProgress(received, total) } catch (_) {}
      })
      res.pipe(out)
      out.on('finish', () => out.close(() => resolve(dest)))
      out.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('Download timeout')))
    req.on('error', reject)
  })
}

// Cache the latest resolved update so download doesn't need to re-query.
let _pendingUpdate = null

async function checkForUpdate() {
  const currentVersion = app.getVersion()
  try {
    const rel = await ghGetJson(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`)
    const latestVersion = String(rel.tag_name || rel.name || '').replace(/^v/i, '')
    const asset = (rel.assets || []).find((a) => /\.exe$/i.test(a.name))
    const updateAvailable = !!latestVersion && isNewerVersion(latestVersion, currentVersion)
    _pendingUpdate = updateAvailable && asset
      ? { url: asset.browser_download_url, name: asset.name, size: asset.size || 0 }
      : null
    return {
      updateAvailable,
      currentVersion,
      latestVersion: latestVersion || currentVersion,
      notes: rel.body || '',
      releaseUrl: rel.html_url || `https://github.com/${UPDATE_REPO}/releases`,
      hasInstaller: !!asset,
    }
  } catch (e) {
    _pendingUpdate = null
    // A 404 simply means the repo has no published Releases yet — that's not an
    // error, it just means there's nothing newer to install.
    if (e?.statusCode === 404) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: `https://github.com/${UPDATE_REPO}/releases`,
        hasInstaller: false,
        noReleases: true,
      }
    }
    // Give a human-readable reason so the UI can explain what actually happened.
    let reason
    if (e?.statusCode === 403) reason = 'GitHub rate limit reached — try again later'
    else if (e?.code === 'ENOTFOUND' || e?.code === 'EAI_AGAIN') reason = 'No internet connection'
    else if (e?.code === 'ETIMEDOUT' || /timeout/i.test(e?.message || '')) reason = 'Connection timed out'
    else if (e?.statusCode) reason = `GitHub returned ${e.statusCode}`
    else reason = e?.message || 'check failed'
    safeFlog('[update] check failed:', e?.code || '', e?.statusCode || '', e?.message)
    return { updateAvailable: false, currentVersion, error: reason }
  }
}

ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('update:check', () => checkForUpdate())

ipcMain.handle('update:download', async (event) => {
  try {
    // Make sure we have a resolved asset (re-check if needed).
    if (!_pendingUpdate) {
      const info = await checkForUpdate()
      if (!info.updateAvailable || !_pendingUpdate) {
        return { success: false, error: 'no-installer' }
      }
    }
    const { url, name } = _pendingUpdate
    // ВАЖНО: НЕ качаем установщик в userData/updates! В portable-режиме
    // userData находится ВНУТРИ папки установки (...\Spot\data), и установщик,
    // запущенный оттуда, блокирует папку, которую сам должен перезаписать и
    // очистить — NSIS решает, что «Spot всё ещё открыт», и показывает диалог
    // «Не удалось закрыть Spot». Качаем в системную temp-папку: она никак
    // не связана с папкой установки.
    const updatesDir = path.join(os.tmpdir(), 'spot-updates')
    fs.mkdirSync(updatesDir, { recursive: true })
    const dest = path.join(updatesDir, name)

    const send = (payload) => {
      try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:progress', payload) } catch (_) {}
    }
    send({ phase: 'downloading', percent: 0 })

    await downloadWithProgress(url, dest, (received, total) => {
      const percent = total ? Math.round((received / total) * 100) : 0
      send({ phase: 'downloading', percent, received, total })
    })

    send({ phase: 'installing', percent: 100 })
    flog('[update] downloaded installer:', dest)

    // Launch the installer so that it starts AFTER this app has fully exited.
    // Previously we spawned the installer and then quit — but Electron runs
    // several processes and graceful shutdown takes time, so the installer's
    // "close the running app" check fired while Spot was still alive and threw
    // the "Не уда��ос�� закрыть Spot" dialog. To avoid the race we:
    //   1) launch the installer through a short delayed shell wrapper so it
    //      only really begins a couple seconds later, once we're gone, and
    //   2) hard-exit every Electron process immediately with app.exit(0).
    //
    // Важно: инсталлятор нужно запустить ПОСЛЕ того, как Spot полностью
    // завершится, иначе NSIS найдёт заблокированные файлы и выдаст диалог
    // «Не удалось закрыть Spot». Используем cmd.exe /c timeout как отдельный
    // процесс-таймер: он подождёт 4 секунды и только потом запустит установщик.
    // Тем временем app.exit(0) немедленно убивает все процессы Electron.
    // Убиваем дочерние процессы (spotdl/yt-dlp/ffmpeg) ДО выхода,
    // чтобы process.on('exit') → killAllActive() не блокировал завершение
    // и app.exit(0) сработал быстро.
    try { killAllActive() } catch (_) {}

    // КРИТИЧНО: явно убиваем дочерний Next.js-сервер. Он запущен через
    // process.execPath (ELECTRON_RUN_AS_NODE=1), поэтому в системе он тоже
    // называется Spot.exe, и app.exit(0) его НЕ завершает — на Windows дочерние
    // процессы переживают смерть родителя. Именно этот «второй Spot.exe»
    // продолжал висеть и держать файлы открытыми, из-за чего установщик
    // ругался, что Spot всё ещё открыт.
    try {
      if (nextServer && nextServer.pid) {
        if (process.platform === 'win32') {
          try { execSync(`taskkill /F /T /PID ${nextServer.pid}`, { timeout: 3000 }) } catch (_) {}
        } else {
          try { nextServer.kill('SIGKILL') } catch (_) {}
        }
        nextServer = null
      }
    } catch (_) {}

    try {
      if (process.platform === 'win32') {
        // wscript.exe + VBS + mshta: тихая установка с современным окном.
        const tempDir = app.getPath('temp')
        const htaPath = path.join(tempDir, 'spot_update.hta')
        const flagPath = path.join(tempDir, 'spot_update_done.flag')
        try { if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath) } catch (_) {}

        // Безрамочное окно обновления (без системного заголовка/навбара).
        // Русский текст задан HTML-сущностями (&#XXXX;) = чистый ASCII, поэтому
        // кодировка не может "поехать" независимо от того, как сохранён файл.
        // Без <!DOCTYPE> и без x-ua-compatible: только так mshta применяет
        // border=none / caption=no и убирает системную рамку окна.
        const flagForHta = flagPath.replace(/\\/g, '\\\\')
        const htaContent = [
          '<html>',
          '<head>',
          '<hta:application id="spotUp" application="yes" border="none" caption="no" sysmenu="no" maximizebutton="no" minimizebutton="no" showintaskbar="no" scroll="no" contextmenu="no" selection="no" innerborder="no"></hta:application>',
          '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">',
          '<title>Spot</title>',
          '<style>',
          'html,body{margin:0;padding:0;height:100%;background:#101312;overflow:hidden;font-family:"Segoe UI",Arial,sans-serif;}',
          '.wrap{padding:26px 30px;}',
          '.logo{width:56px;height:56px;background:#1DB954;text-align:center;line-height:56px;font-size:30px;color:#101312;font-weight:bold;}',
          '.logocell{vertical-align:middle;}',
          '.metacell{vertical-align:middle;padding-left:16px;}',
          '.title{color:#ffffff;font-size:20px;font-weight:bold;}',
          '.sub{color:#9aa3a0;font-size:13px;margin-top:5px;}',
          '.barbg{margin-top:24px;height:6px;background:#26302c;position:relative;overflow:hidden;}',
          '.bar{position:absolute;top:0px;left:-40%;width:40%;height:6px;background:#1DB954;}',
          '.hint{color:#5f6b66;font-size:11px;margin-top:16px;}',
          '</style>',
          '</head>',
          '<body>',
          '<div class="wrap">',
          '<table cellpadding="0" cellspacing="0" border="0"><tr>',
          '<td class="logocell"><div class="logo">&#9835;</div></td>',
          '<td class="metacell"><div class="title">Spot</div><div class="sub">&#1059;&#1089;&#1090;&#1072;&#1085;&#1072;&#1074;&#1083;&#1080;&#1074;&#1072;&#1077;&#1084; &#1086;&#1073;&#1085;&#1086;&#1074;&#1083;&#1077;&#1085;&#1080;&#1077;&#8230;</div></td>',
          '</tr></table>',
          '<div class="barbg"><div class="bar" id="bar"></div></div>',
          '<div class="hint">&#1055;&#1088;&#1080;&#1083;&#1086;&#1078;&#1077;&#1085;&#1080;&#1077; &#1079;&#1072;&#1087;&#1091;&#1089;&#1090;&#1080;&#1090;&#1089;&#1103; &#1072;&#1074;&#1090;&#1086;&#1084;&#1072;&#1090;&#1080;&#1095;&#1077;&#1089;&#1082;&#1080;</div>',
          '</div>',
          '<script language="javascript">',
          'window.resizeTo(430,196);',
          'window.moveTo(Math.floor((screen.availWidth-430)/2),Math.floor((screen.availHeight-196)/2));',
          'var b=document.getElementById("bar");var p=-40;',
          'setInterval(function(){p+=4;if(p>100){p=-40;}b.style.left=p+"%";},60);',
          'try{var fso=new ActiveXObject("Scripting.FileSystemObject");var flag="' + flagForHta + '";setInterval(function(){try{if(fso.FileExists(flag)){window.close();}}catch(e){}},700);}catch(e){}',
          '</script>',
          '</body>',
          '</html>'
        ].join('\r\n')
        fs.writeFileSync(htaPath, htaContent, 'utf8')

        const vbsPath = path.join(tempDir, 'spot_update.vbs')
        const escapedDest = dest.replace(/"/g, '""')
        const escapedHta = htaPath.replace(/"/g, '""')
        const escapedFlag = flagPath.replace(/"/g, '""')
        const escapedExe = process.execPath.replace(/"/g, '""')
        const vbsContent = [
          'Set sh = CreateObject("WScript.Shell")',
          'Set fso = CreateObject("Scripting.FileSystemObject")',
          'sh.Run "mshta.exe ""' + escapedHta + '""", 0, False',
          'WScript.Sleep 2000',
          'sh.Run "taskkill /F /IM spotdl.exe /T", 0, True',
          'sh.Run "taskkill /F /IM yt-dlp.exe /T", 0, True',
          'sh.Run "taskkill /F /IM ffmpeg.exe /T", 0, True',
          'For i = 1 To 15',
          '  rc = sh.Run("taskkill /F /IM Spot.exe /T", 0, True)',
          '  If rc <> 0 Then Exit For',
          '  WScript.Sleep 1000',
          'Next',
          'WScript.Sleep 2000',
          'sh.Run """' + escapedDest + '"" /S", 0, True',
          'On Error Resume Next',
          'fso.CreateTextFile("' + escapedFlag + '", True).Close',
          'On Error GoTo 0',
          'WScript.Sleep 800',
          'sh.Run """' + escapedExe + '""", 1, False'
        ].join('\r\n')
        fs.writeFileSync(vbsPath, vbsContent, 'utf8')
        const child = spawn('wscript.exe', [vbsPath], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        })
        child.unref()
      } else {
        const child = spawn(
          'sh',
          ['-c', `sleep 10 && "${dest}"`],
          { detached: true, stdio: 'ignore' }
        )
        child.unref()
      }
    } catch (e) {
      safeFlog('[update] launch failed:', e?.message)
    }

    // Немедленно уничтожаем все окна и выходим — до того, как инсталлятор
    // начнёт копировать файлы (он ��дёт 4 секунды выше).
    try {
      app.removeAllListeners('window-all-closed')
      BrowserWindow.getAllWindows().forEach((w) => { try { w.destroy() } catch (_) {} })
    } catch (_) {}
    app.exit(0)

    return { success: true, path: dest }
  } catch (e) {
    safeFlog('[update] download failed:', e?.message)
    try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:progress', { phase: 'error', error: e?.message }) } catch (_) {}
    return { success: false, error: e?.message || 'download failed' }
  }
})

// ── App boot ──
app.whenReady().then(async () => {
  try {
    flog('[boot] app ready, dev mode:', isDev, 'electron:', process.versions.electron, 'platform:', process.platform)
  } catch (_) {}

  try {
    await createSplash()
    flog('[boot] splash created')
  } catch (e) {
    safeFlog('[boot] splash failed (continuing):', e?.message)
  }

  splashSend('status', 'Checking for download tools...')
  splashSend('progress', 10)
  await new Promise(r => setTimeout(r, 1000))

  // Ensure tools with 20s timeout — continue anyway if stuck
  const skipPromise = new Promise(resolve => {
    const check = async () => {
      try {
        if (splashWindow && !splashWindow.isDestroyed()) {
          const skip = await splashWindow.webContents.executeJavaScript('window.__skipRequested || false')
          if (skip) { resolve(); return }
        }
      } catch (_) {}
      setTimeout(check, 500)
    }
    check()
  })

  try {
    await Promise.race([
      ensureTools(),
      new Promise(resolve => setTimeout(() => {
        flog('[boot] ensureTools timeout — continuing anyway')
        resolve()
      }, 20000)),
      skipPromise
    ])
    flog('[boot] ensureTools done')
  } catch (e) {
    safeFlog('[boot] ensureTools failed (continuing):', e?.message)
  }

  // Provision spotdl's runtime deps (ffmpeg + Deno) in the background so the
  // first YouTube download doesn't fail. Not awaited here — the download
  // pipeline awaits the same cached promise before it spawns spotdl.
  ensureSpotdlDeps((label) => splashSend('status', label)).catch((e) =>
    console.error('[boot] ensureSpotdlDeps error:', e?.message)
  )

  splashSend('status', 'Starting application...')
  splashSend('progress', 90)

  // Register custom spotget:// protocol for local file playback / metadata loading.
  // Uses net.fetch + pathToFileURL for robust, standards-compliant file serving
  // that supports range requests (needed for audio seeking) without manual buffering.
  // NOTE: protocol.handle throws if the scheme is already registered (can happen
  // on hot restarts) — that must never prevent the window from opening.
  try {
    protocol.handle('spotget', async (request) => {
      try {
        const filePath = spotgetUrlToPath(request.url)
        flog('[spotget protocol] request:', request.url, '→', filePath, fs.existsSync(filePath) ? 'OK' : 'MISSING')
        if (!filePath || !fs.existsSync(filePath)) {
          return new Response('Not Found', { status: 404 })
        }
        // Convert native path → file:// URL → fetch via Electron's net module.
        // This handles range requests, correct MIME types, and Cyrillic/spaces.
        const fileUrl = pathToFileURL(filePath).toString()
        return await net.fetch(fileUrl, { bypassCustomProtocolHandlers: true })
      } catch (e) {
        safeFlog('[spotget protocol]', e?.message)
        return new Response('Not Found', { status: 404 })
      }
    })
    flog('[boot] spotget protocol registered')
  } catch (e) {
    safeFlog('[boot] protocol.handle failed (continuing):', e?.message)
  }

  try {
    await startNextServer()
    flog('[boot] next server ready')
  } catch (e) {
    safeFlog('[boot] startNextServer failed (continuing):', e?.message)
  }

  splashSend('status', 'Ready!')
  splashSend('progress', 100)
  await new Promise(r => setTimeout(r, 600))

  flog('[boot] creating main window, loading ' + SERVER_URL)
  createWindow()

  mainWindow.once('ready-to-show', () => {
    flog('[boot] ready-to-show fired — showing window')
    closeSplash()
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools()
  })

  // Fallback: if ready-to-show doesn't fire in 8s, force show anyway
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      safeFlog('[boot] ready-to-show timeout — forcing show')
      closeSplash()
      mainWindow.show()
      if (isDev) mainWindow.webContents.openDevTools()
    }
  }, 8000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  safeFlog('[app] window-all-closed — quitting')
  killAllActive()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => safeFlog('[app] before-quit'))

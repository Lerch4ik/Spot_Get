; Custom NSIS hooks for the Spot installer.

; Этот макрос срабатывает ПЕРЕД распаковкой файлов новой версии
!macro customInit
  ; Жестко завершаем процесс Spot.exe и все его дочерние подпроцессы
  nsExec::Exec 'taskkill /F /IM Spot.exe /T'
  
  ; На всякий случай гасим зависшие процессы electron, если они есть
  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  
  ; Ждём 5 секунд — Windows может держать lock на файлы (Defender, антивирус)
  ; ещё несколько секунд после смерти процесса. 1 сек было мало.
  Sleep 5000
!macroend

; ПОЛНОСТЬЮ заменяем стандартную проверку electron-builder «приложение запущено».
; Стандартная (_CHECK_APP_RUNNING из allowOnlyOneInstallerInstance.nsh) находит
; процесс Spot.exe и показывает диалог «Не удалось закрыть Spot».
; Проблема в том, что встроенный Next.js-сервер запускается через process.execPath
; и тоже называется Spot.exe — он мог пережить закрытие приложения.
; Наша версия молча убивает все процессы и ждёт, пока они реально исчезнут,
; без каких-либо диалогов. Благодаря этому патч node_modules (scripts/patch-nsis.js)
; больше не нужен.
!macro customCheckAppRunning
  ; МАЯЧОК для диагностики: если после установки файл %TEMP%\spot-nsis-check.log
  ; СУЩЕСТВУЕТ — значит этот макрос реально попал в сборку и выполнился.
  nsExec::Exec 'cmd /c echo customCheckAppRunning executed > "$TEMP\spot-nsis-check.log"'
  ; Сначала гасим всё, что может держать файлы в папке установки
  nsExec::Exec 'taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  nsExec::Exec 'taskkill /F /T /IM spotdl.exe'
  nsExec::Exec 'taskkill /F /T /IM yt-dlp.exe'
  nsExec::Exec 'taskkill /F /T /IM ffmpeg.exe'
  Sleep 1000
  ; Ждём до ~10 секунд, пока не останется ни одного процесса
  StrCpy $R1 0
  ${Do}
    IntOp $R1 $R1 + 1
    ; findstr возвращает 0, если процесс всё ещё жив
    nsExec::Exec 'cmd /c tasklist /NH /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" | findstr /I /C:"${APP_EXECUTABLE_FILENAME}"'
    Pop $R0
    ${If} $R0 != 0
      ${ExitDo} ; процессов больше нет — можно ставить
    ${EndIf}
    nsExec::Exec 'taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
    Sleep 1000
  ${LoopUntil} $R1 >= 10
  ; Небольшая пауза: Windows может освобождать файловые lock'и с задержкой
  Sleep 500
!macroend

; Этот макрос срабатывает при удалении программы
!macro customUnInstall
  RMDir /r "$INSTDIR\data"
!macroend
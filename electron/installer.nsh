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

; Этот макрос срабатывает при удалении программы
!macro customUnInstall
  RMDir /r "$INSTDIR\data"
!macroend
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../node_modules/app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh'
);

if (!fs.existsSync(file)) {
  console.log('[patch-nsis] File not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(file, 'utf8');

// Уже пропатчено?
if (content.includes('PATCHED_BY_SPOT')) {
  console.log('[patch-nsis] Already patched, skipping.');
  process.exit(0);
}

// 1. Добавляем /F /T к первому taskkill (graceful попытка)
content = content.replace(
  /nsExec::Exec `taskkill \/im "\$\{APP_EXECUTABLE_FILENAME\}"/g,
  'nsExec::Exec `taskkill /F /T /im "${APP_EXECUTABLE_FILENAME}"'
);

// 2. Добавляем /F /T ко второму taskkill (force)
content = content.replace(
  /nsExec::Exec `taskkill \/f \/im "\$\{APP_EXECUTABLE_FILENAME\}"/g,
  'nsExec::Exec `taskkill /F /T /im "${APP_EXECUTABLE_FILENAME}"'
);

// 3. Заменяем диалог "Не удалось закрыть" на автоматический выход
// Вместо показа MessageBox просто выходим из установщика (Quit) или продолжаем
content = content.replace(
  /# App likely running with elevated permissions\.\s*\n\s*# Ask user to close it manually\s*\n\s*\$\{if\} \$R1 > 1\s*\n\s*MessageBox MB_RETRYCANCEL\|MB_ICONEXCLAMATION "\$\(appCannotBeClosed\)" \/SD IDCANCEL IDRETRY loop\s*\n\s*Quit\s*\n\s*\$\{else\}/,
  '# PATCHED_BY_SPOT: skip dialog, just retry\n        ${if} $R1 > 10\n          Goto not_running\n        ${else}'
);

fs.writeFileSync(file, content, 'utf8');
console.log('[patch-nsis] Patched successfully.');

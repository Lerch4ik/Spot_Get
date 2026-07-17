/**
 * Патчит шаблон NSIS electron-builder, чтобы установщик НИКОГДА не показывал
 * диалог «Не удалось закрыть Spot» (appCannotBeClosed).
 *
 * Запускается автоматически перед сборкой (см. scripts.dist в package.json).
 * Если патч не удалось применить — сборка падает с ошибкой, чтобы нельзя было
 * незаметно собрать установщик со старым поведением.
 */
const fs = require('fs');
const path = require('path');

// Надёжно находим app-builder-lib даже при pnpm / вложенных node_modules —
// прямой путь node_modules/app-builder-lib существует не во всех менеджерах пакетов.
let base;
try {
  base = path.dirname(
    require.resolve('app-builder-lib/package.json', {
      paths: [path.join(__dirname, '..')],
    })
  );
} catch (e) {
  console.error('[patch-nsis] ОШИБКА: app-builder-lib не найден. Сначала установите зависимости (npm install).');
  process.exit(1);
}

const file = path.join(base, 'templates', 'nsis', 'include', 'allowOnlyOneInstallerInstance.nsh');

if (!fs.existsSync(file)) {
  console.error('[patch-nsis] ОШИБКА: шаблон не найден: ' + file);
  process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

if (content.includes('PATCHED_BY_SPOT')) {
  console.log('[patch-nsis] Уже пропатчен: ' + file);
  process.exit(0);
}

const before = content;

// 1. Все taskkill делаем жёсткими (/F) и с убийством дерева процессов (/T),
//    чтобы прибивался и дочерний Next.js-сервер, который тоже называется Spot.exe.
content = content.replace(/taskkill \/f \/im/g, 'taskkill /F /T /im');
content = content.replace(/taskkill \/im/g, 'taskkill /F /T /im');

// 2. Убираем сам диалог: вместо MessageBox + Quit просто ждём и продолжаем
//    установку (к этому моменту все процессы уже добиты жёстким taskkill).
content = content.replace(
  /MessageBox MB_RETRYCANCEL\|MB_ICONEXCLAMATION "\$\(appCannotBeClosed\)"[^\n]*\n(\s*)Quit/,
  '# PATCHED_BY_SPOT: диалог убран, установка продолжается\n$1Sleep 1000'
);

if (content === before || !content.includes('PATCHED_BY_SPOT')) {
  console.error('[patch-nsis] ОШИБКА: не удалось пропатчить шаблон — его структура изменилась.');
  console.error('[patch-nsis] Файл: ' + file);
  process.exit(1);
}

fs.writeFileSync(file, content, 'utf8');
console.log('[patch-nsis] Пропатчен успешно: ' + file);

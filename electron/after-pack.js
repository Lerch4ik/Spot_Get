/**
 * electron-builder afterPack hook.
 *
 * WHY THIS EXISTS:
 * The packaged app was crashing on launch with `Cannot find module 'next'`.
 * The Next.js standalone build correctly produces
 *   .next/standalone/node_modules/next
 * but electron-builder applies special production-dependency filtering to ANY
 * `node_modules` directory it copies via `extraResources`, which prunes the
 * traced standalone modules (notably `next` and its runtime deps). The server
 * then can't resolve `next` and the window stays black.
 *
 * This hook runs AFTER electron-builder finishes packing and copies the
 * standalone `node_modules` straight into the packed app using Node's own fs
 * (which does no filtering), guaranteeing a complete runtime.
 */
const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  const projectRoot = path.resolve(__dirname, '..')
  const standaloneSrc = path.join(projectRoot, '.next', 'standalone')

  // Resolve the resources dir for the current platform.
  // win/linux: <appOutDir>/resources   mac: <appOutDir>/<App>.app/Contents/Resources
  const appOutDir = context.appOutDir
  let resourcesDir = path.join(appOutDir, 'resources')
  if (context.electronPlatformName === 'darwin') {
    const appName = context.packager.appInfo.productFilename
    resourcesDir = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources')
  }

  const destStandalone = path.join(resourcesDir, 'standalone')

  const srcNodeModules = path.join(standaloneSrc, 'node_modules')
  const destNodeModules = path.join(destStandalone, 'node_modules')

  if (!fs.existsSync(srcNodeModules)) {
    throw new Error(
      `[afterPack] ${srcNodeModules} not found. Run \`next build\` (output: 'standalone') before packaging.`
    )
  }

  // Ensure the destination standalone dir exists (electron-builder should have
  // created it via extraResources, but be defensive).
  fs.mkdirSync(destStandalone, { recursive: true })

  // Copy the complete, unfiltered standalone node_modules into the packed app.
  fs.rmSync(destNodeModules, { recursive: true, force: true })
  fs.cpSync(srcNodeModules, destNodeModules, {
    recursive: true,
    dereference: true, // materialize symlinks (pnpm) as real files
  })

  // Sanity check the critical module is actually there.
  const nextPkg = path.join(destNodeModules, 'next', 'package.json')
  if (!fs.existsSync(nextPkg)) {
    throw new Error(`[afterPack] copy completed but ${nextPkg} is missing`)
  }

  console.log(`[afterPack] standalone node_modules copied to ${destNodeModules}`)
}

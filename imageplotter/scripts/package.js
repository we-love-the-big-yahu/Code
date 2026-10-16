'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
(async () => {
  const arch = process.argv[2]; if (!['x64', 'arm64'].includes(arch)) throw new Error('Choose x64 or arm64.');
  const stage = path.join(root, `.stage-${arch}`), out = path.join(root, 'dist');
  await fs.rm(stage, { recursive: true, force: true }); await fs.mkdir(stage, { recursive: true });
  for (const name of ['src', 'package.json', 'package-lock.json', 'LICENSE']) await fs.cp(path.join(root, name), path.join(stage, name), { recursive: true });
  execFileSync(process.execPath, [process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js'), 'ci', '--omit=dev', '--ignore-scripts', `--os=darwin`, `--cpu=${arch}`, '--no-audit', '--no-fund', '--cache', '/tmp/imageplotter-npm-cache'], { cwd: stage, stdio: 'inherit' });
  const { packager } = await import('@electron/packager');
  const version = require('../package.json').devDependencies.electron;
  const checksums = JSON.parse(await fs.readFile(path.join(root, 'node_modules/electron/checksums.json'), 'utf8'));
  const results = await packager({ dir: stage, name: 'ImagePlotter', appBundleId: 'com.imageplotter.desktop', platform: 'darwin', arch,
    electronVersion: version, asar: false, out, overwrite: true, prune: false, icon: path.join(root, 'assets/icon.icns'),
    appVersion: '0.1.0', buildVersion: '1', appCopyright: 'ImagePlotter contributors',
    download: { cacheRoot: '/tmp/imageplotter-electron-cache', checksums },
    extendInfo: { NSHumanReadableCopyright: 'ImagePlotter contributors', NSAccessibilityUsageDescription: 'ImagePlotter uses mouse control to draw your chosen image inside the canvas area you select.' }
  });
  const packaged = results[0], app = path.join(packaged, 'ImagePlotter.app');
  // Keep English resources, avoiding a needlessly large download of unused locales.
  async function trim(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && entry.name.endsWith('.lproj') && !['en.lproj', 'en_US.lproj', 'en_GB.lproj', 'Base.lproj'].includes(entry.name)) await fs.rm(item, { recursive: true, force: true });
      else if (entry.isDirectory() && entry.name === '_CodeSignature') await fs.rm(item, { recursive: true, force: true });
      else if (entry.isDirectory()) await trim(item);
    }
  }
  await trim(app);
  if (process.platform === 'darwin') {
    async function signModules(directory) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await signModules(file);
        else if (entry.isFile() && entry.name.endsWith('.node')) execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', file], { stdio: 'inherit' });
      }
    }
    await signModules(path.join(app, 'Contents/Resources/app/node_modules'));
    execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--entitlements', path.join(root, 'assets/entitlements.plist'), app], { stdio: 'inherit' });
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  }
  for (const [from, to] of [['assets/Install-ImagePlotter.command', 'Install-ImagePlotter.command'], ['assets/entitlements.plist', 'entitlements.plist'], ['README.md', 'READ-ME-FIRST.md']]) await fs.copyFile(path.join(root, from), path.join(packaged, to));
  await fs.chmod(path.join(packaged, 'Install-ImagePlotter.command'), 0o755);
  execFileSync('python3', [path.join(root, 'scripts/zip-app.py'), packaged, path.join(out, `ImagePlotter-Mac-${arch === 'x64' ? 'Intel' : 'Apple-Silicon'}.zip`)], { stdio: 'inherit' });
  console.log(`Packaged ${arch}. Signing performed here: ${process.platform === 'darwin'}. Live Mac drawing still needs user validation.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

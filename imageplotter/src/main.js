'use strict';
const { app, BrowserWindow, ipcMain, screen, shell, globalShortcut, Menu, Tray, nativeImage, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
protocol.registerSchemesAsPrivileged([{ scheme: 'imageplotter', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const { DrawingEngine } = require('./drawing-engine');
const { validatePlan, fitRect } = require('./planner');
const { MacMouse } = require('./mac-mouse');
app.setName('ImagePlotter');
if (!app.requestSingleInstanceLock()) app.quit();
let main, mouse, engine, area = null, picking = null, tray, quitting = false;
const emit = state => {
  if (main && !main.isDestroyed()) main.webContents.send('drawing:progress', state);
  if (tray && process.platform === 'darwin') {
    tray.setTitle(state.phase === 'countdown' ? String(state.seconds) : state.phase === 'drawing' ? `${Math.round(state.completed / state.total * 100)}%` : '');
    tray.setToolTip(state.phase === 'drawing' ? `ImagePlotter: ${state.completed}/${state.total} strokes — Escape stops` : 'ImagePlotter — Escape stops drawing');
  }
};
function mouseAPI() { if (!mouse) mouse = new MacMouse(); return mouse; }
function state() {
  let permission = false, error = null;
  try { permission = mouseAPI().hasPermission(); } catch (e) { error = e.message; }
  return { permission, area, running: !!engine?.running, platform: process.platform, error, version: app.getVersion() };
}
function trusted(event, overlay = false) {
  if (overlay) return picking?.windows.some(window => !window.isDestroyed() && event.sender === window.webContents);
  return main && !main.isDestroyed() && event.sender === main.webContents;
}
function restore() {
  if (quitting || !main || main.isDestroyed()) return;
  if (engine?.running) engine.stop();
  main.show(); main.focus();
}
function cancelPicker() { if (picking) picking.finish(null); }
function createWindow() {
  main = new BrowserWindow({ width: 1140, height: 850, minWidth: 960, minHeight: 740, title: 'ImagePlotter', backgroundColor: '#f4f5f0', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
  main.loadURL('imageplotter://app/index.html');
  main.once('ready-to-show', () => { if (!process.argv.includes('--smoke-test')) main.show(); });
  if (process.argv.includes('--smoke-test')) {
    const timeout = setTimeout(() => { console.error('Smoke test timed out'); app.exit(1); }, 30000);
    main.webContents.once('did-finish-load', async () => {
      try {
        const native = mouseAPI();
        if (typeof native.hasPermission() !== 'boolean') throw new Error('Accessibility API failed to load.');
        const result = await main.webContents.executeJavaScript(`new Promise((resolve,reject) => {
          const worker = new Worker('planner-worker.js');
          worker.onerror = e => reject(new Error(e.message));
          worker.onmessage = e => { worker.terminate(); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.plan.paths.length); };
          const rgba=new Uint8ClampedArray(40*40*4);
          for(let y=0;y<40;y++)for(let x=0;x<40;x++){const i=(y*40+x)*4,v=x>8&&x<31&&y>8&&y<31?0:255;rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=255;}
          worker.postMessage({id:1,rgba:rgba.buffer,width:40,height:40,options:{mode:'outline',sensitivity:65}},[rgba.buffer]);
        })`);
        if (!result) throw new Error('The packaged worker produced no strokes.');
        clearTimeout(timeout); console.log('PASS packaged Mac UI, worker and native API loading. No mouse events posted.'); app.exit(0);
      } catch (error) { clearTimeout(timeout); console.error(error); app.exit(1); }
    });
  }
  main.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  main.webContents.on('will-navigate', event => event.preventDefault());
  main.on('close', () => { engine?.stop(); cancelPicker(); });
}
async function chooseArea() {
  if (engine?.running) throw new Error('Stop the drawing before changing the canvas.');
  if (picking) throw new Error('Canvas selection is already open.');
  main.hide();
  return new Promise(resolve => {
    const windows = [];
    picking = { windows, finish: rect => {
      const old = picking; if (!old) return; picking = null;
      for (const win of old.windows) if (!win.isDestroyed()) win.destroy();
      if (rect) area = rect;
      restore(); resolve(area);
    } };
    try {
      for (const display of screen.getAllDisplays()) {
        const win = new BrowserWindow({ ...display.bounds, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
          hasShadow: false, enableLargerThanScreen: true, show: false, webPreferences: { preload: path.join(__dirname, 'area-preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
        win.canvasDisplay = display; windows.push(win);
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.webContents.on('will-navigate', event => event.preventDefault());
        win.loadURL('imageplotter://app/area.html');
        win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
        win.on('closed', () => { if (picking?.windows.includes(win)) cancelPicker(); });
      }
    } catch (error) { picking?.finish(null); emit({ phase: 'error', message: error.message }); }
  });
}
function validArea() {
  if (!area) throw new Error('Choose the drawing canvas first.');
  const display = screen.getAllDisplays().find(d => String(d.id) === area.displayId);
  if (!display || JSON.stringify(display.bounds) !== JSON.stringify(area.displayBounds)) { area = null; throw new Error('The display changed. Select the canvas again.'); }
  return area;
}
ipcMain.handle('drawing:state', event => { if (!trusted(event)) throw new Error('Invalid caller.'); return state(); });
ipcMain.handle('drawing:permission', async event => {
  if (!trusted(event)) throw new Error('Invalid caller.');
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'); return true;
});
ipcMain.handle('drawing:choose-area', event => { if (!trusted(event)) throw new Error('Invalid caller.'); return chooseArea(); });
ipcMain.on('drawing:area-picked', (event, rect) => {
  if (!trusted(event, true)) return;
  const win = picking.windows.find(w => w.webContents === event.sender), display = win.canvasDisplay, b = display.bounds;
  if (!rect || ['x', 'y', 'width', 'height'].some(k => typeof rect[k] !== 'number' || !Number.isFinite(rect[k])) || rect.x < 0 || rect.y < 0 || rect.width < 30 || rect.height < 30 || rect.x + rect.width > b.width + 1 || rect.y + rect.height > b.height + 1) return;
  picking.finish({ x: b.x + rect.x, y: b.y + rect.y, width: rect.width, height: rect.height, displayId: String(display.id), displayBounds: b });
});
ipcMain.on('drawing:area-cancel', event => { if (trusted(event, true)) cancelPicker(); });
ipcMain.handle('drawing:stop', event => { if (!trusted(event)) throw new Error('Invalid caller.'); engine?.stop(); return true; });
ipcMain.handle('drawing:start', async (event, plan, settings) => {
  if (!trusted(event)) throw new Error('Invalid caller.');
  if (engine?.running) throw new Error('A drawing is already running.');
  validatePlan(plan); const canvas = validArea(); fitRect(canvas, plan.width, plan.height);
  const api = mouseAPI(); if (!api.hasPermission()) throw new Error('Allow ImagePlotter in System Settings → Privacy & Security → Accessibility, then reopen the app if needed.');
  const speed = Number(settings?.speed); if (!Number.isFinite(speed) || speed < 100 || speed > 1600) throw new Error('Invalid drawing speed.');
  const escapeRegistered = globalShortcut.register('Escape', () => engine?.stop());
  if (!escapeRegistered) throw new Error('The Escape stop shortcut could not be registered. Close other apps using that shortcut and try again.');
  globalShortcut.register('CommandOrControl+Alt+S', () => engine?.stop());
  engine = new DrawingEngine(api); engine.on('progress', emit); main.hide();
  try { const result = await engine.run(plan, canvas, { speed, countdown: 5 }); emit({ phase: result.stopped ? 'stopped' : 'done', ...result }); return result; }
  catch (error) { emit({ phase: 'error', message: error.message }); throw error; }
  finally { globalShortcut.unregister('Escape'); globalShortcut.unregister('CommandOrControl+Alt+S'); restore(); }
});
app.whenReady().then(() => {
  protocol.handle('imageplotter', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
    let file;
    try { file = path.resolve(__dirname, '.' + decodeURIComponent(url.pathname)); } catch { return new Response('Bad path', { status: 400 }); }
    if (!file.startsWith(__dirname + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ImagePlotter', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] }
  ]));
  createWindow();
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png')); icon.setTemplateImage(true);
  tray = new Tray(icon); tray.setToolTip('ImagePlotter — Escape stops drawing');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open ImagePlotter', click: restore }, { label: 'Stop drawing', click: () => engine?.stop() }, { type: 'separator' }, { role: 'quit' }]));
  screen.on('display-metrics-changed', () => { engine?.stop(); area = null; });
  screen.on('display-removed', () => { engine?.stop(); area = null; });
});
app.on('second-instance', () => restore());
app.on('activate', () => { if (!main || main.isDestroyed()) createWindow(); else restore(); });
app.on('before-quit', () => { quitting = true; engine?.stop(); cancelPicker(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

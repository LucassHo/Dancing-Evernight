import { app, BrowserWindow, globalShortcut, screen, ipcMain, Tray, Menu, dialog, nativeImage } from 'electron';
import type { MenuItemConstructorOptions, NativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isMac = process.platform === 'darwin';

let initMouse = true;
let win: BrowserWindow | null = null;
let configWin: BrowserWindow | null = null;
let tray: Tray | null = null;

const settingPath = path.join(__dirname, './assets/settings.json');
const gifsDir = path.join(__dirname, './assets/gifs');

interface WindowConfig {
  width: number;
  height: number;
  x: number;
  y: number;
  gif: string;
}

function isWindowConfig(data: unknown): data is WindowConfig {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d['width'] === 'number' &&
    typeof d['height'] === 'number' &&
    typeof d['x'] === 'number' &&
    typeof d['y'] === 'number' &&
    typeof d['gif'] === 'string'
  );
}

let config: WindowConfig = {
  width: 200,
  height: 200,
  x: -10,
  y: 0,
  gif: 'Evernight.gif'
};

let screenW = 0;
let screenH = 0;

interface GifWindow {
  id: number;
  win: BrowserWindow;
  gif: string;
}

let gifWindows: GifWindow[] = [];
let nextWindowId = 1;

function loadConfig(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  screenW = screenWidth;
  screenH = screenHeight;
  config.y = screenHeight - 200 + 10;

  try {
    if (fs.existsSync(settingPath)) {
      const raw = fs.readFileSync(settingPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (isWindowConfig(parsed)) config = parsed;
    }
  } catch (err) {
    console.error('Failed to load config, using defaults', err);
  }
}

function saveConfig(): void {
  try {
    fs.writeFileSync(settingPath, JSON.stringify(config, null, 2));
    console.log(`Config saved to ${settingPath}`);
  } catch (err) {
    console.error('Failed to save config', err);
  }
}

function getGifList(): string[] {
  try {
    return fs.readdirSync(gifsDir).filter(f => /\.(gif|webp)$/i.test(f));
  } catch {
    return [];
  }
}

function getTrayImage(): string | NativeImage {
  const icoPath = path.join(__dirname, './assets/Evernight.ico');
  const pngPath = path.join(__dirname, './assets/Evernight.png');
  // macOS menu-bar icons must be small PNGs (.ico is not supported); resize so it
  // fits the bar rather than rendering at full logo size.
  if (isMac) {
    return nativeImage.createFromPath(pngPath).resize({ height: 18 });
  }
  return fs.existsSync(icoPath) ? icoPath : pngPath;
}

function updateTray(): void {
  if (!tray) return;

  const active = gifWindows.filter(gw => !gw.win.isDestroyed());

  const template: MenuItemConstructorOptions[] = [
    { label: 'Open Settings', click: () => { createConfigWindow(); } },
    { type: 'separator' }
  ];

  if (active.length > 0) {
    template.push({ label: 'GIF Windows', enabled: false });
    for (const gw of active) {
      template.push({
        label: gw.gif,
        submenu: [
          {
            label: gw.win.isVisible() ? 'Hide' : 'Show',
            click: () => {
              if (gw.win.isVisible()) gw.win.hide();
              else gw.win.show();
              updateTray();
            }
          },
          { label: 'Close', click: () => { gw.win.close(); } }
        ]
      });
    }
    template.push({ type: 'separator' });
  }

  template.push({ label: 'Quit', click: () => { app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createConfigWindow(): void {
  win?.setIgnoreMouseEvents(false);
  if (configWin && !configWin.isDestroyed()) {
    configWin.focus();
    return;
  }

  configWin = new BrowserWindow({
    width: 460,
    height: 620,
    title: 'Configuration',
    resizable: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, './assets/Evernight.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  configWin.setMenuBarVisibility(false);
  configWin.loadFile(path.join(__dirname, './renderer/config.html'));
  configWin.on('closed', () => { configWin = null; win?.setIgnoreMouseEvents(true); });
}

// IPC handlers
ipcMain.handle('get-config', () => ({ ...config, screenW, screenH }));

ipcMain.handle('get-gif-list', () => getGifList());

ipcMain.handle('apply-config', (_event, newConfig: Partial<WindowConfig>) => {
  if (!win || win.isDestroyed()) return { success: false };

  if (newConfig.x !== undefined && newConfig.y !== undefined) {
    win.setPosition(Math.round(newConfig.x), Math.round(newConfig.y));
    config.x = newConfig.x;
    config.y = newConfig.y;
  }

  if (newConfig.width !== undefined && newConfig.height !== undefined) {
    const w = Math.max(50, Math.round(newConfig.width));
    const h = Math.max(50, Math.round(newConfig.height));
    const wasResizable = win.isResizable();
    if (!wasResizable) win.setResizable(true);
    win.setSize(w, h);
    if (!wasResizable) win.setResizable(false);
    config.width = w;
    config.height = h;
  }

  if (newConfig.gif !== undefined && newConfig.gif !== config.gif) {
    config.gif = newConfig.gif;
    void win.loadFile(path.join(__dirname, './renderer/index.html'), { query: { gif: config.gif } });
  }

  return { success: true };
});

ipcMain.handle('upload-gif', async () => {
  if (configWin && !configWin.isDestroyed()) configWin.setAlwaysOnTop(false);

  const parentWin = (configWin && !configWin.isDestroyed()) ? configWin : (win ?? undefined);
  const result = await dialog.showOpenDialog(parentWin!, {
    title: 'Select a GIF',
    filters: [{ name: 'GIF / WebP', extensions: ['gif', 'webp'] }],
    properties: ['openFile']
  });

  if (configWin && !configWin.isDestroyed()) configWin.setAlwaysOnTop(true);

  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

  const srcPath = result.filePaths[0];
  if (srcPath === undefined) return { success: false, canceled: true };

  const fileName = path.basename(srcPath);
  const destPath = path.join(gifsDir, fileName);

  try {
    fs.copyFileSync(srcPath, destPath);
    return { success: true, fileName };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

app.whenReady().then(() => {
  loadConfig();

  win = new BrowserWindow({
    width: config.width,
    height: config.height,
    x: config.x,
    y: config.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    icon: path.join(__dirname, './assets/Evernight.png'),
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const mainId = nextWindowId++;
  gifWindows.push({ id: mainId, win, gif: config.gif });

  const syncBounds = () => {
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    config.x = b.x;
    config.y = b.y;
    config.width = b.width;
    config.height = b.height;
    if (configWin && !configWin.isDestroyed()) {
      configWin.webContents.send('bounds-updated', b);
    }
  };

  win.on('move', syncBounds);
  win.on('resize', syncBounds);
  win.on('closed', () => {
    gifWindows = gifWindows.filter(gw => gw.id !== mainId);
    updateTray();
  });

  win.loadFile(path.join(__dirname, './renderer/index.html'), { query: { gif: config.gif } });
  win.setIgnoreMouseEvents(initMouse);

  // macOS: float above fullscreen apps and show on every Space; run as a
  // menu-bar accessory (no Dock icon) to match the tray-only feel on Windows.
  if (isMac) {
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    app.dock?.hide();
  }

  // System tray / macOS menu bar
  tray = new Tray(getTrayImage());
  tray.setToolTip('Dancing Evernight');
  tray.on('click', () => { createConfigWindow(); });
  updateTray();

  // Keep alive in tray even when all windows are closed
  app.on('window-all-closed', () => { /* intentionally empty */ });

  app.on('before-quit', () => { saveConfig(); });

  // Ctrl/Cmd + - : Quit
  globalShortcut.register('CommandOrControl+-', () => { app.quit(); });

  // Ctrl/Cmd + = : Toggle mouse passthrough (enables dragging)
  globalShortcut.register('CommandOrControl+=', () => {
    if (!win) return;
    // initMouse = !initMouse;
    // win.setIgnoreMouseEvents(initMouse);
    createConfigWindow();
  });

  // Ctrl/Cmd + Shift + \ : Reset to default position and size
  globalShortcut.register('CommandOrControl+Shift+\\', () => {
    if (!win) return;
    win.setPosition(-10, screenH - 200 + 10);
    win.setSize(200, 200);
  });
});

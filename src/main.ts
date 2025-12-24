import { app, BrowserWindow, globalShortcut, screen, ipcMain} from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let initMouse = true;

let win: BrowserWindow | null = null;
// app.disableHardwareAcceleration();

const settingPath = path.join(__dirname, './assets/settings.json');

interface WindowConfig {
  width: number;
  height: number;
  x: number;
  y: number;
  gif: string;
}
function isWindowConfig(data: any): data is WindowConfig {
  return (
    data &&
    typeof data.width === 'number' &&
    typeof data.height === 'number' &&
    typeof data.x === 'number' &&
    typeof data.y === 'number' &&
    typeof data.gif === 'string'
  );
}

let config: WindowConfig = 
{
  width: 200,
  height: 200,
  x: -10,
  y: 0,
  gif: 'Evernight.gif'
};

let screenW: number = 0;
let screenH: number = 0;



function loadConfig(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  screenW = screenWidth;
  screenH = screenHeight;
  config.y = screenHeight - 200 + 10;
  
  // Load Data to config, set to default if settings is invalid/not found
  try {
    if (fs.existsSync(settingPath)) {
      const data = fs.readFileSync(settingPath, 'utf-8');
      const parsedData = JSON.parse(data);
      if (isWindowConfig(parsedData)) {
        config = parsedData;
      }
    }
  } catch (err) {
    console.error("Failed to load config, using defaults", err);
  }
}

function saveConfig(win: BrowserWindow) {
  try {
    fs.writeFileSync(settingPath, JSON.stringify(config, null, 2));
    console.log(`Configuration saved succesfully to ${settingPath}`)
  } catch (err) {
    console.error("Failed to save config", err);
  }
}

let configWin: BrowserWindow | null = null;

function createConfigWindow() {
  if (configWin && !configWin.isDestroyed()) {
    configWin.focus();
    return;
  }

  configWin = new BrowserWindow({
    width: 400,
    height: 500,
    title: "Configuration",
    resizable: true,
    modal: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  configWin.loadFile(path.join(__dirname, './renderer/config.html'));

  configWin.on("closed", () => {
    configWin = null;
  });
}

app.whenReady().then(() => {
  loadConfig();
  if (!config) return;
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

  const updateConfigMemory = () => {
    if (win) {
      const bounds = win.getBounds();
      config.x = bounds.x;
      config.y = bounds.y;
      config.width = bounds.width;
      config.height = bounds.height;
    }
  };

  win.on('move', updateConfigMemory);
  win.on('resize', updateConfigMemory);

  win.loadFile(path.join(__dirname, './renderer/index.html'), {
    query: { gif: config.gif}
  });

  // Save everything to settings when window is closed
  app.on('before-quit', () => {
    if (!win) return;
    saveConfig(win);
    // app.quit();
})

  // Shortcuts
  // Ctrl - Closes the Window
  win.setIgnoreMouseEvents(initMouse);
  globalShortcut.register('Control+-', () => {
    app.quit();
  });

  // For now, Ctrl = allows gif to be moved by cursor
  globalShortcut.register('Control+=', () => {
    if (!win) return;
  // createConfigWindow();
    initMouse = !initMouse;
    win.setIgnoreMouseEvents(initMouse);
  });

  // Ctrl Shift \ resets to default size/position
  globalShortcut.register("Control+Shift+\\", () => {
    if (!win) return;
    win.setPosition(-10, screenH - 200 + 10);
    win.setSize(200, 200);
  });
});

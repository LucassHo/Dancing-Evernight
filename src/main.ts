import { app, BrowserWindow, globalShortcut, screen, ipcMain} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let initMouse = true;

let win: BrowserWindow | null = null;
// app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const defaultConfig = {
  width: 200,
  height: 200,
  x: -10,
  y: screen.getPrimaryDisplay().workAreaSize.height - 200 + 10
  };
  const windowWidth = 200;
  const windowHeight = 200;
  win = new BrowserWindow({
  width: windowWidth,
  height: windowHeight, 
  x: -10,
  y: screenHeight - windowHeight+10,
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

  win.loadFile(path.join(__dirname, './renderer/index.html'));

  win.setIgnoreMouseEvents(initMouse);
  globalShortcut.register('Control+-', () => {
    app.quit();
  });
  globalShortcut.register('Control+=', () => {
    if (!win) return;
    initMouse =!initMouse;
    win.setIgnoreMouseEvents(initMouse);
  });


  // ipcMain.on("resize-window", (event, { width, height }) => {
  // if (win) win.setSize(width, height);
  // });

  globalShortcut.register("Control+Shift+\\", () => {
    if (!win) return;
    win.setPosition(defaultConfig.x, defaultConfig.y);
  });
});

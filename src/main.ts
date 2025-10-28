import { app, BrowserWindow, globalShortcut, screen, ipcMain} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win: BrowserWindow | null = null;
// app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 200;
  const windowHeight = 200;
  win = new BrowserWindow({
  width: windowWidth,
  height: windowHeight, 
  x: -10,
  y: screenHeight - windowHeight+55,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  resizable: false,
  hasShadow: false, 
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false
  }
});

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.setIgnoreMouseEvents(true, {forward: true});
  globalShortcut.register('Control+-', () => {
    app.quit();
  });
});

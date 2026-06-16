// No imports here on purpose: this file is loaded as a classic <script>, so it must
// stay a non-module (any top-level import/export makes tsc emit `export {}`, which is a
// SyntaxError in a classic script). Node's `require` is available because the config
// window is created with nodeIntegration: true / contextIsolation: false.
interface IpcLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}
const ipcRenderer: IpcLike = (window as Window & {
  require(module: string): { ipcRenderer: IpcLike };
}).require('electron').ipcRenderer;

interface ConfigData {
  x: number;
  y: number;
  width: number;
  height: number;
  gif: string;
  screenW: number;
  screenH: number;
}

interface UploadResult {
  success: boolean;
  canceled?: boolean;
  fileName?: string;
  error?: string;
}

function getNum(id: string): number {
  return parseInt((document.getElementById(id) as HTMLInputElement).value, 10);
}

function setNum(id: string, val: number): void {
  (document.getElementById(id) as HTMLInputElement).value = String(val);
}

function setSlider(id: string, val: number, min: number, max: number): void {
  const el = document.getElementById(id) as HTMLInputElement;
  el.min = String(min);
  el.max = String(max);
  el.value = String(val);
}

function showStatus(msg: string, isError = false): void {
  const el = document.getElementById('status') as HTMLParagraphElement;
  el.textContent = msg;
  el.className = isError ? 'error' : '';
  window.setTimeout(() => { el.textContent = ''; el.className = ''; }, 3000);
}

// Push the current form values to the main process so the change is visible immediately.
function pushLive(gif?: string): void {
  void ipcRenderer.invoke('apply-config', {
    x: getNum('posX'),
    y: getNum('posY'),
    width: getNum('width'),
    height: getNum('height'),
    ...(gif !== undefined ? { gif } : {})
  });
}

// Keep a number input and its slider in sync, and live-apply on every change.
function linkInputs(numberId: string, sliderId: string): void {
  const num = document.getElementById(numberId) as HTMLInputElement;
  const slider = document.getElementById(sliderId) as HTMLInputElement;
  num.addEventListener('input', () => { slider.value = num.value; pushLive(); });
  slider.addEventListener('input', () => { num.value = slider.value; pushLive(); });
}

window.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    const config = await ipcRenderer.invoke('get-config') as ConfigData;
    const gifList = await ipcRenderer.invoke('get-gif-list') as string[];

    // Pre-fill number inputs with the current settings
    setNum('posX', config.x);
    setNum('posY', config.y);
    setNum('width', config.width);
    setNum('height', config.height);

    // Slider ranges derived from screen size, then set to the current values
    setSlider('posXSlider', config.x, -200, config.screenW);
    setSlider('posYSlider', config.y, -200, config.screenH);
    setSlider('widthSlider', config.width, 50, 800);
    setSlider('heightSlider', config.height, 50, 800);

    // Bidirectional sync + live preview
    linkInputs('posX', 'posXSlider');
    linkInputs('posY', 'posYSlider');
    linkInputs('width', 'widthSlider');
    linkInputs('height', 'heightSlider');

    // Populate the GIF dropdown from the gifs folder, selecting the active one
    const gifSelect = document.getElementById('gifSelect') as HTMLSelectElement;
    for (const gif of gifList) {
      const opt = document.createElement('option');
      opt.value = gif;
      opt.textContent = gif;
      if (gif === config.gif) opt.selected = true;
      gifSelect.appendChild(opt);
    }
    gifSelect.addEventListener('change', () => { pushLive(gifSelect.value); });

    document.getElementById('applyChanges')!.addEventListener('click', () => {
      pushLive(gifSelect.value);
      showStatus('Settings applied!');
    });

    document.getElementById('resetDefaults')!.addEventListener('click', () => {
      const defaultX = -10;
      const defaultY = config.screenH - 200 + 10;
      setNum('posX', defaultX);
      setNum('posY', defaultY);
      setNum('width', 200);
      setNum('height', 200);
      setSlider('posXSlider', defaultX, -200, config.screenW);
      setSlider('posYSlider', defaultY, -200, config.screenH);
      setSlider('widthSlider', 200, 50, 800);
      setSlider('heightSlider', 200, 50, 800);
      pushLive();
      showStatus('Reset to defaults!');
    });

    document.getElementById('uploadGif')!.addEventListener('click', () => {
      void (async () => {
        const result = await ipcRenderer.invoke('upload-gif') as UploadResult;
        if (result.success && result.fileName) {
          // Reuse the existing option if this filename is already in the list
          let opt = Array.from(gifSelect.options).find(o => o.value === result.fileName);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = result.fileName;
            opt.textContent = result.fileName;
            gifSelect.appendChild(opt);
          }
          gifSelect.value = result.fileName;
          pushLive(result.fileName); // switch the main GIF to the uploaded one
          showStatus(`Added: ${result.fileName}`);
        } else if (!result.canceled) {
          showStatus(`Upload failed: ${result.error ?? 'unknown error'}`, true);
        }
      })();
    });
  })();
});

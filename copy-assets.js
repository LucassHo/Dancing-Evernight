import { cpSync } from 'node:fs';

console.log('Copying assets and renderer files...');

try {
  // Copies the entire assets folder and its contents (gifs, icos, etc.)
  cpSync('src/assets', 'dist/assets', { recursive: true, force: true });
  
  // Copies the renderer folder
  cpSync('src/renderer', 'dist/renderer', { recursive: true, force: true });
  
  console.log('Files copied successfully!');
} catch (err) {
  console.error('Error copying files:', err);
  process.exit(1);
}
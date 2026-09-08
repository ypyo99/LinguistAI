import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = 'C:\\Users\\ypyo9\\.gemini\\antigravity-ide\\brain\\1e139764-3d52-4fe6-91c7-c34929e9cc77\\.user_uploaded\\media_1788872408768.png';
const outDir = path.join(__dirname, 'assets');
const logoPath = path.join(outDir, 'logo.png');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

// First, trim the orange background
sharp(inputPath)
  .trim({
    threshold: 50 // generous threshold to catch the orange
  })
  .toBuffer()
  .then(trimmedBuffer => {
    // Then resize the trimmed (white square) perfectly to 1024x1024, centering it
    return sharp(trimmedBuffer)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent padding around the white square if needed, though for a square it will fit perfectly
      })
      .toFile(logoPath);
  })
  .then(() => {
    console.log('Successfully generated assets/logo.png with orange background removed and perfectly centered!');
  })
  .catch(err => {
    console.error('Error generating logo:', err);
  });

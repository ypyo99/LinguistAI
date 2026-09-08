import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'public/favicon.svg');
const outDir = path.join(__dirname, 'assets');
const logoPath = path.join(outDir, 'logo.png');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

sharp(svgPath)
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 0 }
  })
  .toFile(logoPath)
  .then(() => {
    console.log('Successfully generated assets/logo.png');
  })
  .catch(err => {
    console.error('Error generating logo:', err);
  });

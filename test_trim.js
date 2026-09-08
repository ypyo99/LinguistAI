import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processImage() {
  const inputPath = 'C:\\Users\\ypyo9\\.gemini\\antigravity-ide\\brain\\1e139764-3d52-4fe6-91c7-c34929e9cc77\\.user_uploaded\\media_1788872408768.png';
  const metadata = await sharp(inputPath).metadata();
  console.log('Original Metadata:', metadata);

  // Use trim to remove the orange border. It automatically finds the background color from top-left pixel
  const trimmed = await sharp(inputPath)
    .trim({
      background: '#C15C1C', // approximate orange, but if we omit background it uses top-left pixel
      threshold: 50 // generous threshold
    })
    .toBuffer();
    
  const trimmedMeta = await sharp(trimmed).metadata();
  console.log('Trimmed Metadata:', trimmedMeta);
}

processImage();

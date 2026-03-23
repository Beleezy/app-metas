import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, '../public/icon.svg');
const svg = readFileSync(svgPath);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, `../public/icons/icon-${size}x${size}.png`));
  console.log(`Generated icon-${size}x${size}.png`);
}

console.log('All icons generated!');

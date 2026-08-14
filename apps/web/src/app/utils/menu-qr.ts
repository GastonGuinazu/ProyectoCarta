import { encode } from './uqr-encode';

const QR_DARK = '#171717';
const QR_LIGHT = '#ffffff';

function paintQr(canvas: HTMLCanvasElement, text: string, pixelSize: number): void {
  const { data, size } = encode(text, { ecc: 'H', border: 2 });
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo dibujar el código QR.');
  }

  const cell = pixelSize / size;
  ctx.fillStyle = QR_LIGHT;
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  ctx.fillStyle = QR_DARK;
  for (let y = 0; y < size; y += 1) {
    const row = data[y];
    for (let x = 0; x < size; x += 1) {
      if (row[x]) {
        ctx.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

export function drawMenuQr(canvas: HTMLCanvasElement, url: string): void {
  paintQr(canvas, url, 240);
}

export function menuQrPngDataUrl(url: string, documentRef: Document): string {
  const canvas = documentRef.createElement('canvas');
  paintQr(canvas, url, 1024);
  return canvas.toDataURL('image/png');
}

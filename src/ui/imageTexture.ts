/** Tamaño de la textura: 2:1, como los mapas de planetas (proyección equirectangular). */
const WIDTH = 1024;
const HEIGHT = 512;

export interface SurfaceImage {
  /** Imagen lista para envolver la esfera (JPEG en data URL) */
  dataUrl: string;
  /** Color medio de la imagen, para el punto y la estela del planeta */
  average: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

/**
 * Convierte una foto o dibujo en la superficie de un planeta: la recorta al
 * centro con proporción 2:1 (si ya es un mapa 2:1 se usa entera) y la reduce
 * para que pese poco.
 */
export async function imageToSurface(file: File): Promise<SurfaceImage> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const target = WIDTH / HEIGHT;
  let sw = img.naturalWidth, sh = img.naturalHeight;
  if (sw / sh > target) sw = sh * target;
  else sh = sw / target;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);

  const small = document.createElement('canvas');
  small.width = 16;
  small.height = 8;
  const sctx = small.getContext('2d')!;
  sctx.drawImage(canvas, 0, 0, 16, 8);
  const px = sctx.getImageData(0, 0, 16, 8).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) {
    r += px[i]; g += px[i + 1]; b += px[i + 2];
  }
  const n = px.length / 4;
  const average = (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), average };
}

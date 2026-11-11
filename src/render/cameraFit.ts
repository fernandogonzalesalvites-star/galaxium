/** Distancia de cámara para que `radius * factor` quepa también a lo ancho en pantallas verticales. */
export function fitDistance(radius: number, factor: number, aspect: number): number {
  return (radius * factor) / Math.min(aspect, 1);
}

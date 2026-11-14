/** Distancia de cámara para que `radius * factor` quepa también a lo ancho en pantallas verticales. */
export function fitDistance(radius: number, factor: number, aspect: number): number {
  // Sin tamaño de pantalla todavía (aspecto 0 o inválido) se encuadra como si fuera cuadrada
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  return (radius * factor) / Math.min(a, 1);
}

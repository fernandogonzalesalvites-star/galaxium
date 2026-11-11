import * as THREE from 'three';

/** Campo de estrellas de fondo. Se coloca siempre centrado en la cámara. */
export function createStarfield(count = 4000, radius = 5000): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const brightness = 0.35 + 0.65 * Math.random() ** 3;
    const tint = Math.random();
    colors[i * 3] = brightness * (tint < 0.15 ? 0.8 : 1);
    colors[i * 3 + 1] = brightness * 0.95;
    colors[i * 3 + 2] = brightness * (tint > 0.85 ? 0.8 : 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }),
  );
  points.frustumCulled = false;
  points.renderOrder = -1;
  return points;
}

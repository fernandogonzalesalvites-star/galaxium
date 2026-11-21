import * as THREE from 'three';

export type EclipseKind = 'solar' | 'lunar';

/** Datos de un eclipse para dibujar en un cuerpo, en coordenadas de la escena. */
export interface EclipseShadow {
  kind: EclipseKind;
  /** Centro del cuerpo que tapa la luz (la luna en un eclipse de sol, el planeta en uno de luna) */
  occluder: { x: number; y: number; z: number };
  /** Radio del que tapa (escala del dibujo) */
  radius: number;
  /** Dirección de la luz (unitaria), desde la estrella hacia los cuerpos */
  lightDir: { x: number; y: number; z: number };
}

/**
 * Para cada píxel de la capa: ¿la recta que va de ese punto hacia la estrella
 * pasa por el cuerpo que tapa? Cuanto más cerca del centro de la sombra, más
 * oscuro; el borde se difumina (penumbra). Así la sombra se desliza siguiendo
 * la curva de la superficie, sin saltos, en cada fotograma.
 */
const vertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uOccluder;
  uniform vec3 uLightDir;
  uniform float uRadius;
  uniform float uInner;
  uniform float uOuter;
  uniform vec3 uColor;
  uniform float uMaxAlpha;
  varying vec3 vWorld;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 rel = vWorld - uOccluder;
    float along = dot(rel, uLightDir);
    // El punto tiene que estar «detrás» del que tapa, visto desde la estrella
    float behind = smoothstep(0.0, uRadius * 0.5, along);
    float perp = length(rel - along * uLightDir);
    float shade = 1.0 - smoothstep(uRadius * uInner, uRadius * uOuter, perp);
    float a = shade * behind * uMaxAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/** Cómo se ve cada tipo de eclipse. */
const STYLE: Record<EclipseKind, { color: THREE.Color; inner: number; outer: number; alpha: number }> = {
  // Sombra de la luna sobre el planeta: negra, con penumbra ancha
  solar: { color: new THREE.Color(0x000000), inner: 0.45, outer: 1.35, alpha: 0.85 },
  // Sombra del planeta sobre la luna: rojo oscuro («luna de sangre»), con borde curvo marcado
  lunar: { color: new THREE.Color(0.42, 0.05, 0.02), inner: 0.9, outer: 1.1, alpha: 0.82 },
};

/** Capa transparente apenas por encima de la superficie donde se dibuja la sombra. */
export class EclipseShell {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uOccluder: { value: new THREE.Vector3() },
          uLightDir: { value: new THREE.Vector3(1, 0, 0) },
          uRadius: { value: 1 },
          uInner: { value: 0.5 },
          uOuter: { value: 1.3 },
          uColor: { value: new THREE.Color() },
          uMaxAlpha: { value: 0.85 },
        },
        transparent: true,
        depthWrite: false,
      }),
    );
    this.mesh.visible = false;
  }

  set(shadow: EclipseShadow | null): void {
    this.mesh.visible = shadow !== null;
    if (!shadow) return;
    const u = this.mesh.material.uniforms;
    const s = STYLE[shadow.kind];
    (u.uOccluder.value as THREE.Vector3).set(shadow.occluder.x, shadow.occluder.y, shadow.occluder.z);
    (u.uLightDir.value as THREE.Vector3).set(shadow.lightDir.x, shadow.lightDir.y, shadow.lightDir.z).normalize();
    u.uRadius.value = shadow.radius;
    u.uInner.value = s.inner;
    u.uOuter.value = s.outer;
    (u.uColor.value as THREE.Color).copy(s.color);
    u.uMaxAlpha.value = s.alpha;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

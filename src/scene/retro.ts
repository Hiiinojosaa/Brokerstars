import * as THREE from 'three';

// Filtro estilo PS2: la escena se pinta a baja resolución y luego se
// amplía sin suavizar, reduciendo colores con un tramado (dither) Bayer 4x4.

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 resolution;
  uniform float levels;
  uniform float ditherAmount;
  varying vec2 vUv;

  float bayer4(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0 - 0.5;
    return 0.0;
  }

  void main() {
    // la escena llega en lineal y sin tone mapping: lo aplicamos aquí y
    // pasamos a sRGB antes de reducir colores
    vec3 col = texture2D(tScene, vUv).rgb;
    col = toneMapping(col);
    col = linearToOutputTexel(vec4(col, 1.0)).rgb;
    float d = bayer4(floor(vUv * resolution)) * ditherAmount;
    col = floor(col * levels + 0.5 + d) / levels;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export class RetroPass {
  enabled = true;
  pixelSize = 3;
  private target: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(private renderer: THREE.WebGLRenderer) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
    });
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: this.target.texture },
          resolution: { value: new THREE.Vector2(1, 1) },
          levels: { value: 16 },
          ditherAmount: { value: 0.6 },
        },
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.quadScene.add(this.quad);
  }

  setSize(width: number, height: number) {
    const w = Math.max(1, Math.floor(width / this.pixelSize));
    const h = Math.max(1, Math.floor(height / this.pixelSize));
    this.target.setSize(w, h);
    this.quad.material.uniforms.resolution.value.set(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}

// KG: CONTRACT_LightVisual_PrismDispersion, ATOM_LightVisual_PrismDispersion, SharedType_Landing_ShaderUniforms
// Prism dispersion: RGB 채널별 IOR 분리 (Snell + Cauchy) → 무지개 성운

precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouseXY;
uniform float uScrollY;
uniform int   uRendererState; // 0=active,1=paused,2=recovering

// 3 prism center positions (NDC)
const vec3 PRISM_POS[3] = vec3[3](
  vec3(-0.55,  0.20, 0.0),
  vec3( 0.60, -0.10, 0.0),
  vec3( 0.00,  0.50, 0.0)
);

// Starfield noise
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float stars(vec2 uv) {
  vec2 g = floor(uv * 120.0);
  float n = hash(g);
  if (n > 0.985) {
    vec2 c = (g + 0.5) / 120.0;
    float d = distance(uv, c);
    float tw = 0.5 + 0.5 * sin(uTime * 2.0 + n * 6.28);
    return smoothstep(0.005, 0.0, d) * tw;
  }
  return 0.0;
}

// 삼각 프리즘 근사(거리 필드)
float prismSdf(vec2 uv, vec3 center, float size, float rot) {
  vec2 p = uv - center.xy;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p;
  return max(abs(p.x) - size, abs(p.y) - size * 0.866);
}

// IOR별 굴절 방향 (Cauchy 근사)
vec2 refractUv(vec2 uv, vec2 center, float ior) {
  vec2 d = uv - center;
  return uv - d * (1.0 / ior - 1.0) * 0.15;
}

void main() {
  vec2 fragUv = gl_FragCoord.xy / uResolution.xy;
  vec2 uv = fragUv * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  if (uRendererState != 0) {
    vec3 dim = vec3(0.04, 0.04, 0.1);
    gl_FragColor = vec4(dim, 1.0);
    return;
  }

  // background cosmic
  vec3 col = mix(vec3(0.02, 0.02, 0.08), vec3(0.08, 0.04, 0.18), fragUv.y);
  col += stars(uv);

  // 3 prism rainbow refraction
  for (int i = 0; i < 3; i++) {
    vec3 pc = PRISM_POS[i];
    float rot = uTime * 0.2 + float(i) * 2.1 + uScrollY * 0.001;
    float sdf = prismSdf(uv, pc, 0.25, rot);
    float edge = 1.0 - smoothstep(0.0, 0.02, abs(sdf));
    float inside = 1.0 - smoothstep(0.0, 0.05, sdf);

    vec2 rUv = refractUv(uv, pc.xy, 1.51); // R
    vec2 gUv = refractUv(uv, pc.xy, 1.52); // G
    vec2 bUv = refractUv(uv, pc.xy, 1.53); // B

    vec3 rainbow;
    rainbow.r = stars(rUv) + 0.5 * inside;
    rainbow.g = stars(gUv) + 0.4 * inside;
    rainbow.b = stars(bUv) + 0.6 * inside;

    col += rainbow * (edge * 0.8 + inside * 0.25);
  }

  // mouse attraction glow
  vec2 mouseNdc = (uMouseXY * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
  float md = distance(uv, mouseNdc);
  col += vec3(0.7, 0.9, 1.0) * smoothstep(0.5, 0.0, md) * 0.15;

  gl_FragColor = vec4(col, 1.0);
}

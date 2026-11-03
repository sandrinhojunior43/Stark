// Esfera translúcida "gelatinosa": ray-sphere analítico + ambiente procedural refratado.
// Sem texturas, sem geometria: um único quad em tela cheia, barato para celulares.
export const SPHERE_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const SPHERE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAmp;
uniform float uDark;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.02; a *= 0.5; }
  return s;
}

float fbm2(vec3 p) { return 0.68 * noise(p) + 0.32 * noise(p * 2.03); }

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float ang = atan(p.y, p.x);
  float R = 0.58;
  float wob = 1.0 + (0.008 + 0.014 * uAmp) * sin(ang * 3.0 + uTime * 1.2)
                  + (0.005 + 0.010 * uAmp) * sin(ang * 5.0 - uTime * 1.7);
  float scale = R * wob * (1.0 + 0.04 * uAmp);
  float rr = length(p) / scale;

  // Brilho ao redor e reflexo no "chão" logo abaixo da esfera.
  float halo = exp(-max(rr - 1.0, 0.0) * 4.5) * (0.20 + 0.18 * uAmp);
  vec2 rp = vec2(p.x / (R * 1.05), (p.y + R * 1.20) / (R * 0.20));
  float refl = exp(-dot(rp, rp) * 1.5) * 0.55;
  vec3 glow = halo * mix(uC1, uC0, 0.5) + refl * mix(uC2, uC0, 0.35);
  float glowA = clamp(max(glow.r, max(glow.g, glow.b)), 0.0, 1.0);

  vec3 body = vec3(0.0);
  float alphaS = 0.0;

  if (rr < 1.0) {
    float z = sqrt(1.0 - rr * rr);
    vec3 n = normalize(vec3(p / scale, z));
    vec3 v = vec3(0.0, 0.0, 1.0);
    float ndv = clamp(dot(n, v), 0.0, 1.0);

    vec3 rd = refract(-v, n, 0.72);
    float t = uTime * 0.22;
    vec3 q = n * 2.0 + rd * 0.9;
    float c = cos(t); float s = sin(t);
    q.xz = mat2(c, -s, s, c) * q.xz;

    float w1 = fbm2(q * 0.75 + vec3(0.0, t * 1.0, -t * 0.8));
    float w2 = fbm2(q * 0.95 + 7.0 - vec3(t * 0.8, 0.0, t * 0.6));

    // Fitas luminosas: cristas de uma onda distorcida por ruído (lembram vidro soprado com tinta dentro).
    float u1 = q.x * 0.9 + q.y * 0.7 + w1 * 2.6 + t * 1.2;
    float u2 = q.y * 1.0 - q.x * 0.6 + w2 * 2.8 - t * 1.0;
    float r1 = pow(1.0 - abs(sin(u1 * 3.2)), 2.6);
    float r2 = pow(1.0 - abs(sin(u2 * 2.8)), 3.4);

    vec3 ribbonCol = mix(uC0, uC1, smoothstep(0.3, 0.7, w2));
    ribbonCol = mix(ribbonCol, uC2, smoothstep(0.5, 0.8, w1) * 0.85);
    vec3 ribbonCol2 = mix(uC1, uC2, smoothstep(0.35, 0.75, w1));

    // Volume interno translúcido: azulado no centro, mais luminoso perto da borda.
    vec3 field = mix(uC0, uC1, smoothstep(0.25, 0.75, w1));
    vec3 volume = field * (0.20 + 0.30 * (1.0 - ndv));
    float fres = pow(1.0 - ndv, 2.0);
    body = volume
         + ribbonCol * r1 * (0.45 + 0.45 * (1.0 - ndv)) * 0.95
         + ribbonCol2 * r2 * 0.65
         + mix(uC0, vec3(0.8, 0.95, 1.0), 0.5) * fres * 0.55;

    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fres * 1.4 + t * 0.3));
    body += irid * pow(fres, 1.8) * 0.22;

    // Calor refratado no lado inferior direito e cáustica embaixo, como na referência.
    float warm = smoothstep(0.1, 1.0, dot(n, normalize(vec3(0.65, -0.1, 0.45))));
    body += uC2 * warm * (0.04 + 0.60 * fres);
    float caustic = pow(max(dot(n, normalize(vec3(0.1, -0.8, 0.6))), 0.0), 5.0);
    body += mix(uC0, uC2, 0.5) * caustic * 0.30;

    vec3 L1 = normalize(vec3(-0.45, 0.55, 0.70));
    float h1 = max(dot(n, normalize(L1 + v)), 0.0);
    vec3 L2 = normalize(vec3(0.55, -0.50, 0.60));
    float h2 = max(dot(n, normalize(L2 + v)), 0.0);
    float spec = pow(h1, 70.0) * 0.55 + pow(h1, 10.0) * 0.20 + pow(h2, 30.0) * 0.30;
    float bloom = smoothstep(0.65, 0.0, length(n.xy - vec2(-0.42, 0.50))) * 0.55;
    body += vec3(1.0) * spec + vec3(0.92, 0.96, 1.0) * bloom;

    // No tema claro a borda precisa escurecer um pouco para a esfera aparecer.
    body = mix(body * vec3(0.72, 0.78, 0.9), body, uDark);

    float edge = smoothstep(1.0, 0.985, rr);
    alphaS = clamp(0.78 + 0.22 * fres, 0.0, 1.0) * edge;
    body = clamp(body, 0.0, 1.0) * alphaS;
  }

  vec3 rgb = body + glow * (1.0 - alphaS);
  float a = alphaS + glowA * (1.0 - alphaS);
  gl_FragColor = vec4(min(rgb, vec3(a)), a);
}
`;

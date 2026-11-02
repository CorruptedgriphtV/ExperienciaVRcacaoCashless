/* =====================================================================
   Cacaos Pay VR — núcleo compartido
   Motor 3D, punteros (ratón + mandos Touch), colisiones, locomoción,
   voz, monedero del socio, eventos MQTT simulados y HUD.
   Los módulos de zona (calle, lorenzo, barra-cocina, dispensario)
   importan todo desde aquí. Ver docs/ARQUITECTURA.md.
   ===================================================================== */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
export { THREE };

/* ---------------- configuración de negocio ---------------- */
export const CONFIG = {
  pesosPorMoneda: 10,      // Lorenzo sólo recibe monedas de $10
  pesosPorCacao: 10,       // tipo de cambio peso → cacao
  llaveroPesos: 20,        // precio del llavero NFC
  saldoInicial: 20,        // cacaos de demostración al empezar
  limiteMes: 20,           // gramos al mes en el dispensario
  miradaSegundos: 5,       // desconocido mirando a la cámara antes del aviso
  socioDemo: { uid: 'S-0427', nombre: 'Emilio' },
};

/* ---------------- plano (metros) ----------------
   +z = hacia la calle. El edificio va de z -12 a 12, x -12 a 12.
   Calle      z 12 … 22   (fachada en z = 12, puerta x -1 … 1)
   Lobby      z  4 … 12,  x -6 … 6  (paso al main en z = 4, x -1.2 … 1.2)
   Main       z -5 … 4,   x -12 … 12 (barra al este)
   Cocina     z -12 … -5, x 0 … 12  (puerta x 4 … 5.5, pase x 9 … 11)
   Dispensario z -12 … -5, x -12 … 0 (puerta x -5 … -3)               */
export const PLANO = {
  calle: { x0: -12, x1: 12, z0: 12, z1: 22 },
  lobby: { x0: -6, x1: 6, z0: 4, z1: 12 },
  main: { x0: -12, x1: 12, z0: -5, z1: 4 },
  cocina: { x0: 0, x1: 12, z0: -12, z1: -5 },
  dispensario: { x0: -12, x1: 0, z0: -12, z1: -5 },
  puertaCalle: { x0: -1, x1: 1, z: 12, alto: 2.6 },
  pasoLobby: { x0: -1.2, x1: 1.2, z: 4 },
  puertaCocina: { x0: 4, x1: 5.5, z: -5 },
  pase: { x0: 9, x1: 11, z: -5, y0: 1.0, y1: 1.9 },
  puertaDisp: { x0: -5, x1: -3, z: -5 },
  alturaMuro: 3.4,
};
export function zoneAt(x, z) {
  if (z > 12) return 'calle';
  if (z > 4) return 'lobby';
  if (z > -5) return 'main';
  return x > 0 ? 'cocina' : 'dispensario';
}
export const ZONES = [
  { key: 'calle', name: 'Calle', spot: [0, 18.5], yaw: 0 },
  { key: 'lobby', name: 'Lobby', spot: [-0.6, 8], yaw: Math.PI / 2 },
  { key: 'main', name: 'Barra', spot: [6.6, -0.5], yaw: -Math.PI / 2 },
  { key: 'cocina', name: 'Cocina', spot: [2.2, -8.5], yaw: -Math.PI / 2 },
  { key: 'dispensario', name: 'Dispensario', spot: [-6.3, -7.6], yaw: 0 },
];

/* ---------------- paleta y tipografía ---------------- */
export const C = { cacao900: 0x14100d, cacao800: 0x1e1813, cacao700: 0x2a211a, oro: 0xd4af37, hoja: 0x6a9a52, terracota: 0xc25a36, crema: 0xf6efe2, amarillo: 0xe9c46a };
export const HEX = { bg: '#14100D', panel: '#1E1813', linea: '#3B2F25', oro: '#D4AF37', hoja: '#6A9A52', terracota: '#C25A36', crema: '#F6EFE2', texto: '#D8CBB8', tenue: '#A08F79', ambar: '#E0A23A' };
export const FD = '"Bricolage Grotesque", "Trebuchet MS", sans-serif';
export const FM = '"JetBrains Mono", ui-monospace, monospace';
export const DEG = Math.PI / 180;
export const $ = s => document.querySelector(s);

/* ---------------- motor ---------------- */
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120d0a);
scene.fog = new THREE.Fog(0x120d0a, 22, 48);

export const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);
camera.position.set(0, 1.6, 0);
camera.rotation.order = 'YXZ';
export const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);
export const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2a1c, 1.2));
const sun = new THREE.DirectionalLight(0xffe6c4, 1.1);
sun.position.set(4, 12, 10);
scene.add(sun);

/* ---------------- utilidades de geometría ---------------- */
export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: o.r ?? 0.7, metalness: o.m ?? 0.05,
  emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
  transparent: !!o.t, opacity: o.o ?? 1, side: o.side ?? THREE.FrontSide, map: o.map ?? null,
});
export const M = {
  cacao: mat(0x3b2a1f), cacaoOsc: mat(0x1c1410, { r: .45, m: .2 }), crema: mat(0xe8dcc6),
  muro: mat(0xe2c675, { r: .9 }), oro: mat(C.oro, { m: .75, r: .3 }), acero: mat(0xbcc3c6, { m: .8, r: .32 }),
  madera: mat(0x7a4a2e, { r: .6 }), negro: mat(0x0f0c0a, { r: .35 }), barro: mat(0xb5562f, { r: .85 }),
  vidrio: mat(0xd8eef2, { t: true, o: .16, r: .05, m: .1 }), hoja: mat(0x5f8f47, { r: .8 }),
  nfc: mat(C.hoja, { e: C.hoja, ei: .7 }),
};
export function box(w, h, d, m, x = 0, y = 0, z = 0, parent = scene) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b;
}
export function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, parent = scene, seg = 24) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); parent.add(c); return c;
}
export function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4; return t;
}
/** Pantalla de lienzo: { c, g, tex, mesh }. 512 px de ancho; alto según proporción. */
export function makeScreen(w, h, px = 512) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  return { c, g: c.getContext('2d'), tex, mesh };
}
/** Ajusta el tamaño de fuente hasta que `text` quepa en maxW. Deja g.font listo. */
export function fit(g, text, weight, family, size, maxW) {
  let s = size; do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (g.measureText(text).width > maxW && s > 10); return s + 2;
}
export const fmt = n => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });

/* ---------------- colisiones y objetivos de rayo ---------------- */
const rayTargets = [];
const colliders = [];
/** Bloquea el rayo (no se puede teletransportar a través). */
export function addBlocker(mesh) { mesh.userData.blocker = true; rayTargets.push(mesh); return mesh; }
/** Suelo válido para teletransporte. */
export function addFloor(mesh) { mesh.userData.floor = true; rayTargets.push(mesh); return mesh; }
/** Impide caminar a través. Devuelve { enabled } para abrir/cerrar (puertas). */
export function addCollider(obj) {
  obj.updateMatrixWorld(true);
  const c = { box: new THREE.Box3().setFromObject(obj), enabled: true, obj };
  colliders.push(c); return c;
}
/** Muro/mueble: bloquea rayo y paso. */
export function solid(mesh) { addBlocker(mesh); addCollider(mesh); return mesh; }
/** Recalcula las colisiones que cuelgan de root (tras moverlo). */
export function refreshColliders(root) {
  root.updateMatrixWorld(true);
  for (const c of colliders) { let o = c.obj; while (o && o !== root) o = o.parent; if (o) c.box.setFromObject(c.obj); }
}
export function blockedAt(x, z) {
  if (x < -11.7 || x > 11.7 || z < -11.7 || z > 21.7) return true;
  for (const c of colliders) {
    if (!c.enabled) continue; const b = c.box;
    if (b.max.y < .25 || b.min.y > 1.7) continue;
    if (x > b.min.x - .22 && x < b.max.x + .22 && z > b.min.z - .22 && z < b.max.z + .22) return true;
  }
  return false;
}

/** Hace interactivo un objeto. entry: { id, name, zone, radius?, hint?, movable?,
 *  onSelect(p, hit), onMove?(p, hit), onRelease?(p) }.
 *  hit = intersección de three (point, uv, object, distance). p = puntero. */
export function registerInteractive(root, entry) {
  entry.root = root;
  root.traverse(o => { if (o.isMesh) { o.userData.inter = entry; if (!rayTargets.includes(o)) rayTargets.push(o); } });
  if (entry.movable) movables.push(entry);
  return entry;
}
/** Para piezas que se agregan después a un objeto ya interactivo. */
export function addToInteractive(mesh, entry) { mesh.traverse(o => { if (o.isMesh) { o.userData.inter = entry; rayTargets.push(o); } }); }
export function removeTargets(root) { root.traverse(o => { const i = rayTargets.indexOf(o); if (i >= 0) rayTargets.splice(i, 1); }); }
const movables = [];

/* ---------------- bus de eventos ---------------- */
export const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, e => fn(e.detail));
const updaters = [];
/** fn(dt, now) se llama cada cuadro. */
export function onUpdate(fn) { updaters.push(fn); }

/* ---------------- animaciones ---------------- */
const anims = [];
/** Devuelve el objeto de animación: pon a.cancel = true para detenerla. */
export function anim(dur, fn, done) { const a = { t: 0, dur, fn, done }; anims.push(a); return a; }
export function after(s, fn) { return anim(s, () => {}, fn); }

/* ---------------- audio y voz ---------------- */
let actx = null;
export function ensureAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } }
export function beep(kind = 'info') {
  if (!actx) return;
  const seq = kind === 'ok' ? [[1320, .07], [1760, .1]] : kind === 'err' ? [[330, .14], [220, .22]] : kind === 'coin' ? [[2100, .05], [2600, .09]] : kind === 'campana' ? [[2637, .6], [3520, .5]] : [[990, .08]];
  let t = actx.currentTime;
  for (const [f, d] of seq) {
    const o = actx.createOscillator(), gn = actx.createGain(); o.frequency.value = f; o.type = kind === 'coin' || kind === 'campana' ? 'triangle' : 'sine';
    gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(.18, t + .01); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(gn).connect(actx.destination); o.start(t); o.stop(t + d + .02); t += d + .02;
  }
}
let voice = null;
function pickVoice() {
  try { const vs = speechSynthesis.getVoices(); voice = vs.find(v => /es[-_]MX/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null; } catch (e) { voice = null; }
}
try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch (e) {}
const subPanel = makeScreen(1.1, .2, 1024);
subPanel.mesh.position.set(0, -.32, -1.25); subPanel.mesh.material.transparent = true; subPanel.mesh.material.depthTest = false;
subPanel.mesh.renderOrder = 20; subPanel.mesh.visible = false; camera.add(subPanel.mesh);
let subT = 0;
/** Habla en voz alta (es-MX si existe) y muestra subtítulo en pantalla y en el visor. */
export function say(text, who = 'Sistema', opts = {}) {
  const el = $('#subs');
  if (el) { el.innerHTML = ''; const b = document.createElement('b'); b.textContent = who; el.append(b, document.createTextNode(' ' + text)); el.hidden = false; }
  const { g, c, tex } = subPanel; g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(20,16,13,.88)'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = HEX.oro; g.fillRect(0, 0, 8, c.height);
  g.textBaseline = 'middle'; g.fillStyle = HEX.oro; g.font = `800 34px ${FD}`; g.fillText(who, 28, 40);
  g.fillStyle = HEX.crema; fit(g, text, 600, FD, 40, c.width - 56); g.fillText(text, 28, 120); tex.needsUpdate = true;
  subPanel.mesh.visible = renderer.xr.isPresenting;
  subT = opts.duracion ?? Math.max(3, text.length / 14);
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'es-MX'; if (voice) u.voice = voice;
    u.rate = opts.rate ?? 1; u.pitch = opts.pitch ?? 1;
    if (!opts.encolar) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------------- estado del socio y del Club ---------------- */
function socioDesconocido() {
  return { uid: null, nombre: null, conocido: false, rostro: false, firmaHoy: false, llavero: false, saldo: CONFIG.saldoInicial, limiteMes: CONFIG.limiteMes, dispensadoMes: 0 };
}
/** Estado del visitante. Cámbialo sólo con updateSocio(). */
export const socio = socioDesconocido();
export const ledger = [];
export const stats = { ventas: 0, aportado: 0, tx: 0, entradas: 0, turno: true, cuadre: 0 };
export function updateSocio(patch) { Object.assign(socio, patch); refreshHUD(); emit('socio:cambio', socio); }
/** Cobra en cacaos con el llavero NFC. Devuelve { ok, motivo }. Publica el evento. */
export function cargo(precio, concepto, zone, id, evt = 'cobro') {
  if (!socio.llavero) { publish(zone, id, 'rechazado', { motivo: 'sin_llavero' }, 'err'); return { ok: false, motivo: 'sin_llavero' }; }
  if (socio.saldo < precio) { publish(zone, id, 'rechazado', { uid: socio.uid, motivo: 'saldo', precio }, 'err'); return { ok: false, motivo: 'saldo' }; }
  ledger.unshift({ amt: -precio, concepto }); socio.saldo -= precio; stats.ventas += precio; stats.tx++;
  publish(zone, id, evt, { uid: socio.uid, cacaos: precio, saldo: socio.saldo, debe: socio.uid, haber: 'caja' }, 'ok');
  updateSocio({});
  return { ok: true };
}
/** Abona cacaos al monedero (aportación). */
export function abono(cacaos, concepto, zone, id, medio = 'efectivo') {
  ledger.unshift({ amt: cacaos, concepto }); socio.saldo += cacaos; stats.aportado += cacaos;
  publish(zone, id, 'aportacion', { uid: socio.uid, cacaos, medio, saldo: socio.saldo, debe: 'caja', haber: socio.uid }, 'ok');
  updateSocio({});
}
export const MOTIVOS = { sin_llavero: 'Necesitas tu llavero NFC', saldo: 'Saldo insuficiente' };
/** Vuelve a empezar como visitante desconocido en la calle. */
export function reiniciarVisita() {
  Object.assign(socio, socioDesconocido()); ledger.length = 0;
  emit('visita:reiniciar'); refreshHUD(); emit('socio:cambio', socio); goZone(0);
}
/** Empieza como socio ya registrado (con rostro y llavero, sin la firma de hoy). */
export function simularSocioConocido() {
  Object.assign(socio, socioDesconocido(), { ...CONFIG.socioDemo, conocido: true, rostro: true, llavero: true, saldo: 60 }); ledger.length = 0;
  emit('visita:reiniciar'); refreshHUD(); emit('socio:cambio', socio); goZone(0);
}

/* ---------------- eventos MQTT simulados ---------------- */
export const events = [];
export function publish(zone, id, evt, payload = {}, kind = '') {
  const d = new Date();
  const e = { hora: d.toTimeString().slice(0, 8), topic: `cacaos/${zone}/${id}/${evt}`, payload: JSON.stringify(payload), kind };
  events.unshift(e); if (events.length > 40) events.pop();
  renderFeed(); drawWall();
  return e;
}
function renderFeed() {
  const ol = $('#feed'); if (!ol) return; ol.textContent = '';
  for (const e of events.slice(0, 4)) {
    const li = document.createElement('li'); li.className = e.kind;
    const s = document.createElement('span'); s.textContent = e.hora;
    const code = document.createElement('code'); code.textContent = `${e.topic} ${e.payload}`;
    li.append(s, code); ol.append(li);
  }
}

/* ---------------- arquitectura ---------------- */
function floorTex(kind) {
  if (kind === 'barro') return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9c4f2c'; g.fillRect(0, 0, w, h); const r = rand(7);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = `hsl(${16 + r() * 8},${48 + r() * 10}%,${34 + r() * 8}%)`; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); }
  }, [6, 4]);
  if (kind === 'madera') return canvasTex(256, 256, (g, w) => {
    const r = rand(3); for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(24,${38 + r() * 10}%,${22 + r() * 7}%)`; g.fillRect(0, i * 32, w, 31); }
  }, [8, 6]);
  if (kind === 'azulejo') return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e9e1d0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2f5d8a'; g.lineWidth = 6;
    g.beginPath(); g.arc(128, 128, 60, 0, Math.PI * 2); g.stroke();
    g.beginPath(); for (const [a, b] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.moveTo(a + 40, b); g.arc(a, b, 40, 0, Math.PI * 2); } g.stroke();
    g.strokeStyle = '#c9bea8'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }, [12, 7]);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1b2117'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2f3d27'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  }, [6, 4]);
}
function patch(r, tex) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }));
  p.rotation.x = -Math.PI / 2; p.position.set((r.x0 + r.x1) / 2, .003, (r.z0 + r.z1) / 2); scene.add(p); addFloor(p); return p;
}
/** Muro entre (x0,z0) y (x1,z1), alineado a un eje, de y0 a y1. */
export function wall(x0, z0, x1, z1, m = M.muro, y0 = 0, y1 = PLANO.alturaMuro, t = .2) {
  const w = Math.abs(x1 - x0) || t, d = Math.abs(z1 - z0) || t;
  return solid(box(w, y1 - y0, d, m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
}
const signs = [];
/** Letrero colgante con título y subtítulo. */
export function sign(text, sub, x, y, z, rotY = 0, w = 2.6) {
  const tex = canvasTex(1024, 256, () => {});
  const draw = () => {
    const g = tex.image.getContext('2d'); g.clearRect(0, 0, 1024, 256);
    g.fillStyle = HEX.bg; g.fillRect(0, 0, 1024, 256); g.fillStyle = HEX.oro; g.fillRect(0, 238, 1024, 18);
    g.fillStyle = HEX.crema; fit(g, text, 800, FD, 120, 940); g.textBaseline = 'middle'; g.fillText(text, 48, 112);
    g.fillStyle = HEX.tenue; g.font = `400 34px ${FM}`; g.fillText(sub, 52, 200); tex.needsUpdate = true;
  };
  draw(); signs.push(draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
}
let WALL = null;
function buildArchitecture() {
  const P = PLANO, H = P.alturaMuro;
  // suelo base del edificio (zonas cerradas) y suelos por zona
  const base = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), mat(0x1a120d, { r: .95 }));
  base.rotation.x = -Math.PI / 2; base.position.set(0, 0, 0); scene.add(base);
  patch(P.lobby, floorTex('barro')); patch(P.main, floorTex('madera'));
  patch(P.cocina, floorTex('azulejo')); patch(P.dispensario, floorTex('disp'));
  // perímetro
  wall(-12, -12, 12, -12); wall(-12, -12, -12, 12); wall(12, -12, 12, 12);
  // fachada con hueco de puerta (la puerta la pone calle.js)
  wall(-12, 12, P.puertaCalle.x0, 12); wall(P.puertaCalle.x1, 12, 12, 12);
  wall(P.puertaCalle.x0, 12, P.puertaCalle.x1, 12, M.muro, P.puertaCalle.alto, H);
  // lobby: muros laterales y muro hacia el main con paso abierto
  wall(-6, 4, -6, 12); wall(6, 4, 6, 12);
  wall(-12, 4, P.pasoLobby.x0, 4); wall(P.pasoLobby.x1, 4, 12, 4);
  wall(P.pasoLobby.x0, 4, P.pasoLobby.x1, 4, M.muro, 2.7, H);
  // muro del fondo del main (z = -5) con puertas y pase de cocina
  wall(-12, -5, P.puertaDisp.x0, -5); wall(P.puertaDisp.x1, -5, P.puertaCocina.x0, -5);
  wall(P.puertaCocina.x1, -5, P.pase.x0, -5); wall(P.pase.x1, -5, 12, -5);
  wall(P.pase.x0, -5, P.pase.x1, -5, M.muro, 0, P.pase.y0); wall(P.pase.x0, -5, P.pase.x1, -5, M.muro, P.pase.y1, H);
  wall(P.puertaDisp.x0, -5, P.puertaDisp.x1, -5, M.muro, 2.6, H); wall(P.puertaCocina.x0, -5, P.puertaCocina.x1, -5, M.muro, 2.6, H);
  // división cocina / dispensario
  wall(0, -12, 0, -5);
  // cornisa y zoclo terracota
  for (const [x0, z0, x1, z1] of [[-12, -12, 12, -12], [-12, -12, -12, 12], [12, -12, 12, 12]]) {
    const w = Math.abs(x1 - x0) || .4, d = Math.abs(z1 - z0) || .4;
    box(w, .25, d, M.barro, (x0 + x1) / 2, H + .1, (z0 + z1) / 2);
  }
  // luces por zona
  for (const [x, z] of [[0, 8], [-6, 0], [6, 0], [6, -8.5], [-6, -8.5]]) {
    const l = new THREE.PointLight(0xffc98a, 10, 12, 2); l.position.set(x, 3.0, z); scene.add(l);
  }
  sign('Barra', 'pide en la tablet · paga con llavero', 8, 2.9, 3.85, Math.PI, 2.6);
  sign('Cocina', 'comandas del chef', 4.75, 3.05, -4.88, 0, 1.8);
  sign('Dispensario', 'llavero + báscula + límite', -4, 3.05, -4.88, 0, 2.2);
  // pantalla de Dirección en el muro oeste del main
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.25), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.position.set(-11.88, 1.8, -.5); mesh.rotation.y = Math.PI / 2; scene.add(mesh);
  box(.05, 2.4, 3.75, M.oro, -11.9, 1.8, -.5);
  WALL = { c, g: c.getContext('2d'), tex };
}
export function drawWall() {
  if (!WALL) return;
  const { g, c, tex } = WALL; const W = c.width;
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, c.height);
  g.fillStyle = HEX.crema; g.font = `800 46px ${FD}`; g.textBaseline = 'middle'; g.fillText('Dirección · en vivo', 36, 52);
  g.fillStyle = HEX.tenue; g.font = `400 20px ${FM}`; g.fillText('mqtt://cacaos.local:1883 · libro mayor de doble entrada', 38, 94);
  const kpis = [['Consumido', `${stats.ventas}`], ['Aportado', `${stats.aportado}`], ['Saldo del socio', `${socio.saldo}`], ['Entradas', `${stats.entradas}`]];
  kpis.forEach(([l, v], i) => {
    const x = 36 + i * 244; g.fillStyle = HEX.panel; g.fillRect(x, 120, 228, 104);
    g.fillStyle = HEX.tenue; g.font = `400 18px ${FM}`; g.fillText(l.toUpperCase(), x + 16, 146);
    g.fillStyle = i === 2 ? HEX.oro : HEX.crema; g.font = `800 46px ${FD}`; g.fillText(v, x + 16, 194);
  });
  g.fillStyle = HEX.hoja; g.font = `600 18px ${FM}`; g.fillText('● Conciliación: todo suma cero', 36, 254);
  g.fillStyle = HEX.tenue; g.fillText(stats.turno ? 'Turno abierto' : 'Turno cerrado', 760, 254);
  g.fillStyle = HEX.linea; g.fillRect(36, 274, W - 72, 2);
  events.slice(0, 9).forEach((e, i) => {
    const y = 304 + i * 36;
    g.fillStyle = HEX.tenue; g.font = `400 18px ${FM}`; g.fillText(e.hora, 36, y);
    g.fillStyle = e.kind === 'err' ? HEX.terracota : e.kind === 'ok' ? HEX.hoja : HEX.texto;
    const t = e.topic.length > 40 ? e.topic.slice(0, 39) + '…' : e.topic; g.fillText(t, 140, y);
    g.fillStyle = HEX.tenue; const p = e.payload.length > 30 ? e.payload.slice(0, 29) + '…' : e.payload; g.fillText(p, 640, y);
  });
  tex.needsUpdate = true;
}

/* ---------------- monedero en la muñeca (VR) ---------------- */
const wrist = makeScreen(.16, .1);
wrist.mesh.position.set(0, .05, .07); wrist.mesh.rotation.x = -1.0;
function drawWrist() {
  const { g, c, tex } = wrist; const W = c.width, Hh = c.height;
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, Hh); g.textBaseline = 'middle';
  g.fillStyle = HEX.tenue; g.font = `400 22px ${FM}`; g.fillText(socio.uid ? `SOCIO ${socio.uid}` : 'VISITANTE', 22, 34);
  g.fillStyle = HEX.oro; g.font = `800 96px ${FD}`; g.fillText(`${socio.saldo}`, 20, 128);
  g.fillStyle = HEX.texto; g.font = `400 24px ${FM}`; g.fillText(socio.llavero ? 'cacaos · llavero NFC ✓' : 'cacaos · sin llavero', 22, 210);
  if (editMode) { g.fillStyle = HEX.terracota; g.fillRect(0, Hh - 54, W, 54); g.fillStyle = HEX.crema; g.font = `800 28px ${FD}`; g.fillText('MODO EDICIÓN', 22, Hh - 27); }
  tex.needsUpdate = true;
}

/* ---------------- punteros ---------------- */
const hoverRingGeo = new THREE.RingGeometry(.92, 1, 48);
const markerGeo = new THREE.RingGeometry(.16, .22, 40);
const dotGeo = new THREE.SphereGeometry(.008, 10, 8);
function makePointer(name) {
  const p = { name, ray: new THREE.Raycaster(), hover: null, hit: null, floorPt: null, held: null, pressing: null, offset: new THREE.Vector3(), active: false };
  p.ray.far = 25;
  p.ring = new THREE.Mesh(hoverRingGeo, new THREE.MeshBasicMaterial({ color: C.oro, transparent: true, opacity: .9, side: THREE.DoubleSide, depthTest: false }));
  p.ring.rotation.x = -Math.PI / 2; p.ring.renderOrder = 5; p.ring.visible = false; scene.add(p.ring);
  p.marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: C.hoja, transparent: true, opacity: .9 }));
  p.marker.rotation.x = -Math.PI / 2; p.marker.visible = false; scene.add(p.marker);
  p.dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: C.crema, depthTest: false })); p.dot.renderOrder = 6; p.dot.visible = false; scene.add(p.dot);
  return p;
}
const mouseP = makePointer('mouse'); mouseP.active = true;
export const pointers = [mouseP];
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), tmpM = new THREE.Matrix4();

function updatePointer(p) {
  p.hover = null; p.hit = null; p.floorPt = null;
  let dist = 6;
  if (p.held) {
    plane.constant = -p.held.root.position.y;
    if (p.ray.ray.intersectPlane(plane, v1)) {
      const nx = Math.round((v1.x + p.offset.x) / .05) * .05, nz = Math.round((v1.z + p.offset.z) / .05) * .05;
      p.held.root.position.x = THREE.MathUtils.clamp(nx, -11.5, 11.5); p.held.root.position.z = THREE.MathUtils.clamp(nz, -11.5, 21.5);
      dist = v1.distanceTo(p.ray.ray.origin);
    }
    showHover(p, p.held); p.dot.visible = false;
  } else {
    const hits = p.ray.intersectObjects(rayTargets, false);
    const h = hits.find(x => { for (let o = x.object; o; o = o.parent) if (o.visible === false) return false; return true; });
    if (h) {
      dist = h.distance; p.hit = h;
      if (h.object.userData.inter) p.hover = h.object.userData.inter;
      else if (h.object.userData.floor && h.distance < 16) p.floorPt = h.point.clone();
      p.dot.visible = true; p.dot.position.copy(h.point);
    } else p.dot.visible = false;
    showHover(p, p.hover);
    if (p.pressing && p.pressing.onMove && p.hover === p.pressing) p.pressing.onMove(p, h);
  }
  if (p.floorPt) { p.marker.visible = true; p.marker.position.set(p.floorPt.x, .02, p.floorPt.z); } else p.marker.visible = false;
  if (p.line) p.line.scale.z = dist;
}
function showHover(p, e) {
  if (!e || !e.radius) { p.ring.visible = false; return; }
  p.ring.visible = true; p.ring.scale.setScalar(e.radius);
  e.root.getWorldPosition(v2);
  p.ring.position.set(v2.x, (e.ringY ?? v2.y) + .012, v2.z);
  p.ring.material.color.setHex(editMode ? C.terracota : C.oro);
}
function press(p) {
  if (editMode && p.hover && p.hover.movable) {
    p.held = p.hover; plane.constant = -p.held.root.position.y;
    if (p.ray.ray.intersectPlane(plane, v1)) p.offset.copy(p.held.root.position).sub(v1); else p.offset.set(0, 0, 0);
    return;
  }
  if (p.hover) { p.pressing = p.hover; p.hover.onSelect && p.hover.onSelect(p, p.hit); }
  else if (p.floorPt) teleportTo(p.floorPt);
}
function release(p) {
  if (p.pressing) { const e = p.pressing; p.pressing = null; e.onRelease && e.onRelease(p); }
  if (!p.held) return;
  const e = p.held; p.held = null;
  refreshColliders(e.root);
  e.zone = zoneAt(e.root.position.x, e.root.position.z);
  saveLayout();
  publish(e.zone, e.id, 'layout', { x: +e.root.position.x.toFixed(2), z: +e.root.position.z.toFixed(2), rot: Math.round(e.root.rotation.y / DEG) });
}

/* ---------------- locomoción ---------------- */
export function headPos(out = new THREE.Vector3()) { rig.updateMatrixWorld(true); return camera.getWorldPosition(out); }
export function headDir(out = new THREE.Vector3()) { rig.updateMatrixWorld(true); return camera.getWorldDirection(out); }
export function teleportTo(pt, yaw) {
  if (yaw == null && blockedAt(pt.x, pt.z)) return false;
  if (yaw != null) { rig.rotation.y = yaw; if (!renderer.xr.isPresenting) camera.rotation.x = 0; }
  headPos(v2);
  rig.position.x += pt.x - v2.x; rig.position.z += pt.z - v2.z;
  emit('teleport', { x: pt.x, z: pt.z });
  return true;
}
let zoneIdx = 0;
export function goZone(i) {
  zoneIdx = (i + ZONES.length) % ZONES.length; const z = ZONES[zoneIdx];
  teleportTo(new THREE.Vector3(z.spot[0], 0, z.spot[1]), z.yaw); toast(z.name);
}
function moveBy(dx, dz) {
  headPos(v2);
  if (!blockedAt(v2.x + dx, v2.z)) rig.position.x += dx;
  if (!blockedAt(v2.x, v2.z + dz)) rig.position.z += dz;
}
function snapTurn(a) {
  headPos(v2); rig.rotation.y += a;
  v1.copy(rig.position).sub(v2).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
  rig.position.copy(v2).add(v1); rig.position.y = 0;
}

/* ---------------- WebXR ---------------- */
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i); rig.add(ctrl);
  const grip = renderer.xr.getControllerGrip(i); rig.add(grip);
  box(.04, .035, .12, M.negro, 0, 0, .02, grip); cyl(.045, .045, .015, M.oro, 0, .02, -.03, grip);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: C.crema, transparent: true, opacity: .7 }));
  ctrl.add(line);
  const p = makePointer('xr' + i); p.ctrl = ctrl; p.grip = grip; p.line = line;
  ctrl.addEventListener('connected', e => { p.active = true; p.hand = e.data.handedness; if (p.hand === 'left') grip.add(wrist.mesh); emit('mando', p); });
  ctrl.addEventListener('disconnected', () => { p.active = false; p.ring.visible = p.marker.visible = p.dot.visible = false; if (wrist.mesh.parent === grip) grip.remove(wrist.mesh); });
  ctrl.addEventListener('selectstart', () => { ensureAudio(); press(p); });
  ctrl.addEventListener('selectend', () => release(p));
  pointers.push(p);
}
const pads = {};
function xrInput(dt) {
  const session = renderer.xr.getSession(); if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad; if (!gp) continue;
    const st = pads[src.handedness] ||= { latch: false, b4: false, b5: false };
    const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0;
    const heldP = pointers.find(p => p.held && p.hand === src.handedness);
    if (src.handedness === 'left' && !heldP && Math.hypot(ax, ay) > .15) {
      headDir(v1); v1.y = 0; v1.normalize(); const r = new THREE.Vector3().crossVectors(v1, camera.up).normalize();
      moveBy((v1.x * -ay + r.x * ax) * 2 * dt, (v1.z * -ay + r.z * ax) * 2 * dt);
    }
    if (heldP) { if (Math.abs(ax) > .2) heldP.held.root.rotation.y -= ax * 1.8 * dt; }
    else if (src.handedness === 'right') {
      if (Math.abs(ax) > .7 && !st.latch) { snapTurn(-Math.sign(ax) * Math.PI / 6); st.latch = true; }
      if (Math.abs(ax) < .3) st.latch = false;
    }
    const b4 = !!gp.buttons[4]?.pressed, b5 = !!gp.buttons[5]?.pressed;
    if (b4 && !st.b4) goZone(zoneIdx + 1);
    if (b5 && !st.b5) toggleEdit();
    st.b4 = b4; st.b5 = b5;
  }
}
async function setupXR() {
  const btn = $('#vrBtn'), note = $('#xrNote');
  if (!('xr' in navigator)) { btn.textContent = 'VR no disponible'; note.textContent = 'Este navegador no tiene WebXR. Abre la página por HTTPS o localhost en Chrome/Edge con la app de Oculus como runtime OpenXR.'; return; }
  let ok = false; try { ok = await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) { ok = false; }
  if (!ok) { btn.textContent = 'VR no disponible'; note.textContent = 'No se detecta un visor. Conecta el Rift, abre la app de Oculus y usa HTTPS o localhost. Dentro de una vista previa incrustada el visor está bloqueado.'; return; }
  btn.disabled = false; btn.textContent = 'Entrar a VR';
  let session = null;
  btn.addEventListener('click', async () => {
    if (session) { session.end(); return; }
    try {
      session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      session.addEventListener('end', () => { session = null; btn.textContent = 'Entrar a VR'; camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); mouseP.active = true; subPanel.mesh.visible = false; });
      await renderer.xr.setSession(session); btn.textContent = 'Salir de VR'; mouseP.active = false; mouseP.ring.visible = mouseP.marker.visible = mouseP.dot.visible = false;
      ensureAudio(); goZone(zoneIdx);
    } catch (e) { note.textContent = 'No se pudo iniciar la sesión VR: ' + e.message; session = null; }
  });
}

/* ---------------- escritorio ---------------- */
const ms = { down: false, x: 0, y: 0, moved: 0, captured: false };
const ndc = new THREE.Vector2();
function setMouse(e) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseP.ray.setFromCamera(ndc, camera); }
function bindDesktop() {
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', e => {
    ensureAudio(); canvas.setPointerCapture(e.pointerId);
    ms.down = true; ms.x = e.clientX; ms.y = e.clientY; ms.moved = 0; ms.captured = false; setMouse(e); updatePointer(mouseP);
    if (editMode && mouseP.hover && mouseP.hover.movable) { press(mouseP); ms.captured = true; }
    else if (mouseP.hover && mouseP.hover.onMove) { press(mouseP); ms.captured = true; }
  });
  canvas.addEventListener('pointermove', e => {
    setMouse(e);
    if (ms.down && !ms.captured) {
      const dx = e.clientX - ms.x, dy = e.clientY - ms.y;
      rig.rotation.y -= dx * .0045; camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * .0045, -1.3, 1.3);
      ms.moved += Math.abs(dx) + Math.abs(dy);
    }
    ms.x = e.clientX; ms.y = e.clientY;
  });
  canvas.addEventListener('pointerup', e => {
    if (ms.captured) release(mouseP);
    else if (ms.moved < 6) { setMouse(e); updatePointer(mouseP); press(mouseP); release(mouseP); }
    ms.down = false; ms.captured = false;
  });
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('textarea,input')) return;
    const k = e.key.toLowerCase(); keys.add(k);
    if (k.length === 1 && '12345'.includes(k)) goZone(+k - 1);
    if (k === 'e') toggleEdit();
    if (k === 'q' || k === 'r') {
      const m = mouseP.held || (editMode && mouseP.hover && mouseP.hover.movable ? mouseP.hover : null);
      if (m) { m.root.rotation.y += (k === 'q' ? 15 : -15) * DEG; if (!mouseP.held) { saveLayout(); } }
    }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
}
const keys = new Set();
function keyMove(dt) {
  const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  const s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  if (!f && !s) return;
  const y = rig.rotation.y, sp = 3 * dt;
  moveBy((-Math.sin(y) * f + Math.cos(y) * s) * sp, (-Math.cos(y) * f - Math.sin(y) * s) * sp);
}

/* ---------------- HUD ---------------- */
let editMode = false;
export const isEditMode = () => editMode;
function toggleEdit() {
  editMode = !editMode; $('#editBtn').setAttribute('aria-pressed', String(editMode));
  for (const p of pointers) if (p.held && !editMode) release(p);
  toast(editMode ? 'Modo edición: arrastra las máquinas' : 'Modo uso'); drawWrist();
}
let toastT = 0;
export function toast(t) { const el = $('#toast'); if (!el) return; el.textContent = t; el.hidden = false; toastT = 2.2; }
export function refreshHUD() {
  const bal = $('#bal'); if (!bal) return;
  bal.innerHTML = `${socio.saldo} <small>cacaos</small>`;
  $('#uid').textContent = socio.uid ? `${socio.nombre} · ${socio.uid}` : 'Visitante sin registrar';
  $('#lim').textContent = `${fmt(socio.dispensadoMes)} / ${socio.limiteMes} g`;
  for (const [id, okk] of [['#chipRostro', socio.rostro], ['#chipFirma', socio.firmaHoy], ['#chipLlavero', socio.llavero]]) $(id).dataset.ok = String(!!okk);
  drawWrist(); drawWall();
}
let lastSel = null;
function updateSel() {
  const p = pointers.find(p => p.active && (p.held || p.hover));
  const m = p ? (p.held || p.hover) : null;
  if (m === lastSel) return; lastSel = m;
  const el = $('#sel');
  if (!m) { el.textContent = editMode ? 'Modo edición: arrastra una máquina para moverla. Q / R la giran.' : 'Apunta a algo. Clic o gatillo para usarlo.'; return; }
  el.innerHTML = '';
  const b = document.createElement('b'); b.textContent = m.name || m.id;
  el.append(b, document.createTextNode(' '));
  if (m.id) { const c = document.createElement('code'); c.textContent = m.id; el.append(c); }
  if (m.hint) { el.append(document.createElement('br'), document.createTextNode(m.hint)); }
}
function bindHUD() {
  document.querySelectorAll('[data-zone]').forEach(b => b.addEventListener('click', () => goZone(+b.dataset.zone)));
  $('#editBtn').addEventListener('click', toggleEdit);
  $('#exportBtn').addEventListener('click', () => { $('#layoutJson').value = JSON.stringify(layoutJSON(), null, 2); $('#exportBox').hidden = false; });
  $('#closeBtn').addEventListener('click', () => { $('#exportBox').hidden = true; });
  $('#copyBtn').addEventListener('click', () => {
    const ta = $('#layoutJson');
    const fallback = () => { ta.focus(); ta.select(); toast('Selecciona y copia con Ctrl+C'); };
    try { navigator.clipboard.writeText(ta.value).then(() => toast('JSON copiado'), fallback); } catch (e) { fallback(); }
  });
  $('#resetBtn').addEventListener('click', () => {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    for (const m of movables) { m.root.position.copy(m.home.pos); m.root.rotation.y = m.home.rotY; m.zone = zoneAt(m.root.position.x, m.root.position.z); }
    toast('Layout restablecido');
  });
  $('#visitaBtn').addEventListener('click', () => { ensureAudio(); reiniciarVisita(); });
  $('#socioBtn').addEventListener('click', () => { ensureAudio(); simularSocioConocido(); });
}

/* ---------------- layout persistente ---------------- */
const LS_KEY = 'cacaos-vr-layout-v2';
function loadLayout() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
function layoutJSON() {
  return movables.map(m => ({ id: m.id, name: m.name, zone: zoneAt(m.root.position.x, m.root.position.z),
    pos: [+m.root.position.x.toFixed(2), +m.root.position.y.toFixed(2), +m.root.position.z.toFixed(2)],
    rotY: Math.round(((m.root.rotation.y / DEG) % 360 + 540) % 360 - 180) }));
}
function saveLayout() { try { localStorage.setItem(LS_KEY, JSON.stringify(layoutJSON())); } catch (e) {} }
function applySavedLayout() {
  const saved = loadLayout();
  for (const m of movables) {
    m.home = { pos: m.root.position.clone(), rotY: m.root.rotation.y };
    const s = saved && saved.find(e => e.id === m.id);
    if (s) { m.root.position.set(...s.pos); m.root.rotation.y = s.rotY * DEG; refreshColliders(m.root); }
    m.zone = zoneAt(m.root.position.x, m.root.position.z);
  }
}

/* ---------------- arranque y bucle ---------------- */
function loop() {
  const dt = Math.min(clock.getDelta(), .05), now = clock.elapsedTime;
  if (renderer.xr.isPresenting) xrInput(dt); else keyMove(dt);
  for (const p of pointers) {
    if (!p.active) continue;
    if (p.ctrl) {
      tmpM.identity().extractRotation(p.ctrl.matrixWorld);
      p.ray.ray.origin.setFromMatrixPosition(p.ctrl.matrixWorld);
      p.ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
    } else if (renderer.xr.isPresenting) continue;
    updatePointer(p);
  }
  updateSel();
  for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; if (a.cancel) { anims.splice(i, 1); continue; } a.t += dt; const k = Math.min(1, a.t / a.dur); a.fn(k); if (k >= 1) { anims.splice(i, 1); a.done && a.done(); } }
  for (const fn of updaters) fn(dt, now);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').hidden = true; }
  if (subT > 0) { subT -= dt; if (subT <= 0) { subPanel.mesh.visible = false; const el = $('#subs'); if (el) el.hidden = true; } }
  renderer.render(scene, camera);
}
/** Construye la arquitectura. Llamar antes de iniciar los módulos de zona. */
export function initCore() {
  $('#stage').appendChild(renderer.domElement);
  buildArchitecture();
}
/** Arranca: aplica layout guardado, conecta HUD/escritorio/XR y empieza el bucle. */
export function start() {
  applySavedLayout();
  bindDesktop(); bindHUD();
  const redraw = () => { signs.forEach(f => f()); refreshHUD(); emit('fuentes'); };
  redraw();
  if (document.fonts) Promise.all([document.fonts.load(`800 40px "Bricolage Grotesque"`), document.fonts.load(`400 20px "JetBrains Mono"`), document.fonts.load(`600 20px "JetBrains Mono"`)]).then(redraw, () => {});
  publish('main', 'GW-01', 'online', { broker: 'cacaos.local' });
  goZone(0);
  renderer.setAnimationLoop(loop);
  setupXR();
}

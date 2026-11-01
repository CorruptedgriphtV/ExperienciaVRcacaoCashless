/* =====================================================================
   Cacaos Pay VR — zona Calle
   Banqueta, asfalto, faroles, macetas y árboles frente a la casona;
   fachada del Club con letrero; cámara de reconocimiento facial CAM-01
   con pantalla de estado, y puerta automática corrediza PTA-01.
   ===================================================================== */
import {
  THREE, scene, box, cyl, mat, M, C, HEX, FD, FM, makeScreen, fit, canvasTex, rand,
  addFloor, addBlocker, addCollider, registerInteractive, onUpdate, anim, say, beep,
  ensureAudio, publish, socio, stats, on, headPos, headDir, CONFIG, toast,
} from './core.js';

/* ---------------- constantes de la zona ---------------- */
const CAM_POS = new THREE.Vector3(1.35, 2.3, 12.12);   // soporte en la fachada
const CAM_LENTE = new THREE.Vector3(1.35, 2.3, 12.36);  // punto que hay que mirar
const CONO = 15 * Math.PI / 180;                         // tolerancia de la mirada
const DIST_MAX = 7;                                      // metros
const SEG_SOCIO = 1;                                     // s mirando para socio conocido
const PUERTA_ABIERTA_S = 6;                              // s abierta antes de intentar cerrar
const ANCHO_HOJA = 1.0;

/* ---------------- utilidades locales ---------------- */
/** Plano horizontal con UV a escala de mundo (tile = metros por repetición de textura). */
function plano(w, d, material, x, y, z, tile = 1) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  const m = new THREE.Mesh(g, material);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); return m;
}
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const enUmbral = p => Math.abs(p.x) < 1.2 && p.z > 11.3 && p.z < 12.7;
const cercaDentro = p => Math.abs(p.x) < 1.3 && p.z > 10.6 && p.z <= 11.3;

/* ---------------- texturas ---------------- */
function texAsfalto() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2b2723'; g.fillRect(0, 0, w, h); const r = rand(11);
    for (let i = 0; i < 1400; i++) { const l = 14 + r() * 16; g.fillStyle = `hsl(28,6%,${l}%)`; g.fillRect(r() * w, r() * h, 2, 2); }
  }, [1, 1]);
}
function texBanqueta() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5d5247'; g.fillRect(0, 0, w, h); const r = rand(5);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = `hsl(30,${12 + r() * 6}%,${44 + r() * 7}%)`; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(40,30,22,${.08 + r() * .1})`; g.fillRect(r() * w, r() * h, 2, 2); }
  }, [1, 1]);
}

/* ---------------- calle: suelo, banqueta, bordes ---------------- */
function construirSuelo() {
  const asf = mat(0xffffff, { r: .95, map: texAsfalto() });
  const banq = mat(0xffffff, { r: .9, map: texBanqueta() });
  // banqueta z 12 … 15 (caminable sólo en x -12 … 12)
  addFloor(plano(24, 3, banq, 0, .08, 13.5, 1.2));
  plano(30, 3, banq, -27, .08, 13.5, 1.2); plano(30, 3, banq, 27, .08, 13.5, 1.2);
  // guarnición (concreto con borde pintado de amarillo tenue)
  box(84, .16, .22, mat(0xa59a8a, { r: .9 }), 0, .08, 15.1);
  box(84, .02, .06, mat(0xc9a95a, { r: .8 }), 0, .165, 15.2);
  // asfalto z 15.2 … 22 caminable; extensiones decorativas
  addFloor(plano(24, 6.8, asf, 0, .001, 18.6, 3));
  plano(30, 8.3, asf, -27, .001, 19.35, 3); plano(30, 8.3, asf, 27, .001, 19.35, 3);
  plano(24, 1.5, asf, 0, .001, 22.75, 3);
  // paso peatonal frente a la puerta
  const raya = mat(0xd9cfbb, { r: .8 });
  for (const x of [-1.6, -.8, 0, .8, 1.6]) plano(.45, 5.8, raya, x, .006, 18.6);
  // banqueta y casas de enfrente (decorado lejano)
  box(84, .16, 2.5, mat(0x6b6055, { r: .9 }), 0, .08, 24.75);
  const colores = [0x8f4a30, 0xc9a35a, 0xb9ab92, 0x6f5a45, 0xa3683f, 0x7f8a64];
  const ventana = mat(0x3a2414, { e: 0xffb866, ei: .55 }), oscura = mat(0x1c1410, { r: .6 });
  const r = rand(23);
  for (let i = 0, x = -38; x < 38; i++) {
    const w = 6 + r() * 3, h = 3.2 + r() * 2;
    box(w - .15, h, 3, mat(colores[i % colores.length], { r: .9 }), x + w / 2, h / 2, 27.5);
    box(w - .05, .2, 3.2, M.barro, x + w / 2, h + .1, 27.5);
    box(.9, 2.1, .05, oscura, x + w * .3, 1.05, 25.98);
    box(1, 1.1, .05, r() > .4 ? ventana : oscura, x + w * .7, 1.7, 25.98);
    x += w;
  }
  // vecinos a los lados de la casona
  box(18, 3.8, .3, mat(0xcf8f5a, { r: .9 }), 21.2, 1.9, 11.85);
  box(18, 3.8, .3, mat(0xb9ab92, { r: .9 }), -21.2, 1.9, 11.85);
  // bordes caminables (invisibles): x = ±12, z = 22
  for (const [w, d, x, z] of [[.3, 10.6, 12.15, 17], [.3, 10.6, -12.15, 17], [24.6, .3, 0, 22.15]]) {
    const b = box(w, 2, d, M.negro, x, 1, z); b.visible = false; addCollider(b);
  }
}

/* ---------------- fachada de la casona ---------------- */
let letreroTex = null;
function dibujarLetrero() {
  const g = letreroTex.image.getContext('2d'), W = 1024, H = 224;
  g.clearRect(0, 0, W, H);
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = HEX.oro; g.lineWidth = 8; g.strokeRect(10, 10, W - 20, H - 20);
  // mazorca de cacao estilizada
  g.save(); g.translate(120, 112); g.rotate(-.35);
  g.fillStyle = HEX.oro; g.beginPath(); g.ellipse(0, 0, 40, 74, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = HEX.bg; g.lineWidth = 5;
  for (const dx of [-18, 0, 18]) { g.beginPath(); g.ellipse(dx * .9, 0, 6, 66 - Math.abs(dx), 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = HEX.hoja; g.beginPath(); g.ellipse(26, -84, 12, 26, .8, 0, Math.PI * 2); g.fill();
  g.restore();
  g.textBaseline = 'middle';
  g.fillStyle = HEX.crema; fit(g, 'Cacaos Pay · Club', 800, FD, 104, 760); g.fillText('Cacaos Pay · Club', 210, 96);
  g.fillStyle = HEX.oro; g.font = `600 28px ${FM}`; g.fillText('CASONA DEL CLUB · SÓLO SOCIOS', 214, 172);
  letreroTex.needsUpdate = true;
}
function construirFachada() {
  const z = 12;
  // cornisa y zoclo terracota en la cara de la calle
  box(24.4, .25, .45, M.barro, 0, 3.5, z);
  box(10.8, .38, .06, M.barro, -6.6, .27, z + .12); box(10.8, .38, .06, M.barro, 6.6, .27, z + .12);
  // marco de puerta de madera (por dentro y por fuera)
  const madera = M.madera;
  box(.16, 2.74, .34, madera, -1.08, 1.37, z); box(.16, 2.74, .34, madera, 1.08, 1.37, z);
  box(2.32, .16, .34, madera, 0, 2.67, z);
  box(2.0, .04, .34, mat(0x9b8f7e, { r: .8 }), 0, .02, z); // umbral de cantera
  // letrero sobre la puerta
  letreroTex = canvasTex(1024, 224, () => {});
  dibujarLetrero();
  const letrero = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3 * 224 / 1024), new THREE.MeshBasicMaterial({ map: letreroTex }));
  letrero.position.set(0, 3.03, z + .125); scene.add(letrero);
  box(2.4, .6, .04, M.cacaoOsc, 0, 3.03, z + .1);
  // ventanas con reja y postigos
  const vidrioOsc = mat(0x2a1a10, { e: 0xffb060, ei: .25, r: .4 });
  for (const x of [-7.5, -4, 4, 7.5]) {
    box(1.2, 1.7, .04, vidrioOsc, x, 1.75, z + .11);
    box(1.44, .12, .16, madera, x, .84, z + .12); box(1.44, .12, .16, madera, x, 2.66, z + .12);
    box(.12, 1.82, .16, madera, x - .66, 1.75, z + .12); box(.12, 1.82, .16, madera, x + .66, 1.75, z + .12);
    for (let i = -2; i <= 2; i++) box(.025, 1.7, .025, M.negro, x + i * .22, 1.75, z + .2);
    box(1.32, .03, .03, M.negro, x, 1.2, z + .2); box(1.32, .03, .03, M.negro, x, 2.3, z + .2);
    box(1.6, .08, .3, M.barro, x, .8, z + .15); // repisa
  }
}

/* ---------------- faroles, macetas, árboles ---------------- */
function farol(x, zz) {
  const base = cyl(.13, .17, .3, M.negro, x, .23, zz);
  cyl(.05, .065, 3.5, M.negro, x, 2.1, zz);
  box(.34, .06, .34, M.negro, x, 3.86, zz);
  box(.26, .38, .26, mat(0xffe2b0, { e: 0xffb85c, ei: 1.6 }), x, 4.08, zz);
  for (const [dx, dz] of [[-.14, -.14], [.14, -.14], [-.14, .14], [.14, .14]]) box(.025, .42, .025, M.negro, x + dx, 4.08, zz + dz);
  cyl(.03, .24, .18, M.negro, x, 4.36, zz);
  const l = new THREE.PointLight(0xffc27a, 22, 15, 2); l.position.set(x, 3.95, zz); scene.add(l);
  const poste = box(.14, 3.6, .14, M.negro, x, 1.8, zz); poste.visible = false; addCollider(poste);
  return base;
}
function maceta(x, zz, s, tipo, r) {
  const yb = .08;
  const pot = cyl(.28 * s, .19 * s, .52 * s, M.barro, x, yb + .26 * s, zz, scene, 16);
  cyl(.31 * s, .31 * s, .07 * s, M.barro, x, yb + .52 * s, zz, scene, 16);
  cyl(.26 * s, .26 * s, .02, mat(0x2b1d14), x, yb + .5 * s, zz, scene, 12);
  addCollider(pot);
  const top = yb + .52 * s;
  if (tipo === 'agave') {
    const hoja = mat(0x6f9a6a, { r: .7 });
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + r() * .3, len = (.5 + r() * .25) * s;
      const b = box(.06 * s, len, .025 * s, hoja, 0, 0, 0);
      b.position.set(x + Math.cos(a) * .1 * s, top + len * .4, zz + Math.sin(a) * .1 * s);
      b.rotation.set(0, -a, 0); b.rotateZ(-(.45 + r() * .35));
    }
    const centro = box(.05 * s, .6 * s, .05 * s, hoja, x, top + .3 * s, zz);
    centro.rotation.y = .5;
  } else {
    const verdes = [M.hoja, mat(0x4f7d3c, { r: .8 }), mat(C.hoja, { r: .8 })];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry((.2 + r() * .1) * s, 1), verdes[i % 3]);
      m.position.set(x + (r() - .5) * .25 * s, top + (.18 + r() * .2) * s, zz + (r() - .5) * .25 * s); scene.add(m);
    }
    const flor = mat(C.terracota, { e: C.terracota, ei: .15 });
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.045 * s, 0), i % 2 ? flor : M.oro);
      f.position.set(x + (r() - .5) * .4 * s, top + (.3 + r() * .2) * s, zz + (r() - .5) * .4 * s); scene.add(f);
    }
  }
}
function arbol(x, zz, r) {
  box(1.2, .1, 1.2, mat(0x2b1d14, { r: 1 }), x, .05, zz);
  box(1.3, .12, .08, mat(0x9b8f7e), x, .06, zz - .63); box(1.3, .12, .08, mat(0x9b8f7e), x, .06, zz + .63);
  const tronco = cyl(.12, .17, 2.6, mat(0x5a3a26, { r: .9 }), x, 1.3, zz, scene, 10);
  addCollider(tronco);
  const verdes = [mat(0x3f6b33, { r: .85 }), mat(0x4f7d3c, { r: .85 }), mat(0x5f8f47, { r: .85 })];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.8 + r() * .4, 1), verdes[i % 3]);
    m.position.set(x + (r() - .5) * 1.1, 3 + r() * .8, zz + (r() - .5) * .9); scene.add(m);
  }
}
function construirMobiliario() {
  farol(-5.5, 14.7); farol(5.5, 14.7);
  const r = rand(41);
  maceta(-2.55, 12.5, 1, 'agave', r); maceta(2.55, 12.5, 1, 'agave', r);
  maceta(-3.25, 12.42, .7, 'flor', r); maceta(3.25, 12.42, .7, 'flor', r);
  maceta(-5.8, 12.42, .85, 'flor', r); maceta(5.8, 12.42, .85, 'flor', r);
  arbol(-9.8, 14.0, r); arbol(9.8, 14.0, r);
}

/* ---------------- puerta automática PTA-01 ---------------- */
const puerta = { k: 0, estado: 'cerrada', tok: 0, hold: 0, hojas: [], coll: null };
function construirHoja(lado) {
  const g = new THREE.Group();
  const marco = M.madera, w = ANCHO_HOJA, h = 2.58, t = .06;
  box(w, .1, t, marco, 0, h - .05, 0, g); box(w, .14, t, marco, 0, .07, 0, g);
  box(.08, h, t, marco, -w / 2 + .04, h / 2, 0, g); box(.08, h, t, marco, w / 2 - .04, h / 2, 0, g);
  box(w - .16, h - .24, .02, M.vidrio, 0, h / 2 + .02, 0, g);
  box(.03, .9, .05, M.oro, -lado * (w / 2 - .14), 1.15, .05, g);   // jaladera exterior
  box(.03, .9, .05, M.oro, -lado * (w / 2 - .14), 1.15, -.05, g);  // jaladera interior
  box(w - .16, .04, .022, M.oro, 0, 1.0, 0, g);                     // franja de seguridad
  g.position.set(lado * w / 2, 0, 12); scene.add(g);
  g.traverse(o => { if (o.isMesh) addBlocker(o); });
  return { g, lado };
}
function construirPuerta() {
  puerta.hojas = [construirHoja(-1), construirHoja(1)];
  // caja de colisión colocada directamente en el mundo
  const hueco = box(2, 2.6, .24, M.negro, 0, 1.3, 12); hueco.visible = false;
  puerta.coll = addCollider(hueco);
  // sensor sobre el dintel (lado de la calle y del lobby)
  for (const zz of [12.2, 11.8]) {
    box(.4, .06, .06, M.negro, 0, 2.52, zz);
    puerta.leds = puerta.leds || [];
    const led = box(.04, .02, .02, new THREE.MeshBasicMaterial({ color: C.terracota }), .14, 2.49, zz + (zz > 12 ? .03 : -.03));
    puerta.leds.push(led);
  }
  aplicarPuerta();
}
function aplicarPuerta() {
  for (const h of puerta.hojas) h.g.position.x = h.lado * (ANCHO_HOJA / 2 + puerta.k * .98);
  const c = puerta.estado === 'cerrada' ? C.terracota : puerta.estado === 'abierta' ? C.hoja : C.oro;
  for (const l of puerta.leds || []) l.material.color.setHex(c);
}
function moverPuerta(destino, durTotal, done) {
  const tok = ++puerta.tok, desde = puerta.k, dur = durTotal * Math.abs(destino - desde);
  if (dur < .02) { puerta.k = destino; aplicarPuerta(); done && done(); return; }
  anim(dur, k => { if (tok !== puerta.tok) return; puerta.k = desde + (destino - desde) * ease(k); aplicarPuerta(); },
    () => { if (tok === puerta.tok) done && done(); });
}
function abrirPuerta(motivo, extra = {}) {
  puerta.hold = PUERTA_ABIERTA_S;
  if (puerta.estado === 'abierta' || puerta.estado === 'abriendo') return;
  puerta.estado = 'abriendo'; puerta.coll.enabled = false; aplicarPuerta();
  publish('calle', 'PTA-01', 'abierta', { motivo, ...extra }, 'ok');
  moverPuerta(1, 1.1, () => { puerta.estado = 'abierta'; aplicarPuerta(); });
  marcarPantalla();
}
function cerrarPuerta(inmediato = false) {
  if (puerta.estado === 'cerrada') return;
  puerta.coll.enabled = true;
  if (inmediato) {
    puerta.tok++; puerta.k = 0; puerta.estado = 'cerrada'; aplicarPuerta();
    publish('calle', 'PTA-01', 'cerrada', { motivo: 'reinicio' });
    marcarPantalla(); return;
  }
  puerta.estado = 'cerrando'; aplicarPuerta();
  moverPuerta(0, 1.3, () => {
    puerta.estado = 'cerrada'; aplicarPuerta();
    publish('calle', 'PTA-01', 'cerrada', { abiertaSeg: PUERTA_ABIERTA_S });
    marcarPantalla();
  });
}
function actualizarPuerta(dt, hp) {
  if (puerta.estado === 'abierta') {
    puerta.hold -= dt;
    if (puerta.hold <= 0) { if (enUmbral(hp)) puerta.hold = .5; else cerrarPuerta(); }
  } else if (puerta.estado === 'cerrando' && enUmbral(hp)) {
    abrirPuerta('sensor_umbral');                      // sensor de seguridad: alguien en el umbral
  } else if (puerta.estado === 'cerrada' && cercaDentro(hp)) {
    abrirPuerta('salida');                             // desde el lobby se abre para salir
  }
}

/* ---------------- cámara CAM-01 ---------------- */
const cam = {
  modo: 'buscando',     // buscando | analizando | contando | reconocido | desconocido
  t: 0,                 // segundos acumulados mirando (desconocido)
  tk: 0,                // segundos mirando (socio conocido)
  concedido: false, entro: false, mirando: false,
  body: null, led: null, anillo: null, pantalla: null, claveAnillo: '', clavePantalla: '',
};
function construirCamara() {
  const root = new THREE.Group(); root.position.copy(CAM_POS); scene.add(root);
  box(.1, .1, .04, M.negro, 0, 0, 0, root);                 // placa
  box(.035, .035, .12, M.negro, 0, 0, .06, root);           // brazo
  const body = new THREE.Group(); body.position.set(0, 0, .13); body.rotation.order = 'YXZ'; root.add(body);
  box(.17, .14, .2, mat(0x2a211a, { r: .4, m: .3 }), 0, 0, 0, body);
  box(.2, .02, .24, M.oro, 0, .08, .01, body);              // visera
  // anillo / pantallita de estado alrededor de la lente
  cam.anillo = makeScreen(.15, .13, 128);
  cam.anillo.mesh.position.set(0, 0, .102); body.add(cam.anillo.mesh);
  const lente = cyl(.03, .034, .04, M.negro, 0, 0, .115, body, 20); lente.rotation.x = Math.PI / 2;
  const vidrioL = cyl(.022, .022, .005, mat(0x203040, { r: .05, m: .6, e: 0x102030, ei: .6 }), 0, 0, .137, body, 20); vidrioL.rotation.x = Math.PI / 2;
  cam.led = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), new THREE.MeshBasicMaterial({ color: C.oro }));
  cam.led.position.set(.062, -.048, .102); body.add(cam.led);
  cam.body = body;
  registerInteractive(root, {
    id: 'CAM-01', name: 'Cámara de reconocimiento facial', zone: 'calle', radius: .5,
    hint: 'Mírala para que te reconozca', onSelect: forzarCamara,
  });
  // pantalla de estado junto a la puerta
  box(1.0, .7, .04, M.oro, -1.85, 1.55, 12.12);
  cam.pantalla = makeScreen(.94, .64);
  cam.pantalla.mesh.position.set(-1.85, 1.55, 12.145); scene.add(cam.pantalla.mesh);
  box(.06, .5, .04, M.negro, -1.85, 1.0, 12.12);
}
function colorModo() {
  return { buscando: HEX.oro, analizando: HEX.ambar, contando: HEX.ambar, reconocido: HEX.hoja, desconocido: HEX.terracota }[cam.modo];
}
function progreso() {
  if (cam.modo === 'contando') return Math.min(1, cam.t / CONFIG.miradaSegundos);
  if (cam.modo === 'analizando') return socio.rostro ? Math.min(1, cam.tk / SEG_SOCIO) : Math.min(1, cam.t / CONFIG.miradaSegundos);
  if (cam.modo === 'reconocido' || cam.modo === 'desconocido') return 1;
  return 0;
}
function dibujarAnillo(forzar) {
  const p = progreso(), clave = `${cam.modo}|${Math.round(p * 40)}`;
  if (!forzar && clave === cam.claveAnillo) return; cam.claveAnillo = clave;
  const { g, c, tex } = cam.anillo, W = c.width, H = c.height, cx = W / 2, cy = H / 2;
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H);
  g.lineWidth = 12; g.strokeStyle = HEX.linea; g.beginPath(); g.arc(cx, cy, 40, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = colorModo();
  if (p > 0) { g.beginPath(); g.arc(cx, cy, 40, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke(); }
  else { g.globalAlpha = .5; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx, cy, 40, i * Math.PI / 2 + .3, i * Math.PI / 2 + 1.1); g.stroke(); } g.globalAlpha = 1; }
  tex.needsUpdate = true;
}
function marcarPantalla() { cam.clavePantalla = ''; }
function dibujarPantalla(forzar) {
  const p = progreso();
  const clave = `${cam.modo}|${Math.round(p * 60)}|${socio.nombre}|${puerta.estado}`;
  if (!forzar && clave === cam.clavePantalla) return; cam.clavePantalla = clave;
  const { g, c, tex } = cam.pantalla, W = c.width, H = c.height, col = colorModo();
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = col; g.fillRect(0, 0, 10, H);
  g.textBaseline = 'middle';
  g.fillStyle = HEX.tenue; g.font = `600 20px ${FM}`; g.fillText('CAM-01 · CONTROL DE ACCESO', 32, 34);
  g.fillStyle = col; g.beginPath(); g.arc(W - 34, 34, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = HEX.linea; g.fillRect(32, 58, W - 64, 2);
  let titulo, sub, subCol = HEX.texto, barra = false;
  const restante = Math.max(0, CONFIG.miradaSegundos - cam.t);
  switch (cam.modo) {
    case 'buscando': titulo = 'Buscando rostro…'; sub = 'Mira la cámara para entrar'; break;
    case 'analizando': titulo = 'Analizando rostro…'; sub = 'No te muevas, por favor'; barra = true; break;
    case 'contando': titulo = 'Rostro desconocido'; sub = `Sigue mirando · ${restante.toFixed(1)} s`; barra = true; break;
    case 'reconocido': titulo = 'Socio reconocido:'; sub = socio.nombre || 'Socio'; subCol = HEX.hoja; break;
    case 'desconocido': titulo = 'Rostro desconocido'; sub = 'Pasa al lobby: Lorenzo te registra'; break;
  }
  g.fillStyle = cam.modo === 'buscando' ? HEX.crema : col;
  fit(g, titulo, 800, FD, 50, W - 64); g.fillText(titulo, 32, 112);
  g.fillStyle = subCol;
  if (cam.modo === 'reconocido') { fit(g, sub, 800, FD, 56, W - 64); g.fillText(sub, 32, 178); }
  else { fit(g, sub, 600, FD, 28, W - 64); g.fillText(sub, 32, 170); }
  if (barra) {
    g.fillStyle = HEX.panel; g.fillRect(32, 214, W - 64, 24);
    g.fillStyle = col; g.fillRect(32, 214, (W - 64) * p, 24);
    g.strokeStyle = HEX.linea; g.lineWidth = 2; g.strokeRect(32, 214, W - 64, 24);
    g.fillStyle = HEX.tenue; g.font = `400 18px ${FM}`; g.fillText('MIRADA', 32, 256);
    const pct = `${Math.round(p * 100)}%`; g.fillText(pct, W - 32 - g.measureText(pct).width, 256);
  } else if (cam.modo === 'reconocido') {
    g.fillStyle = HEX.tenue; g.font = `400 18px ${FM}`; g.fillText(`${socio.uid || ''} · acceso concedido`, 32, 230);
  } else if (cam.modo === 'desconocido') {
    g.fillStyle = HEX.tenue; g.font = `400 18px ${FM}`; g.fillText('acceso de visita concedido', 32, 230);
  }
  g.fillStyle = HEX.linea; g.fillRect(32, H - 50, W - 64, 2);
  const pe = { cerrada: 'cerrada', abriendo: 'abriendo…', abierta: 'abierta', cerrando: 'cerrando…' }[puerta.estado];
  g.fillStyle = puerta.estado === 'cerrada' ? HEX.tenue : HEX.hoja; g.font = `600 18px ${FM}`;
  g.fillText(`PUERTA PTA-01 · ${pe.toUpperCase()}`, 32, H - 24);
  tex.needsUpdate = true;
}
function reiniciarCamara() {
  cam.modo = 'buscando'; cam.t = 0; cam.tk = 0; cam.concedido = false; cam.entro = false;
  marcarPantalla(); cam.claveAnillo = '';
}
function reconocer() {
  cam.modo = 'reconocido'; cam.concedido = true; cam.entro = false;
  beep('ok');
  say(`Bienvenido de nuevo, ${socio.nombre}.`, 'Cámara de acceso');
  stats.entradas++;
  publish('calle', 'CAM-01', 'reconocido', { uid: socio.uid, confianza: 0.97 }, 'ok');
  abrirPuerta('reconocido', { uid: socio.uid });
}
function avisoDesconocido() {
  cam.modo = 'desconocido'; cam.concedido = true; cam.entro = false; cam.t = CONFIG.miradaSegundos;
  beep('info');
  say('Hola, no te tengo registrado. Pasa al lobby: Lorenzo el Cacao te va a registrar.', 'Cámara de acceso');
  publish('calle', 'CAM-01', 'desconocido', { segundos: CONFIG.miradaSegundos }, 'err');
  abrirPuerta('visita');
}
/** Clic / gatillo sobre la cámara: fuerza el reconocimiento (útil en escritorio). */
function forzarCamara() {
  ensureAudio();
  if (cam.concedido) {
    say(cam.modo === 'reconocido' ? `Ya te reconocí, ${socio.nombre}. Adelante.` : 'Ya te di acceso. Pasa al lobby con Lorenzo.', 'Cámara de acceso');
    abrirPuerta('reapertura');
    return;
  }
  if (socio.rostro) reconocer(); else avisoDesconocido();
}

const vH = new THREE.Vector3(), vD = new THREE.Vector3(), vC = new THREE.Vector3();
function actualizarCamara(dt, now, hp) {
  headDir(vD); vC.copy(CAM_LENTE).sub(hp);
  const dist = vC.length();
  const mirando = hp.z > 12.3 && dist < DIST_MAX && vD.angleTo(vC) < CONO;
  cam.mirando = mirando;
  if (hp.z < 11.6) cam.entro = true;
  if (cam.concedido) {
    // volver a vigilar cuando el visitante regresa a la calle después de entrar
    if (cam.entro && hp.z > 13) { reiniciarCamara(); toast('Cámara de acceso: vigilando de nuevo'); }
  } else if (socio.rostro) {
    cam.tk = mirando ? cam.tk + dt : Math.max(0, cam.tk - dt * 2);
    cam.modo = cam.tk > 0 ? 'analizando' : 'buscando';
    if (cam.tk >= SEG_SOCIO) reconocer();
  } else {
    cam.t = mirando ? cam.t + dt : Math.max(0, cam.t - dt * .6);   // decae, no se reinicia
    cam.modo = cam.t <= 0 ? 'buscando' : cam.t < .6 ? 'analizando' : 'contando';
    if (cam.t >= CONFIG.miradaSegundos) avisoDesconocido();
  }
  // la cámara sigue la cabeza en la calle; si no hay nadie, barre despacio
  let yaw, pitch;
  if (hp.z > 12.3 && dist < 10) {
    yaw = THREE.MathUtils.clamp(Math.atan2(hp.x - CAM_POS.x, hp.z - CAM_POS.z), -.7, .7);
    pitch = THREE.MathUtils.clamp(Math.atan2(CAM_POS.y - hp.y, Math.hypot(hp.x - CAM_POS.x, hp.z - CAM_POS.z)), -.2, .6);
  } else { yaw = Math.sin(now * .4) * .5; pitch = .2; }
  const f = Math.min(1, dt * 4);
  cam.body.rotation.y += (yaw - cam.body.rotation.y) * f;
  cam.body.rotation.x += (pitch - cam.body.rotation.x) * f;
  // LED
  const parpadeo = cam.modo === 'buscando' ? (Math.sin(now * 3) > 0 ? 1 : .25) : cam.modo === 'contando' || cam.modo === 'analizando' ? (Math.sin(now * 12) > 0 ? 1 : .4) : 1;
  cam.led.material.color.set(colorModo()).multiplyScalar(parpadeo);
  dibujarAnillo(); dibujarPantalla();
}

/* ---------------- init ---------------- */
export function init() {
  construirSuelo();
  construirFachada();
  construirMobiliario();
  construirPuerta();
  construirCamara();
  dibujarAnillo(true); dibujarPantalla(true);
  onUpdate((dt, now) => {
    headPos(vH);
    actualizarCamara(dt, now, vH);
    actualizarPuerta(dt, vH);
  });
  on('visita:reiniciar', () => { cerrarPuerta(true); reiniciarCamara(); });
  on('fuentes', () => { dibujarLetrero(); dibujarAnillo(true); dibujarPantalla(true); });
}

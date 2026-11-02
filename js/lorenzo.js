/* =====================================================================
   Lobby · Lorenzo el Cacao (LOR-01) + máquina de llaveros NFC (LLA-01)
   Animatrónico con forma de mazorca: captura el rostro con la cámara de
   su ojo, hace firmar el registro del día en su tablet con lápiz,
   recibe monedas de $10 en la ranura de su panza y acciona la máquina
   que entrega el llavero NFC. Todo el conjunto es un solo Group movible.
   Coordenadas locales del grupo: +z = frente de Lorenzo (mira a +x del mundo).
   ===================================================================== */
import {
  THREE, scene, box, cyl, mat, M, C, HEX, FD, FM, makeScreen, fit, sign,
  addCollider, registerInteractive, onUpdate, anim, after, say, beep,
  publish, socio, updateSocio, abono, CONFIG, on, headPos, headDir, toast, zoneAt,
} from './core.js';

const ID = 'LOR-01', ZONA = 'lobby', NOMBRE = 'Lorenzo el Cacao';
const POS = new THREE.Vector3(-4.3, 0, 8);
const ROT = Math.PI / 2;                 // local +z → mundo +x
const CERCA = 4.2;                       // m (el punto del lobby queda a 3.7 m)
const MIRADA_SEG = 1.5, MIRADA_ANG = 18 * Math.PI / 180;
const TINTA_MIN = 160;                   // px de trazo en el lienzo de 512
const RECORDAR_SEG = 20;
const NUM = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const sph = (r, m, x = 0, y = 0, z = 0, parent, ws = 16, hs = 12) => {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m); s.position.set(x, y, z); parent.add(s); return s;
};
const setVis = (o, v) => o.traverse(n => { if (n.isMesh) n.visible = v; });

/* ---------------- estado ---------------- */
let gen = 0;
const st = {};
function resetEstado() {
  Object.assign(st, {
    paso: 'espera', pasoT: 0, recordado: false, credito: 0, enBandeja: false, ocupado: false,
    mirada: 0, saludoT: 0, talkT: 0, blinkT: 2, palanca: 0, cola: 0, volando: false,
    firma: { trazos: [], tinta: 0, activa: false, ok: false, hora: null, movido: false, roto: false }, msg: '',
  });
}
resetEstado();

/* ---------------- piezas ---------------- */
let eyeCam, panzaG;
let G, pod, podMesh, jaw, lid, ledMat, lensMat, flash, cejas = [], armR, armL, lever, ombligoMat;
let scr, stylus, tabletG, cred, llavero, coin, colliders = [];
const TABW = .56, TABH = .4;
const STYLUS_HOME = new THREE.Vector3(TABW / 2 + .035, -.06, .03);

/* mazorca: perfil ovalado alargado con 10 surcos */
const POD = { sx: .34, sy: .7, cy: 1.3 };
function podMult(yn, th) {
  const ridge = Math.pow(Math.abs(Math.cos(5 * th)), .7);
  const taper = yn < 0 ? 1 - .3 * yn * yn : 1 - .12 * yn * yn;
  return (1 + .07 * ridge) * taper;
}
function podPoint(yn, th, out = new THREE.Vector3(), push = 0) {
  const s = Math.sqrt(Math.max(0, 1 - yn * yn)) * podMult(yn, th);
  out.set(Math.cos(th) * (s * POD.sx + push), yn * POD.sy, Math.sin(th) * (s * POD.sx + push));
  return out;
}
function podGeometry() {
  const g = new THREE.SphereGeometry(1, 50, 30);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const a = new THREE.Color(0x7d3320), b = new THREE.Color(0xc98a3a), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const th = Math.atan2(z, x);
    podPoint(y, th, v1); p.setXYZ(i, v1.x, v1.y, v1.z);
    const ridge = Math.pow(Math.abs(Math.cos(5 * th)), .7);
    c.copy(a).lerp(b, ridge * .85 + Math.max(0, y) * .15);
    if (y < -.5) c.multiplyScalar(1 - (-.5 - y) * .6);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals(); return g;
}
/** coloca un grupo de rasgo sobre la superficie, mirando hacia afuera */
function onPod(yn, th, push = 0) {
  const gr = new THREE.Group(); podPoint(yn, th, gr.position, push);
  gr.rotation.y = Math.atan2(Math.cos(th), Math.sin(th)); pod.add(gr); return gr;
}

function makeArm(side) {
  const sh = new THREE.Group(); sh.position.set(side * .36, -.1, .02); pod.add(sh);
  sph(.052, M.oro, 0, 0, 0, sh);
  cyl(.03, .026, .28, M.cacaoOsc, 0, -.15, 0, sh, 12);
  const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
  sph(.04, M.oro, 0, 0, 0, el);
  cyl(.025, .02, .25, M.cacaoOsc, 0, -.14, 0, el, 12);
  const hand = new THREE.Group(); hand.position.y = -.29; el.add(hand);
  sph(.045, mat(C.terracota, { r: .5 }), 0, 0, 0, hand);
  for (const a of [-.6, 0, .6]) {
    const f = cyl(.009, .007, .06, M.oro, Math.sin(a) * .03, -.05, Math.cos(a) * .02, hand, 8);
    f.rotation.z = -a * .4;
  }
  return { sh, el, hand, side };
}

function makeLlavero(parent) {
  const g = new THREE.Group(); parent.add(g);
  cyl(.042, .042, .009, M.nfc, 0, 0, 0, g, 28);
  const t = new THREE.Mesh(new THREE.TorusGeometry(.03, .0035, 8, 28), M.oro); t.rotation.x = Math.PI / 2; t.position.y = .005; g.add(t);
  const ar = new THREE.Mesh(new THREE.TorusGeometry(.022, .0045, 8, 24), M.oro); ar.rotation.x = Math.PI / 2; ar.position.set(.062, 0, 0); g.add(ar);
  return g;
}

function makeCoin(parent) {
  const g = new THREE.Group(); parent.add(g);
  cyl(.026, .026, .004, M.oro, 0, 0, 0, g, 24);
  cyl(.017, .017, .005, M.acero, 0, 0, 0, g, 20);
  return g;
}

function build() {
  G = new THREE.Group(); G.name = ID;
  const terr = mat(C.terracota, { r: .6 }), cacao = mat(0x2a1d15, { r: .6 });

  /* pedestal de Lorenzo */
  const ped = cyl(.42, .46, .62, M.cacaoOsc, 0, .31, 0, G, 32);
  cyl(.44, .44, .04, M.oro, 0, .62, 0, G, 32);

  /* mostrador / kiosco */
  const counter = box(2.0, .9, 1.15, cacao, 0, .45, .875, G);
  box(2.04, .04, 1.19, M.oro, 0, .92, .875, G);                    // cubierta
  box(1.9, .7, .02, terr, 0, .45, 1.46, G);                        // frente terracota
  box(1.9, .05, .022, mat(C.hoja, { r: .6 }), 0, .7, 1.472, G);    // franja hoja
  box(1.9, .03, .022, M.oro, 0, .12, 1.472, G);

  /* mazorca */
  pod = new THREE.Group(); pod.position.y = POD.cy; G.add(pod);
  podMesh = new THREE.Mesh(podGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .1 }));
  pod.add(podMesh);
  // tallo y hojas
  cyl(.022, .034, .14, M.cacaoOsc, 0, POD.sy + .04, 0, pod, 10);
  for (const s of [-1, 1]) {
    const h = sph(.1, M.hoja, s * .09, POD.sy + .08, 0, pod, 14, 8);
    h.scale.set(1, .12, .45); h.rotation.z = s * .45;
  }
  // cinturón
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.322, .014, 8, 48), M.oro); belt.rotation.x = Math.PI / 2; belt.position.y = -.37 * POD.sy; pod.add(belt);

  // ojo-cámara (izquierda de Lorenzo = +x local)
  const eyeC = onPod(.36, Math.PI / 2 - .36, .005); eyeCam = eyeC;
  const hous = cyl(.07, .075, .05, M.negro, 0, 0, .0, eyeC, 24); hous.rotation.x = Math.PI / 2;
  lensMat = mat(0x0c1418, { r: .1, m: .9, e: 0x0b3a2a, ei: 1 });
  sph(.045, lensMat, 0, 0, .018, eyeC, 20, 14);
  const iris = new THREE.Mesh(new THREE.TorusGeometry(.05, .006, 8, 28), M.oro); iris.position.z = .026; eyeC.add(iris);
  ledMat = new THREE.MeshBasicMaterial({ color: C.hoja });
  const led = new THREE.Mesh(new THREE.TorusGeometry(.074, .008, 8, 36), ledMat); led.position.z = .028; eyeC.add(led);
  // ojo normal (derecha de Lorenzo)
  const eyeN = onPod(.36, Math.PI / 2 + .36, -.005);
  sph(.062, M.crema, 0, 0, 0, eyeN, 20, 14);
  sph(.027, M.negro, 0, .004, .05, eyeN, 14, 10);
  sph(.008, mat(0xffffff, { e: 0xffffff, ei: .6 }), .01, .016, .074, eyeN, 8, 6);
  lid = new THREE.Mesh(new THREE.SphereGeometry(.068, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6b2c1b, { r: .6 }));
  lid.rotation.x = -.35; eyeN.add(lid);
  // cejas doradas
  for (const [th, s] of [[Math.PI / 2 - .36, 1], [Math.PI / 2 + .36, -1]]) {
    const ce = onPod(.52, th, .01); const b = box(.11, .018, .02, M.oro, 0, 0, 0, ce); b.rotation.z = s * .12; cejas.push(ce);
  }
  // mejillas
  for (const th of [Math.PI / 2 - .6, Math.PI / 2 + .6]) {
    const m = onPod(.16, th, .002); const d = cyl(.034, .034, .006, mat(0xe0735a, { r: .7 }), 0, 0, 0, m, 18); d.rotation.x = Math.PI / 2;
  }
  // boca con mandíbula
  const boca = onPod(.06, Math.PI / 2, -.01);
  box(.22, .1, .03, M.negro, 0, -.015, 0, boca);
  box(.25, .03, .045, M.oro, 0, .042, .006, boca);
  jaw = new THREE.Group(); jaw.position.y = -.03; boca.add(jaw);
  box(.23, .034, .045, M.oro, 0, -.014, .006, jaw);
  box(.15, .012, .03, M.crema, 0, .006, .0, jaw);
  // ranura de monedas en la panza
  const panza = onPod(-.22, Math.PI / 2, .004); panzaG = panza;
  box(.13, .1, .02, M.oro, 0, 0, 0, panza);
  box(.014, .072, .024, M.negro, 0, 0, .001, panza);
  ombligoMat = new THREE.MeshBasicMaterial({ color: C.hoja });
  sph(.009, ombligoMat, .045, .035, .012, panza, 8, 6);
  // brazos
  armR = makeArm(1); armL = makeArm(-1);

  /* máquina de llaveros LLA-01 (izquierda del mostrador, -x local) */
  const mach = new THREE.Group(); G.add(mach);
  box(.46, .52, .36, terr, -.55, 1.18, .78, mach);
  box(.48, .03, .38, M.oro, -.55, 1.455, .78, mach);
  box(.48, .02, .38, M.oro, -.55, .93, .78, mach);
  box(.34, .2, .01, M.negro, -.55, 1.17, .96, mach);
  box(.32, .18, .01, M.vidrio, -.55, 1.17, .972, mach);
  for (let i = 0; i < 3; i++) {                                   // llaveros colgados tras el vidrio
    const x = -.65 + i * .1; cyl(.003, .003, .05, M.acero, x, 1.235, .93, mach, 6);
    const l = makeLlavero(mach); l.position.set(x, 1.17, .93); l.rotation.x = Math.PI / 2; l.rotation.y = .3 * (i - 1);
  }
  box(.16, .055, .02, M.negro, -.55, .985, .962, mach);           // boca de salida
  const ramp = box(.15, .008, .16, M.acero, -.55, .965, 1.04, mach); ramp.rotation.x = .16;
  cred = makeScreen(.32, .11, 256); cred.mesh.position.set(-.55, 1.36, .962); mach.add(cred.mesh);
  // palanca (del lado que da a Lorenzo)
  lever = new THREE.Group(); lever.position.set(-.3, 1.3, .72); mach.add(lever);
  const piv = cyl(.025, .025, .04, M.acero, 0, 0, 0, lever, 12); piv.rotation.z = Math.PI / 2;
  cyl(.009, .009, .16, M.acero, .02, .08, 0, lever, 8);
  sph(.024, mat(C.terracota, { r: .4 }), .02, .17, 0, lever);
  lever.rotation.x = -.4;

  /* bandeja de salida */
  const tray = new THREE.Group(); G.add(tray);
  box(.3, .012, .22, M.negro, -.55, .946, 1.2, tray);
  box(.3, .03, .012, M.oro, -.55, .955, 1.31, tray); box(.3, .03, .012, M.oro, -.55, .955, 1.09, tray);
  box(.012, .03, .22, M.oro, -.7, .955, 1.2, tray); box(.012, .03, .22, M.oro, -.4, .955, 1.2, tray);
  box(.36, .12, .28, hitMat, -.55, 1.0, 1.2, tray);
  llavero = makeLlavero(tray); llavero.position.set(-.56, .958, 1.2); llavero.rotation.y = .5;

  /* platito de monedas */
  const plato = new THREE.Group(); G.add(plato);
  cyl(.08, .06, .02, M.oro, -.02, .95, 1.25, plato, 28);
  cyl(.068, .068, .004, M.cacaoOsc, -.02, .961, 1.25, plato, 28);
  for (let i = 0; i < 4; i++) { const c = makeCoin(plato); c.position.set(-.02 + (i % 2 ? .02 : -.015), .966 + i * .0045, 1.25 + (i > 1 ? .015 : -.01)); }
  box(.22, .12, .22, hitMat, -.02, 1.0, 1.25, plato);

  /* tablet integrada (derecha del mostrador, +x local) */
  const stand = box(.36, .14, .16, M.cacaoOsc, .5, .98, 1.17, G); stand.rotation.x = -.3;
  tabletG = new THREE.Group(); tabletG.position.set(.5, 1.1, 1.22); tabletG.rotation.x = -.5; G.add(tabletG);
  box(TABW + .05, TABH + .04, .022, M.negro, 0, 0, -.012, tabletG);
  box(.025, .2, .03, M.oro, TABW / 2 + .035, -.01, .005, tabletG);              // portalápiz
  scr = makeScreen(TABW, TABH, 512); scr.mesh.position.z = .0015; scr.mesh.name = 'lor-tablet'; tabletG.add(scr.mesh);

  /* letrero */
  const s = sign('Lorenzo el Cacao', 'registro · firma · llaveros NFC', 0, 0, 0, 0, 1.8);
  G.add(s); s.position.set(0, 2.55, -.15); s.rotation.set(0, 0, 0);
  for (const x of [-.8, .8]) cyl(.008, .008, .62, M.oro, x, 3.08, -.15, G, 6);

  /* colocar el grupo antes de colisiones e interacción */
  G.position.copy(POS); G.rotation.y = ROT; scene.add(G); G.updateMatrixWorld(true);
  colliders = [addCollider(counter), addCollider(ped)];

  /* interacción (Lorenzo primero: lo demás sobrescribe sus piezas) */
  const lorEntry = registerInteractive(G, {
    id: ID, name: NOMBRE, zone: ZONA, radius: .9, movable: true,
    hint: 'Clic para hablar con Lorenzo (o para que capture tu rostro)',
    onSelect: () => tocarLorenzo(),
  });
  lorEntry.ringY = .95;
  registerInteractive(scr.mesh, {
    id: ID, name: 'Tablet de registro', zone: ZONA,
    hint: 'Mantén presionado y arrastra en el recuadro para firmar · luego toca Firmar',
    onSelect: (p, hit) => tabletSelect(hit), onMove: (p, hit) => tabletMove(hit), onRelease: () => tabletRelease(),
  });
  const coinEntry = { id: ID, name: 'Ranura de monedas', zone: ZONA, hint: 'Clic para meter una moneda de $10', onSelect: () => meterMoneda() };
  registerInteractive(plato, coinEntry); registerInteractive(panza, coinEntry);
  registerInteractive(tray, { id: 'LLA-01', name: 'Bandeja de llaveros', zone: ZONA, hint: 'Clic para tomar tu llavero NFC', onSelect: () => tomarLlavero() });
  registerInteractive(mach, { id: 'LLA-01', name: 'Máquina de llaveros NFC', zone: ZONA, hint: `Llavero $${CONFIG.llaveroPesos}: mete monedas de $10 en la panza de Lorenzo`, onSelect: () => toast(estadoMaquina()) });

  /* piezas dinámicas (fuera del rayo) */
  stylus = new THREE.Group(); tabletG.add(stylus);
  cyl(.0075, .0075, .13, M.oro, 0, .08, 0, stylus, 10);
  cyl(.0078, .0078, .02, M.cacaoOsc, 0, .145, 0, stylus, 10);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.0075, .016, 10), M.negro); tip.rotation.x = Math.PI; tip.position.y = .008; stylus.add(tip);
  stylus.position.copy(STYLUS_HOME);
  flash = new THREE.Mesh(new THREE.CircleGeometry(.14, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.z = .04; flash.visible = false; eyeC.add(flash);
  coin = makeCoin(G); setVis(coin, false);
  setVis(llavero, false);
}

/* ---------------- habla y pasos ---------------- */
function hablar(t) { say(t, NOMBRE); st.talkT = Math.max(2.5, t.length / 14); }
function ir(paso) { st.paso = paso; st.pasoT = 0; st.recordado = false; drawTablet(); drawCredito(); }
const nombreSocio = () => socio.nombre || CONFIG.socioDemo.nombre;
const faltan = () => Math.max(0, Math.ceil((CONFIG.llaveroPesos - st.credito) / CONFIG.pesosPorMoneda));
const monedasTxt = n => `${NUM[n] || n} moneda${n === 1 ? '' : 's'} de $${CONFIG.pesosPorMoneda}`;

function alLlegar() {
  if (!socio.rostro) {
    ir('rostro'); st.saludoT = 0; st.mirada = 0;
    hablar('¡Hola! Soy Lorenzo el Cacao. Mírame un momento a la cámara de mi ojo para registrar tu rostro.');
  } else if (!socio.firmaHoy) {
    ir('firma'); hablar(`¡Hola de nuevo, ${nombreSocio()}! Firma tu registro del día en mi tablet con el lápiz.`);
  } else despuesDeFirma(`¡Hola de nuevo, ${nombreSocio()}! `);
}
function despuesDeFirma(pre = '¡Gracias por firmar! ') {
  if (!socio.llavero) {
    ir('monedas');
    const n = faltan();
    if (n > 0) hablar(`${pre}Tu llavero NFC cuesta $${CONFIG.llaveroPesos}: mete ${monedasTxt(n)} en la ranura de mi panza.`);
    revisarCredito();
  } else {
    ir('final');
    hablar(`${pre}Ya traes tu llavero; si quieres recargar, mete monedas de $10 en mi panza. Pasa a la barra; pide en la tablet y paga acercando tu llavero.`);
  }
}
function recordatorio() {
  const r = {
    rostro: 'Mírame a la cámara del ojo, o tócame, para tomar tu foto.',
    firma: 'Tu firma va en la tablet: dibuja en el recuadro y toca Firmar.',
    monedas: `Me faltan ${monedasTxt(faltan())} para tu llavero.`,
    tomar: 'Tu llavero está en la bandeja. ¡Tómalo!',
  }[st.paso];
  if (r) hablar(r);
}
function tocarLorenzo() {
  if (st.paso === 'espera') { alLlegar(); return; }
  if (st.paso === 'rostro') { capturar(); return; }
  if (st.ocupado) return;
  if (st.paso === 'final') hablar('Pasa a la barra; pide en la tablet y paga acercando tu llavero.');
  else recordatorio();
}

/* ---------------- rostro ---------------- */
function capturar() {
  if (st.paso !== 'rostro' || st.ocupado) return;
  st.ocupado = true; const g0 = gen;
  beep('info'); flash.visible = true;
  anim(.6, k => { flash.material.opacity = k < .15 ? k / .15 : 1 - (k - .15) / .85; flash.scale.setScalar(1 + k * 1.5); lensMat.emissiveIntensity = 1 + 6 * (1 - k); },
    () => { flash.visible = false; lensMat.emissiveIntensity = 1; });
  after(.35, () => {
    if (g0 !== gen) return;
    const uid = CONFIG.socioDemo.uid;
    updateSocio({ rostro: true, conocido: true, uid, nombre: CONFIG.socioDemo.nombre });
    publish(ZONA, ID, 'rostro_capturado', { uid }, 'ok'); beep('ok'); drawTablet();
  });
  after(1.1, () => {
    if (g0 !== gen) return; st.ocupado = false;
    if (socio.firmaHoy) { despuesDeFirma(`¡Listo, ${nombreSocio()}! `); return; }
    ir('firma'); hablar(`¡Listo, ${nombreSocio()}! Ya te conozco. Ahora firma tu registro del día en la tablet con el lápiz y toca Firmar.`);
  });
}

/* ---------------- tablet y firma ---------------- */
const TW = 512, TH = Math.round(512 * TABH / TABW);
const BOX = { x: 16, y: 140, w: 480, h: 148 };
const B_BORRAR = { x: 16, y: 298, w: 160, h: 50 }, B_FIRMAR = { x: 336, y: 298, w: 160, h: 50 };
const inR = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const pad = n => String(n).padStart(2, '0');
function fechaISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fechaLarga() { const s = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
function uvPx(hit) {
  if (!hit || hit.object !== scr.mesh || !hit.uv) return null;
  return [hit.uv.x * TW, (1 - hit.uv.y) * TH];
}
function tabletSelect(hit) {
  const q = uvPx(hit); if (!q) return; const [x, y] = q;
  if (inR(x, y, B_BORRAR)) { borrar(); return; }
  if (inR(x, y, B_FIRMAR)) { firmar(); return; }
  if (!inR(x, y, BOX)) return;
  if (st.firma.ok) return;
  if (!socio.rostro) { st.msg = 'Primero, rostro'; beep('err'); toast('Primero Lorenzo debe registrar tu rostro'); drawTablet(); return; }
  st.firma.activa = true; st.msg = ''; st.pasoT = 0;
  st.firma.trazos.push([[x, y]]); st.firma.movido = true; st.firma.roto = false;
  moverLapiz(hit.uv); drawTablet();
}
function tabletMove(hit) {
  const f = st.firma; if (!f.activa) return;
  const q = uvPx(hit); if (!q) return;
  const x = Math.min(BOX.x + BOX.w - 4, Math.max(BOX.x + 4, q[0])), y = Math.min(BOX.y + BOX.h - 4, Math.max(BOX.y + 4, q[1]));
  f.movido = true;
  if (f.roto || !f.trazos.length) { f.roto = false; f.trazos.push([[x, y]]); }
  else {
    const t = f.trazos[f.trazos.length - 1], [px, py] = t[t.length - 1], d = Math.hypot(x - px, y - py);
    if (d < 1.5) return;
    t.push([x, y]); f.tinta += d;
  }
  st.pasoT = 0; moverLapiz(hit.uv); drawTablet();
}
function tabletRelease() { if (!st.firma.activa) return; st.firma.activa = false; lapizACasa(); }
function moverLapiz(uv) { stylus.position.set((uv.x - .5) * TABW, (uv.y - .5) * TABH, .002); stylus.rotation.set(.85, 0, -.35); }
function lapizACasa() {
  const p0 = stylus.position.clone(), r0 = stylus.rotation.clone();
  anim(.3, k => { stylus.position.lerpVectors(p0, STYLUS_HOME, k); stylus.rotation.set(r0.x * (1 - k), 0, r0.z * (1 - k)); });
}
function borrar() {
  if (st.firma.ok) return;
  st.firma.trazos = []; st.firma.tinta = 0; st.msg = 'Recuadro limpio'; beep('info'); drawTablet();
}
function firmar() {
  if (st.firma.ok) return;
  if (!socio.rostro) { st.msg = 'Primero, rostro'; beep('err'); toast('Primero Lorenzo debe registrar tu rostro'); drawTablet(); return; }
  if (st.firma.tinta < TINTA_MIN) { st.msg = 'Firma muy corta'; beep('err'); toast('Traza tu firma completa en el recuadro'); drawTablet(); return; }
  const d = new Date(); st.firma.ok = true; st.firma.hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`; st.msg = '';
  updateSocio({ firmaHoy: true });
  publish(ZONA, ID, 'registro_dia', { uid: socio.uid, fecha: fechaISO() }, 'ok');
  beep('ok'); drawTablet();
  const g0 = gen; after(.6, () => { if (g0 === gen) despuesDeFirma(); });
}

function rr(g, r, rad) { g.beginPath(); g.roundRect ? g.roundRect(r.x, r.y, r.w, r.h, rad) : g.rect(r.x, r.y, r.w, r.h); }
function drawTablet() {
  if (!scr) return;
  const { g, tex } = scr, W = TW, H = TH, f = st.firma;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = HEX.panel; g.fillRect(0, 0, W, 46); g.fillStyle = HEX.oro; g.fillRect(0, 44, W, 2);
  g.fillStyle = HEX.crema; g.font = `800 24px ${FD}`; g.fillText('Registro del día', 16, 23);
  g.fillStyle = HEX.tenue; g.font = `400 13px ${FM}`; g.textAlign = 'right'; g.fillText('LOR-01 · Club', W - 14, 23); g.textAlign = 'left';
  const fecha = fechaLarga(); g.fillStyle = HEX.texto; fit(g, fecha, 400, FM, 15, 380); g.fillText(fecha, 16, 64);
  const nom = socio.rostro ? `${socio.nombre || CONFIG.socioDemo.nombre} · ${socio.uid || CONFIG.socioDemo.uid}` : 'Visitante sin registrar';
  g.fillStyle = socio.rostro ? HEX.crema : HEX.tenue; fit(g, nom, 700, FD, 24, 380); g.fillText(nom, 16, 94);
  g.font = `400 13px ${FM}`;
  if (socio.rostro) { g.fillStyle = HEX.hoja; g.fillText('● rostro registrado', 16, 122); }
  else if (st.paso === 'rostro') {
    g.fillStyle = HEX.ambar; g.fillText('mira a Lorenzo…', 16, 122);
    g.fillStyle = HEX.linea; g.fillRect(150, 117, 220, 10); g.fillStyle = HEX.oro; g.fillRect(150, 117, 220 * Math.min(1, st.mirada / MIRADA_SEG), 10);
  } else { g.fillStyle = HEX.tenue; g.fillText('○ rostro pendiente', 16, 122); }
  // retrato
  const P = { x: 410, y: 54, w: 86, h: 78 };
  g.fillStyle = HEX.cacao700 || '#2A211A'; g.fillRect(P.x, P.y, P.w, P.h);
  if (socio.rostro) {
    g.save(); g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip();
    g.fillStyle = '#5a3a28'; g.fillRect(P.x, P.y, P.w, P.h);
    g.fillStyle = HEX.oro; g.beginPath(); g.ellipse(P.x + 43, P.y + 84, 34, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#E8C9A4'; g.beginPath(); g.ellipse(P.x + 43, P.y + 36, 16, 19, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2A211A'; g.beginPath(); g.ellipse(P.x + 43, P.y + 22, 17, 9, 0, Math.PI, 0); g.fill();
    g.fillRect(P.x + 36, P.y + 34, 3, 3); g.fillRect(P.x + 47, P.y + 34, 3, 3);
    g.strokeStyle = '#2A211A'; g.lineWidth = 1.5; g.beginPath(); g.arc(P.x + 43, P.y + 42, 6, .2, Math.PI - .2); g.stroke();
    g.restore();
  } else { g.fillStyle = HEX.tenue; g.font = `800 34px ${FD}`; g.textAlign = 'center'; g.fillText('?', P.x + 43, P.y + 40); g.textAlign = 'left'; }
  g.strokeStyle = socio.rostro ? HEX.hoja : HEX.linea; g.lineWidth = 2; g.strokeRect(P.x + 1, P.y + 1, P.w - 2, P.h - 2);
  // recuadro de firma
  g.fillStyle = '#F6EFE2'; rr(g, BOX, 8); g.fill();
  g.strokeStyle = '#C9B99F'; g.lineWidth = 2; g.beginPath(); g.moveTo(BOX.x + 20, BOX.y + BOX.h - 30); g.lineTo(BOX.x + BOX.w - 20, BOX.y + BOX.h - 30); g.stroke();
  g.fillStyle = '#A08F79'; g.font = `800 22px ${FD}`; g.fillText('×', BOX.x + 22, BOX.y + BOX.h - 44);
  if (!f.trazos.length && !f.ok) { g.font = `400 14px ${FM}`; g.fillText('Firma aquí con el lápiz', BOX.x + 52, BOX.y + BOX.h - 44); }
  g.strokeStyle = '#2A211A'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const t of f.trazos) {
    g.beginPath(); g.moveTo(t[0][0], t[0][1]);
    if (t.length === 1) g.lineTo(t[0][0] + .1, t[0][1]); else for (let i = 1; i < t.length; i++) g.lineTo(t[i][0], t[i][1]);
    g.stroke();
  }
  if (!socio.rostro) {
    g.fillStyle = 'rgba(20,16,13,.78)'; rr(g, BOX, 8); g.fill();
    g.fillStyle = HEX.crema; g.textAlign = 'center'; fit(g, 'Primero mira a Lorenzo para registrar tu rostro', 600, FD, 20, 440);
    g.fillText('Primero mira a Lorenzo para registrar tu rostro', BOX.x + BOX.w / 2, BOX.y + BOX.h / 2); g.textAlign = 'left';
  }
  if (f.ok) {
    g.save(); g.translate(BOX.x + BOX.w - 120, BOX.y + 38); g.rotate(-.1);
    g.strokeStyle = HEX.hoja; g.lineWidth = 3; g.strokeRect(-96, -22, 192, 44);
    g.fillStyle = HEX.hoja; g.font = `800 22px ${FD}`; g.textAlign = 'center'; g.fillText(`FIRMADO ✓ ${f.hora}`, 0, 1); g.restore(); g.textAlign = 'left';
  }
  // botones
  const listo = f.tinta >= TINTA_MIN;
  g.globalAlpha = f.ok ? .4 : 1;
  g.fillStyle = HEX.panel; rr(g, B_BORRAR, 10); g.fill(); g.strokeStyle = HEX.terracota; g.lineWidth = 2; g.stroke();
  g.fillStyle = HEX.crema; g.font = `800 22px ${FD}`; g.textAlign = 'center'; g.fillText('Borrar', B_BORRAR.x + B_BORRAR.w / 2, B_BORRAR.y + 26);
  g.globalAlpha = f.ok ? .5 : 1;
  g.fillStyle = f.ok ? HEX.hoja : listo ? HEX.oro : '#6B5A2A'; rr(g, B_FIRMAR, 10); g.fill();
  g.fillStyle = HEX.bg; g.fillText(f.ok ? 'Firmado' : 'Firmar', B_FIRMAR.x + B_FIRMAR.w / 2, B_FIRMAR.y + 26);
  g.globalAlpha = 1;
  const estado = st.msg || (f.ok ? 'registro guardado' : `tinta ${Math.min(100, Math.round(f.tinta / TINTA_MIN * 100))}%`);
  g.fillStyle = st.msg ? HEX.ambar : HEX.tenue; fit(g, estado, 400, FM, 14, 150); g.fillText(estado, W / 2, B_FIRMAR.y + 26);
  g.textAlign = 'left';
  tex.needsUpdate = true;
}

/* ---------------- monedas y llavero ---------------- */
function estadoMaquina() {
  if (st.enBandeja) return 'Tu llavero está en la bandeja';
  if (socio.llavero) return `Ya tienes llavero · cada $${CONFIG.pesosPorCacao} = 1 cacao de recarga`;
  return `Llavero NFC $${CONFIG.llaveroPesos} · crédito $${st.credito}`;
}
function drawCredito() {
  if (!cred) return;
  const { g, c, tex } = cred, W = c.width, H = c.height;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = HEX.tenue; g.font = `600 12px ${FM}`; g.fillText('LLA-01 · LLAVEROS NFC', 10, 13);
  if (st.enBandeja) {
    g.fillStyle = HEX.hoja; g.font = `800 30px ${FD}`; g.fillText('¡Tómalo! ↓', 10, 50);
  } else if (socio.llavero) {
    g.fillStyle = HEX.hoja; g.font = `800 26px ${FD}`; g.fillText('Recarga', 10, 44);
    g.fillStyle = HEX.texto; g.font = `400 13px ${FM}`; g.fillText(`$${CONFIG.pesosPorCacao} = 1 cacao`, 10, 72);
  } else {
    g.fillStyle = HEX.oro; g.font = `800 34px ${FD}`; g.fillText(`$${st.credito}`, 10, 46);
    const w = g.measureText(`$${st.credito}`).width;
    g.fillStyle = HEX.texto; g.font = `400 14px ${FM}`; g.fillText(`de $${CONFIG.llaveroPesos}`, 18 + w, 50);
    g.fillStyle = HEX.linea; g.fillRect(10, 72, W - 20, 8);
    g.fillStyle = HEX.hoja; g.fillRect(10, 72, (W - 20) * Math.min(1, st.credito / CONFIG.llaveroPesos), 8);
  }
  tex.needsUpdate = true;
}
function meterMoneda() {
  if (st.volando) { st.cola = Math.min(st.cola + 1, 5); return; }
  st.volando = true; const g0 = gen;
  const a = new THREE.Vector3(-.02, .975, 1.25);
  pod.updateMatrixWorld(true);
  panzaG.getWorldPosition(v3);
  const b = G.worldToLocal(v3.clone()), pre = b.clone(); pre.z += .07;
  coin.position.copy(a); setVis(coin, true);
  anim(.6, k => {
    if (k < .8) { const t = k / .8; coin.position.lerpVectors(a, pre, t); coin.position.y += Math.sin(Math.PI * t) * .22; coin.rotation.set(t * 9, 0, Math.PI / 2 * t); }
    else { coin.position.lerpVectors(pre, b, (k - .8) / .2); coin.rotation.set(0, pod.rotation.y, Math.PI / 2); }
  }, () => {
    setVis(coin, false); st.volando = false;
    if (g0 !== gen) return;
    monedaDentro();
    if (st.cola > 0) { st.cola--; meterMoneda(); }
  });
}
function monedaDentro() {
  st.credito += CONFIG.pesosPorMoneda; beep('coin');
  publish(ZONA, ID, 'moneda', { pesos: CONFIG.pesosPorMoneda, credito: st.credito });
  if (socio.llavero && !st.enBandeja) {
    const c = Math.floor(st.credito / CONFIG.pesosPorCacao);
    if (c > 0) { st.credito -= c * CONFIG.pesosPorCacao; abono(c, 'Monedas en Lorenzo', ZONA, ID, 'monedas'); toast(`Recarga: +${c} cacao${c === 1 ? '' : 's'}`); }
  } else if (st.paso === 'monedas') {
    const n = faltan(); if (n > 0) toast(`Crédito $${st.credito} · falta${n === 1 ? '' : 'n'} ${monedasTxt(n)}`);
    st.pasoT = 0; revisarCredito();
  } else toast(`Crédito $${st.credito} guardado para tu llavero`);
  drawCredito();
}
function revisarCredito() {
  if (st.paso === 'monedas' && !socio.llavero && !st.enBandeja && !st.ocupado && st.credito >= CONFIG.llaveroPesos) dispensar();
}
function dispensar() {
  st.ocupado = true; st.credito -= CONFIG.llaveroPesos; ir('entregando'); const g0 = gen;
  publish(ZONA, 'LLA-01', 'accionado', { uid: socio.uid, pesos: CONFIG.llaveroPesos });
  beep('info');
  let soltado = false;
  anim(1.4, k => {
    st.palanca = Math.sin(Math.PI * Math.min(1, k / .8));
    if (k > .45 && !soltado) { soltado = true; caeLlavero(); }
  }, () => {
    st.palanca = 0; if (g0 !== gen) return;
    st.ocupado = false; st.enBandeja = true; ir('tomar');
    hablar('¡Clic, clac! Ahí está tu llavero NFC en la bandeja. Tómalo.');
  });
}
function caeLlavero() {
  setVis(llavero, true);
  const a = new THREE.Vector3(-.55, 1.0, .99), b = new THREE.Vector3(-.56, .958, 1.2);
  anim(.55, k => {
    llavero.position.lerpVectors(a, b, k);
    llavero.position.y += Math.abs(Math.sin(k * Math.PI * 2.2)) * .04 * (1 - k);
    llavero.rotation.set((1 - k) * .9, .5 + k * 1.2, 0);
  });
}
function tomarLlavero() {
  if (!st.enBandeja) { toast(socio.llavero ? 'Ya tienes tu llavero NFC' : 'La bandeja está vacía'); return; }
  st.enBandeja = false; setVis(llavero, false);
  updateSocio({ llavero: true });
  publish(ZONA, 'LLA-01', 'entregado', { uid: socio.uid }, 'ok'); beep('ok');
  let c = 0;
  if (st.credito >= CONFIG.pesosPorCacao) {
    c = Math.floor(st.credito / CONFIG.pesosPorCacao); st.credito -= c * CONFIG.pesosPorCacao;
    abono(c, 'Monedas en Lorenzo', ZONA, ID, 'monedas');
  }
  ir('final');
  hablar(`¡Listo, ya es tuyo! ${c ? `Te abono ${c} cacao${c === 1 ? "" : "s"} al monedero con lo que sobró. ` : ''}Pasa a la barra; pide en la tablet y paga acercando tu llavero.`);
}

/* ---------------- reinicio ---------------- */
function reiniciar() {
  gen++; resetEstado();
  setVis(llavero, false); setVis(coin, false); flash.visible = false; lensMat.emissiveIntensity = 1;
  stylus.position.copy(STYLUS_HOME); stylus.rotation.set(0, 0, 0); lever.rotation.x = -.4;
  drawTablet(); drawCredito();
}

/* ---------------- animación por cuadro ---------------- */
const lerpTo = (o, k, x, y, z) => { o.rotation.x += (x - o.rotation.x) * k; o.rotation.y += (y - o.rotation.y) * k; o.rotation.z += (z - o.rotation.z) * k; };
const lastPos = new THREE.Vector3(), lastRot = { y: 0 };
function update(dt, now) {
  /* colisiones siguen al grupo si se mueve en modo edición */
  if (!lastPos.equals(G.position) || lastRot.y !== G.rotation.y) {
    G.updateMatrixWorld(true); for (const c of colliders) c.box.setFromObject(c.obj);
    lastPos.copy(G.position); lastRot.y = G.rotation.y;
  }
  /* trazo cortado si el rayo salió del lienzo (core no llamó onMove este cuadro) */
  if (st.firma.activa) { if (!st.firma.movido) st.firma.roto = true; st.firma.movido = false; }
  const H = headPos(v1), D = headDir(v2);
  const dist = Math.hypot(H.x - G.position.x, H.z - G.position.z);
  const cerca = dist < CERCA && zoneAt(H.x, H.z) === 'lobby';

  /* flujo */
  if (st.paso === 'espera' && cerca && !st.ocupado) alLlegar();
  if (st.paso === 'rostro' && cerca && !st.ocupado) {
    st.saludoT += dt;
    eyeCam.getWorldPosition(v3);
    const ang = D.angleTo(v3.sub(H));
    if (st.saludoT > 1 && ang < MIRADA_ANG) st.mirada += dt; else st.mirada = Math.max(0, st.mirada - dt * .5);
    if (Math.floor(now * 8) !== Math.floor((now - dt) * 8)) drawTablet();
    if (st.mirada >= MIRADA_SEG) capturar();
  }
  if (['rostro', 'firma', 'monedas', 'tomar'].includes(st.paso) && cerca && !st.ocupado && !st.firma.activa) {
    st.pasoT += dt;
    if (st.pasoT > RECORDAR_SEG && !st.recordado) { st.recordado = true; recordatorio(); }
  }

  /* cabeza: mira al jugador, a la tablet al firmar, a la máquina al accionar */
  G.worldToLocal(v3.copy(H));
  let yaw = Math.atan2(v3.x, v3.z), pitch = -Math.atan2(v3.y - POD.cy - .3, Math.hypot(v3.x, v3.z)) * .4;
  if (st.firma.activa) yaw = .35;
  if (st.ocupado && st.paso === 'entregando') { yaw = 0; pitch = 0; }
  yaw = Math.max(-.6, Math.min(.6, yaw)); pitch = Math.max(-.15, Math.min(.15, pitch));
  const kh = Math.min(1, dt * 3);
  pod.rotation.y += (yaw - pod.rotation.y) * kh; pod.rotation.x += (pitch - pod.rotation.x) * kh;
  /* respiración */
  const br = Math.sin(now * 1.6);
  podMesh.scale.set(1 + br * .008, 1 + br * .014, 1 + br * .008);
  pod.position.y = POD.cy + br * .006;
  /* parpadeo */
  st.blinkT -= dt;
  if (st.blinkT < 0) { st.blinkT = 2.5 + Math.random() * 3; anim(.2, k => { lid.rotation.x = -.35 + 1.8 * Math.sin(Math.PI * k); }); }
  /* boca */
  st.talkT = Math.max(0, st.talkT - dt);
  const open = st.talkT > 0 ? (.5 + .5 * Math.sin(now * 17)) * (.55 + .45 * Math.sin(now * 6.1)) : 0;
  jaw.position.y += (-.03 - open * .045 - jaw.position.y) * Math.min(1, dt * 20);
  jaw.rotation.x = open * .25;
  /* cejas y LED de la cámara */
  const cap = st.paso === 'rostro' ? st.mirada / MIRADA_SEG : 0;
  for (const c of cejas) c.children[0].position.y = cap * .025 + (st.talkT > 0 ? .006 * Math.sin(now * 5) : 0);
  ledMat.color.setHex(cap > 0 ? C.oro : C.hoja);
  ledMat.color.multiplyScalar(cap > 0 ? .6 + .4 * cap + .2 * Math.sin(now * 20) : .55 + .45 * Math.sin(now * 2.2));
  ombligoMat.color.setHex(st.paso === 'monedas' && Math.sin(now * 6) > 0 ? C.oro : C.hoja);
  /* brazos */
  const ka = Math.min(1, dt * 5), sway = Math.sin(now * 1.3) * .05;
  if (st.paso === 'firma' || st.firma.activa) lerpTo(armR.sh, ka, -1.05, 0, .22), lerpTo(armR.el, ka, -.25, 0, 0);
  else if (st.paso === 'rostro' && st.talkT > 0) lerpTo(armR.sh, ka, -.4, 0, 1.6 + Math.sin(now * 8) * .25), lerpTo(armR.el, ka, -.9, 0, 0);
  else lerpTo(armR.sh, ka, -.25 + sway, 0, .2), lerpTo(armR.el, ka, -.5, 0, 0);
  if (st.paso === 'entregando') {
    const p = st.palanca; lerpTo(armL.sh, Math.min(1, dt * 10), -1.85 + p * .45, 0, .08), lerpTo(armL.el, ka, -.1, 0, 0);
    lever.rotation.x = -.4 + p * 1.0;
  } else if (st.paso === 'monedas' || st.paso === 'tomar') lerpTo(armL.sh, ka, -.55, 0, .45 + sway), lerpTo(armL.el, ka, -.9, 0, 0);
  else lerpTo(armL.sh, ka, -.25 - sway, 0, -.2), lerpTo(armL.el, ka, -.5, 0, 0);
}

export function init() {
  build();
  drawTablet(); drawCredito();
  onUpdate(update);
  on('visita:reiniciar', reiniciar);
  on('fuentes', () => { drawTablet(); drawCredito(); });
  on('socio:cambio', () => { drawTablet(); drawCredito(); });
}

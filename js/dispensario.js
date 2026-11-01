/* =====================================================================
   Dispensario — x -12…0, z -12…-5. Entrada por el main (x -5…-3, z -5).
   Dispensadores con báscula de salida, báscula de turno y gateway IoT.
   Cobra con el llavero NFC (cargo) y respeta turno + límite mensual.
   ===================================================================== */
import {
  THREE, scene, box, cyl, mat, M, C, HEX, FD, FM, DEG, makeScreen, fit, fmt, solid, addCollider,
  registerInteractive, onUpdate, anim, after, beep, ensureAudio, publish, socio, updateSocio,
  cargo, MOTIVOS, stats, on, say, clock,
} from './core.js';

const PRODUCTOS = [
  { id: 'DIS-01', name: 'Variedad A', price: 9, stock: 120, color: 0x6a9a52, x: -9.0 },
  { id: 'DIS-02', name: 'Variedad B', price: 10, stock: 80, color: 0x8fae5c, x: -7.2 },
  { id: 'DIS-03', name: 'Variedad C', price: 12, stock: 6, color: 0x4f7a3f, x: -5.4 },
  { id: 'DIS-04', name: 'Variedad D', price: 11, stock: 40, color: 0xa3b36a, x: -3.6 },
];
const machines = [];

function statusOf(m) {
  if (!m.on) return ['APAGADO', HEX.terracota];
  if (m.stock != null && m.stock <= 0) return ['SIN STOCK', HEX.terracota];
  if (m.stock != null && m.stock <= Math.max(2, m.max * .1)) return ['STOCK BAJO', HEX.ambar];
  return ['EN LÍNEA', HEX.hoja];
}
function flash(m, text, kind, dur = 1.8) { m.flash = { text, kind, until: clock.elapsedTime + dur }; draw(m); }
function header(m) {
  const { g, c } = m.screen; const W = c.width, k = Math.min(W / 512, c.height / 300);
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, c.height);
  g.fillStyle = HEX.panel; g.fillRect(0, 0, W, 50 * k);
  g.textBaseline = 'middle'; g.font = `600 ${20 * k}px ${FM}`; g.fillStyle = HEX.tenue; g.fillText(m.id, 18 * k, 25 * k);
  const [st, col] = statusOf(m); g.font = `600 ${18 * k}px ${FM}`; const sw = g.measureText(st).width;
  g.fillStyle = col; g.fillRect(W - sw - 40 * k, 12 * k, sw + 24 * k, 26 * k); g.fillStyle = HEX.bg; g.fillText(st, W - sw - 28 * k, 25 * k);
  g.fillStyle = HEX.crema; fit(g, m.name, 800, FD, 36 * k, W - 36 * k); g.fillText(m.name, 18 * k, 88 * k);
  return k;
}
function draw(m) {
  const { g, c, tex } = m.screen; const W = c.width, Hh = c.height; const k = header(m);
  let big = '', sub = '', bar = null, hint = '';
  if (m.kind === 'dose') { big = `${m.price} cacaos/g`; sub = `${fmt(m.stock)} g en depósito`; bar = m.stock / m.max; hint = 'Llavero NFC + límite mensual'; }
  if (m.kind === 'shift') { big = `${m.g.toFixed(1)} g`; sub = stats.turno ? 'Turno abierto' : 'Turno cerrado'; hint = stats.turno ? 'Toca para cerrar con pesaje' : 'Toca para abrir con pesaje'; }
  if (m.kind === 'gateway') { big = `${m.nodos} nodos`; sub = `${m.lat} ms · mqtt`; hint = 'broker cacaos.local:1883'; }
  g.fillStyle = HEX.oro; fit(g, big, 800, FD, 62 * k, W - 36 * k); g.fillText(big, 18 * k, Hh * .5);
  if (bar != null) {
    const y = Hh * .66; g.fillStyle = HEX.linea; g.fillRect(18 * k, y, W - 36 * k, 12 * k);
    g.fillStyle = statusOf(m)[1]; g.fillRect(18 * k, y, (W - 36 * k) * Math.max(0, Math.min(1, bar)), 12 * k);
  }
  g.fillStyle = HEX.texto; g.font = `400 ${22 * k}px ${FM}`; g.fillText(sub, 18 * k, Hh * .78);
  g.fillStyle = HEX.tenue; g.font = `400 ${18 * k}px ${FM}`; g.fillText(hint, 18 * k, Hh - 22 * k);
  if (m.flash) {
    const fc = m.flash.kind === 'ok' ? HEX.hoja : m.flash.kind === 'warn' ? HEX.ambar : HEX.terracota;
    g.fillStyle = fc; g.fillRect(0, Hh * .34, W, Hh * .42);
    g.fillStyle = HEX.bg; fit(g, m.flash.text, 800, FD, 46 * k, W - 30 * k); g.textAlign = 'center'; g.fillText(m.flash.text, W / 2, Hh * .55); g.textAlign = 'left';
  }
  tex.needsUpdate = true;
  const col = new THREE.Color(statusOf(m)[1]); m.ledMat.color.copy(col); m.ledMat.emissive.copy(col);
}
function finish(m, g, scr, led, radius, pos, rotY, hint) {
  m.screen = makeScreen(scr.w, scr.h); m.screen.mesh.position.set(...scr.pos); m.screen.mesh.rotation.x = scr.rx || 0; g.add(m.screen.mesh);
  m.ledMat = mat(C.hoja, { e: C.hoja, ei: 1.6 });
  const l = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 8), m.ledMat); l.position.set(...led); g.add(l);
  g.position.set(...pos); g.rotation.y = rotY * DEG; scene.add(g);
  addCollider(g);
  registerInteractive(g, { id: m.id, name: m.name, zone: 'dispensario', radius, movable: true, hint, onSelect: () => act(m) });
  machines.push(m); draw(m);
}

function buildDispenser(d) {
  const g = new THREE.Group();
  const m = { ...d, kind: 'dose', grams: 1, max: d.stock, on: true, group: g };
  const body = mat(0x221914, { r: .45, m: .25 });
  box(.9, 1.9, .7, body, 0, .95, 0, g);
  box(.56, .78, .02, M.vidrio, -.12, 1.3, .352, g);
  for (let r = 0; r < 3; r++) { box(.5, .015, .3, M.acero, -.12, 1.0 + r * .27, .18, g); for (let i = 0; i < 4; i++) cyl(.04, .04, .1, mat(d.color, { r: .6, t: true, o: .9 }), -.3 + i * .12, 1.06 + r * .27, .2, g, 12); }
  box(.42, .16, .04, M.negro, -.12, .44, .352, g); box(.42, .02, .14, M.acero, -.12, .36, .42, g);
  box(.9, .04, .02, mat(d.color, { e: d.color, ei: .6 }), 0, 1.86, .352, g);
  const pad = cyl(.05, .05, .008, M.nfc, .3, 1.08, .356, g); pad.rotation.x = Math.PI / 2;
  m.nfc = new THREE.Vector3(.3, 1.08, .36); m.out = new THREE.Vector3(-.12, .38, .42);
  finish(m, g, { w: .24, h: .32, pos: [.3, 1.45, .353] }, [.3, 1.66, .353], .65, [d.x, 0, -11.45], 0, 'Acerca tu llavero: 1 g por toque');
}
function buildShiftScale() {
  const g = new THREE.Group();
  const m = { id: 'TUR-01', name: 'Báscula de turno', kind: 'shift', on: true, g: 0, group: g };
  const body = mat(0x221914, { r: .45, m: .25 });
  box(.6, .9, .5, body, 0, .45, 0, g); box(.55, .02, .45, M.acero, 0, .91, 0, g);
  cyl(.12, .1, .14, M.vidrio, 0, .99, 0, g);
  box(.3, .2, .03, M.negro, 0, 1.12, -.2, g).rotation.x = -.3;
  m.nfc = new THREE.Vector3(.2, .925, .15); cyl(.05, .05, .008, M.nfc, .2, .925, .15, g);
  finish(m, g, { w: .28, h: .18, pos: [0, 1.12, -.183], rx: -.3 }, [-.22, .93, .2], .45, [-1.2, 0, -8.2], -90, 'Abre o cierra el turno con pesaje');
  return m;
}
function buildGateway() {
  const g = new THREE.Group();
  const m = { id: 'GW-01', name: 'Gateway IoT · red local', kind: 'gateway', on: true, nodos: 0, lat: 12, group: g, blink: [] };
  box(.5, 1.2, .5, M.negro, 0, .6, 0, g);
  for (let i = 0; i < 8; i++) { const lm = mat(C.hoja, { e: C.hoja, ei: 1 }); m.blink.push(lm); box(.03, .015, .01, lm, -.17 + (i % 4) * .05, .55 + Math.floor(i / 4) * .08, .252, g); }
  for (const x of [-.18, .18]) cyl(.008, .008, .3, M.negro, x, 1.35, -.15, g, 6);
  finish(m, g, { w: .38, h: .22, pos: [0, .95, .252] }, [.2, .4, .252], .45, [-11.45, 0, -6.6], 90, 'Estado de la red de máquinas');
  return m;
}

const ringGeo = new THREE.RingGeometry(.05, .06, 32);
function pulse(m) {
  const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: C.hoja, transparent: true, side: THREE.DoubleSide }));
  r.position.copy(m.nfc); r.position.z += .01; m.group.add(r);
  anim(.7, k => { r.scale.setScalar(1 + k * 3); r.material.opacity = 1 - k; }, () => { m.group.remove(r); r.material.dispose(); });
}
function spawnBag(m) {
  const g = m.group;
  const bolsa = box(.1, .14, .02, mat(0xe8dcc6, { r: .6 }), -.12, 1.1, .3, g); box(.06, .04, .021, mat(m.color), 0, 0, 0, bolsa);
  anim(.8, k => { const e = k < .7 ? (k / .7) ** 2 : 1 - Math.sin((k - .7) / .3 * Math.PI) * .08; bolsa.position.set(-.12, 1.1 - (1.1 - (m.out.y + .07)) * e, .3 + .12 * k); },
    () => after(6, () => g.remove(bolsa)));
}
const totalStock = () => machines.filter(x => x.kind === 'dose').reduce((s, x) => s + x.stock, 0);

function act(m) {
  ensureAudio();
  if (m.kind === 'gateway') { beep('info'); flash(m, 'Red OK', 'ok'); publish('dispensario', m.id, 'ping', { nodos: m.nodos, lat_ms: m.lat }); return; }
  if (m.kind === 'shift') {
    pulse(m);
    const total = +totalStock().toFixed(1);
    if (!stats.turno) { stats.turno = true; stats.cuadre = total; m.g = total; flash(m, 'Turno abierto', 'ok'); publish('dispensario', m.id, 'apertura', { g: total }, 'ok'); }
    else { const disp = +(stats.cuadre - total).toFixed(2); stats.turno = false; m.g = total; flash(m, 'Turno cerrado', 'warn'); publish('dispensario', m.id, 'cierre', { g: total, dispensado_g: disp }, 'ok'); }
    beep('ok'); machines.forEach(draw); updateSocio({}); return;
  }
  // dispensador
  const err = (texto, evt, payload) => { flash(m, texto, 'err'); beep('err'); if (evt) publish('dispensario', m.id, evt, payload, 'err'); };
  if (!stats.turno) return err('Turno cerrado', 'rechazado', { motivo: 'turno_cerrado' });
  if (m.stock < m.grams) return err('Sin stock', 'sin_stock', { g: m.stock });
  if (socio.llavero && socio.dispensadoMes + m.grams > socio.limiteMes) return err('Límite del mes', 'rechazado', { uid: socio.uid, motivo: 'limite', g: socio.dispensadoMes });
  pulse(m);
  const r = cargo(m.price * m.grams, `${m.name} ${m.grams} g`, 'dispensario', m.id, 'dispensa');
  if (!r.ok) {
    err(MOTIVOS[r.motivo] || 'Rechazado');
    if (r.motivo === 'sin_llavero') say('Necesitas tu llavero NFC. Pídelo a Lorenzo en el lobby.', 'Dispensario');
    return;
  }
  const real = +(m.grams + (Math.random() - .5) * .04).toFixed(2);
  m.stock = +(m.stock - real).toFixed(2);
  updateSocio({ dispensadoMes: +(socio.dispensadoMes + real).toFixed(2) });
  beep('ok'); flash(m, `${real.toFixed(2)} g`, 'ok'); spawnBag(m);
  publish('dispensario', m.id, 'bascula', { g_pedido: m.grams, g_real: real, stock_g: m.stock });
  if (m.stock <= Math.max(2, m.max * .1)) publish('dispensario', m.id, 'stock_bajo', { g: m.stock }, 'err');
}

export function init() {
  PRODUCTOS.forEach(buildDispenser);
  const turno = buildShiftScale();
  const gw = buildGateway();
  stats.cuadre = +totalStock().toFixed(1); turno.g = stats.cuadre;
  // mostrador de recepción del dispensario
  solid(box(2.2, .95, .6, M.cacao, -7.5, .475, -6.4)); box(2.3, .04, .7, M.oro, -7.5, .97, -6.4);
  let t = 0;
  onUpdate((dt, now) => {
    for (const m of machines) if (m.flash && now > m.flash.until) { m.flash = null; draw(m); }
    gw.blink.forEach((b, i) => { b.emissiveIntensity = Math.sin(now * (3 + i) + i) > 0 ? 1.4 : .1; });
    t += dt;
    if (t > 2) { t = 0; gw.nodos = 18 + Math.round(Math.random()); gw.lat = 8 + Math.round(Math.random() * 10); if (!gw.flash) draw(gw); }
  });
  on('fuentes', () => machines.forEach(draw));
  on('visita:reiniciar', () => machines.forEach(draw));
}

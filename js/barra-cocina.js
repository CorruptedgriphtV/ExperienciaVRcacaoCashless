/* =====================================================================
   Barra + Cocina — main (lado este, x ≈ 8) y cocina (x 0…12, z -12…-5).
   TAB-01: tablet de pedidos en la barra, paga con llavero (cargo).
   KDS-01: pantalla de comandas del chef (pendiente → en preparación → lista).
   PAS-01: pase de cocina; la charola aparece cuando la comanda está lista.
   ===================================================================== */
import {
  THREE, scene, camera, box, cyl, mat, M, C, HEX, FD, FM, makeScreen, fit, solid, addCollider,
  registerInteractive, removeTargets, onUpdate, anim, after, say, beep, publish, socio, cargo, MOTIVOS,
  on, toast,
} from './core.js';

/* ---------------- datos ---------------- */
const MENU = [
  { id: 'agua', nombre: 'Agua', precio: 2 },
  { id: 'cafe', nombre: 'Café', precio: 3 },
  { id: 'choco', nombre: 'Chocolate caliente', precio: 4 },
  { id: 'quesadilla', nombre: 'Quesadilla', precio: 6 },
  { id: 'tacos', nombre: 'Tacos (3)', precio: 9 },
  { id: 'barra', nombre: 'Consumo en barra', precio: 8 },
];
const ESTADO = {
  pendiente: { t: 'Pendiente', corto: 'Pendiente', col: HEX.terracota },
  en_preparacion: { t: 'En preparación', corto: 'Preparando', col: HEX.ambar },
  lista: { t: 'Lista', corto: 'Lista ✓', col: HEX.hoja },
  entregada: { t: 'Entregada', corto: 'Entregada', col: HEX.tenue },
};
const AUTO_PREP = 3, AUTO_LISTA = 8;   // segundos del chef automático
const pad = n => String(n).padStart(3, '0');
const horaHM = () => new Date().toTimeString().slice(0, 5);
const mmss = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const comandas = [];
const cart = new Map();
let nextNum = 1, T = 0, paying = false, payToken = 0, chefAuto = true;
let msg = null;            // { text, kind, until }
let bell, tablet, tabScr, reader, readerMat, pulseRing, kds, kdsScr, chef, burnerMat, ovenMat;
const trays = [];          // { c, g, entry, slot }

/* ---------------- utilidades de lienzo ---------------- */
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function hitRects(rects, scr, hit) {
  if (!hit || hit.object !== scr.mesh || !hit.uv) return null;
  const x = hit.uv.x * scr.c.width, y = (1 - hit.uv.y) * scr.c.height;
  return rects.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
}
const sharedGeo = {};
function mk(key, make, m, x, y, z, parent) {
  const geo = sharedGeo[key] ||= make();
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o;
}

/* =====================================================================
   MOBILIARIO DEL MAIN
   ===================================================================== */
function buildBarra() {
  // mostrador a lo largo de z (cliente al oeste, personal al este)
  const z0 = -4, z1 = 2.5, zc = (z0 + z1) / 2, L = z1 - z0;
  solid(box(.7, 1.05, L, M.madera, 8, .525, zc));
  box(.85, .05, L + .1, M.oro, 8, 1.075, zc);
  box(.04, .9, L, M.cacaoOsc, 7.63, .5, zc);                       // zoclo/panel del cliente
  box(.06, .06, L, M.acero, 7.5, .22, zc);                          // reposapiés
  // contrabarra: gabinete bajo + repisas con botellas y frascos
  solid(box(.7, .95, L, M.cacaoOsc, 11.5, .475, zc));
  box(.74, .04, L + .04, M.oro, 11.5, .97, zc);
  box(.05, 1.4, L, M.madera, 11.87, 1.75, zc);                      // respaldo de madera
  const botMats = [0x2f5d8a, 0x6a9a52, 0xc25a36, 0xd4af37, 0x8a3b2a].map(c => mat(c, { r: .2, t: true, o: .82 }));
  const frasco = mat(0xd8eef2, { t: true, o: .35, r: .1 }), cacaoGrano = mat(0x4a2b1a, { r: .8 });
  for (const y of [1.45, 1.9]) {
    box(.34, .03, L - .2, M.oro, 11.68, y, zc);
    for (let i = 0; i < 11; i++) {
      const z = z0 + .35 + i * .56;
      if ((i + (y > 1.6 ? 1 : 0)) % 3 === 0) {                        // frasco con granos de cacao
        mk('frasco', () => new THREE.CylinderGeometry(.07, .07, .2, 14), frasco, 11.68, y + .115, z, scene);
        mk('granos', () => new THREE.CylinderGeometry(.064, .064, .12, 14), cacaoGrano, 11.68, y + .075, z, scene);
      } else {
        mk('botella', () => new THREE.CylinderGeometry(.035, .04, .26, 10), botMats[i % 5], 11.68, y + .145, z, scene);
        mk('cuello', () => new THREE.CylinderGeometry(.012, .016, .08, 8), botMats[i % 5], 11.68, y + .31, z, scene);
      }
    }
  }
  // cafetera y dispensador "consumo en barra" sobre la contrabarra
  box(.42, .5, .46, mat(0x221914, { r: .45, m: .25 }), 11.55, 1.24, 1.6);
  box(.12, .05, .3, M.acero, 11.3, 1.3, 1.6); cyl(.045, .04, .09, M.crema, 11.32, 1.04, 1.6);
  cyl(.05, .05, .42, M.acero, 11.55, 1.2, -3.2); box(.3, .09, .12, M.acero, 11.55, 1.45, -3.2);
  box(.025, .14, .025, mat(0xb8742e, { r: .4 }), 11.45, 1.56, -3.2);
  // bancos altos frente a la barra (se deja libre z ≈ -0.5, frente a la tablet)
  const asiento = mat(0x3b2a1f, { r: .5 });
  for (const z of [-3.3, -2.2, 1.0, 2.0]) {
    solid(cyl(.2, .2, .07, asiento, 7.2, .78, z));
    cyl(.03, .03, .75, M.acero, 7.2, .375, z); cyl(.2, .22, .03, M.acero, 7.2, .015, z);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(.16, .012, 6, 20), M.oro); aro.rotation.x = Math.PI / 2; aro.position.set(7.2, .32, z); scene.add(aro);
  }
}

function buildMesas() {
  const madera = mat(0x5e3a24, { r: .6 }), silla = mat(0x6e4429, { r: .7 });
  const mesas = [[-8, -2.4], [-8, 1.6], [-4, 1.6], [-4, -1.6], [3, 2.0]];
  for (const [x, z] of mesas) {
    solid(cyl(.55, .55, .05, madera, x, .76, z, scene, 28));
    cyl(.05, .05, .72, M.cacaoOsc, x, .38, z); cyl(.28, .3, .04, M.cacaoOsc, x, .02, z);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, cx = x + Math.cos(a) * .85, cz = z + Math.sin(a) * .85;
      const s = new THREE.Group(); s.position.set(cx, 0, cz); s.rotation.y = -a - Math.PI / 2; scene.add(s);
      box(.42, .05, .42, silla, 0, .46, 0, s); box(.42, .45, .04, silla, 0, .7, -.2, s);
      for (const [lx, lz] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) mk('pata', () => new THREE.BoxGeometry(.035, .44, .035), M.cacaoOsc, lx, .22, lz, s);
      s.updateMatrixWorld(true); addCollider(s.children[0]);
    }
  }
}

/* =====================================================================
   TAB-01 — tablet de pedidos
   ===================================================================== */
const SW = .48, SH = .34;
let tabRects = [];
function totalCart() { let t = 0; for (const m of MENU) t += (cart.get(m.id) || 0) * m.precio; return t; }
function setMsg(text, kind = 'info', dur = 5) { msg = { text, kind, until: T + dur }; drawTablet(); }

function buildTablet() {
  tablet = new THREE.Group(); tablet.position.set(7.7, 1.1, -.5); tablet.rotation.y = -Math.PI / 2; scene.add(tablet);
  box(.26, .02, .18, M.negro, 0, .01, -.02, tablet);
  cyl(.022, .022, .2, M.acero, 0, .11, -.05, tablet, 12);
  const head = new THREE.Group(); head.position.set(0, .3, -.03); head.rotation.x = -.32; tablet.add(head);
  box(SW + .03, SH + .03, .025, M.negro, 0, 0, -.014, head);
  box(SW + .04, .012, .03, M.oro, 0, -SH / 2 - .02, -.012, head);
  tabScr = makeScreen(SW, SH, 768); tabScr.mesh.position.z = .0005; head.add(tabScr.mesh);
  // lector NFC junto a la tablet (lado derecho del socio)
  const rd = new THREE.Group(); rd.position.set(.36, 0, .02); tablet.add(rd);
  box(.13, .03, .13, M.negro, 0, .015, 0, rd);
  const top = box(.12, .025, .12, M.negro, 0, .06, 0, rd); top.rotation.x = -.35;
  readerMat = mat(C.hoja, { e: C.hoja, ei: .5 });
  reader = cyl(.045, .045, .008, readerMat, 0, .076, .004, rd); reader.rotation.x = -.35;
  pulseRing = new THREE.Mesh(new THREE.RingGeometry(.04, .052, 32), new THREE.MeshBasicMaterial({ color: C.hoja, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  pulseRing.position.set(0, .085, .007); pulseRing.rotation.x = -Math.PI / 2 - .35; rd.add(pulseRing);
  registerInteractive(tablet, {
    id: 'TAB-01', name: 'Tablet de pedidos', zone: 'main', movable: true,
    hint: 'Toca + / − para pedir y luego «Pagar con llavero». El pago se cobra en cacaos.',
    onSelect(p, hit) {
      if (hit && (hit.object === reader || hit.object.parent === rd)) { pagar(); return; }
      const r = hitRects(tabRects, tabScr, hit); if (r) r.fn();
    },
  });
  drawTablet();
}

function drawTablet() {
  if (!tabScr) return;
  const { g, c, tex } = tabScr; const W = c.width, H = c.height; tabRects = [];
  const btn = (x, y, w, h, fn) => tabRects.push({ x, y, w, h, fn });
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H); g.textBaseline = 'middle';
  // encabezado
  g.fillStyle = HEX.panel; g.fillRect(0, 0, W, 62); g.fillStyle = HEX.oro; g.fillRect(0, 60, W, 3);
  g.textAlign = 'left'; g.fillStyle = HEX.crema; g.font = `800 34px ${FD}`; g.fillText('Pide aquí', 22, 32);
  g.fillStyle = HEX.tenue; g.font = `400 20px ${FM}`; g.fillText('TAB-01', 202, 34);
  g.textAlign = 'right';
  if (socio.llavero) { g.fillStyle = HEX.oro; g.font = `600 28px ${FM}`; g.fillText(`Saldo ${socio.saldo} cacaos`, W - 20, 32); }
  else { g.fillStyle = HEX.terracota; g.font = `600 26px ${FM}`; g.fillText('Sin llavero NFC', W - 20, 32); }
  // menú
  MENU.forEach((m, i) => {
    const y = 72 + i * 58, q = cart.get(m.id) || 0;
    if (i % 2 === 0) { g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(8, y, 486, 58); }
    g.textAlign = 'left'; g.fillStyle = q ? HEX.crema : HEX.texto; fit(g, m.nombre, 600, FD, 30, 236); g.fillText(m.nombre, 20, y + 30);
    g.textAlign = 'right'; g.fillStyle = HEX.oro; g.font = `600 30px ${FM}`; g.fillText(String(m.precio), 292, y + 30);
    g.fillStyle = HEX.oro; g.beginPath(); g.ellipse(306, y + 30, 7, 10, .5, 0, Math.PI * 2); g.fill();
    for (const [bx, sign, d] of [[326, '−', -1], [440, '+', 1]]) {
      rr(g, bx, y + 5, 52, 48, 10); g.fillStyle = '#2A211A'; g.fill();
      g.strokeStyle = d > 0 ? HEX.oro : HEX.linea; g.lineWidth = 2; g.stroke();
      g.textAlign = 'center'; g.fillStyle = d > 0 ? HEX.oro : HEX.texto; g.font = `800 36px ${FD}`; g.fillText(sign, bx + 26, y + 30);
      btn(bx, y + 3, 52, 52, () => {
        const n = Math.max(0, Math.min(9, q + d)); if (n === q) { beep('err'); return; }
        if (n) cart.set(m.id, n); else cart.delete(m.id); beep('info'); if (msg && msg.kind !== 'ok') msg = null; drawTablet();
      });
    }
    g.textAlign = 'center'; g.fillStyle = q ? HEX.crema : HEX.tenue; g.font = `800 32px ${FD}`; g.fillText(String(q), 409, y + 30);
  });
  // panel derecho: total, mensaje y comandas
  const px = 506, pw = W - px - 14;
  rr(g, px, 72, pw, 350, 12); g.fillStyle = HEX.panel; g.fill();
  const total = totalCart();
  g.textAlign = 'left'; g.fillStyle = HEX.tenue; g.font = `400 22px ${FM}`; g.fillText('TOTAL', px + 16, 96);
  g.fillStyle = HEX.oro; g.font = `800 72px ${FD}`; g.fillText(String(total), px + 16, 146);
  const tw = g.measureText(String(total)).width; g.fillStyle = HEX.texto; g.font = `600 26px ${FD}`; g.fillText('cacaos', px + 26 + tw, 158);
  g.fillStyle = HEX.linea; g.fillRect(px + 12, 190, pw - 24, 2);
  let y = 214;
  if (msg && msg.until > T) {
    const col = msg.kind === 'ok' ? HEX.hoja : msg.kind === 'err' ? HEX.terracota : HEX.crema;
    g.fillStyle = col; g.fillRect(px + 12, y - 14, 5, 66);
    const words = msg.text.split(' '); const lines = ['']; g.font = `700 26px ${FD}`;
    for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (g.measureText(t).width > pw - 40 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; }
    lines.slice(0, 2).forEach((l, i) => { g.fillStyle = col; fit(g, l, 700, FD, 26, pw - 36); g.fillText(l, px + 26, y + 4 + i * 32); });
    y += 76;
  } else y += 8;
  const mias = comandas.slice(-((422 - y - 34) / 34 | 0)).reverse();
  g.fillStyle = HEX.tenue; g.font = `400 20px ${FM}`; g.fillText(mias.length ? 'TUS COMANDAS' : 'Sin comandas todavía', px + 16, y);
  mias.forEach((c2, i) => {
    const yy = y + 36 + i * 34, e = ESTADO[c2.estado];
    g.textAlign = 'left'; g.fillStyle = HEX.crema; g.font = `600 26px ${FM}`; g.fillText(`#${pad(c2.num)}`, px + 16, yy);
    g.textAlign = 'right'; g.fillStyle = e.col; g.font = `700 26px ${FD}`; g.fillText(e.corto, px + pw - 14, yy);
  });
  // botones inferiores
  g.textAlign = 'center';
  rr(g, 14, 436, 222, 94, 14); g.fillStyle = '#2A211A'; g.fill(); g.strokeStyle = HEX.linea; g.lineWidth = 2; g.stroke();
  g.fillStyle = HEX.texto; g.font = `800 34px ${FD}`; g.fillText('Limpiar', 125, 483);
  btn(14, 436, 222, 94, () => { cart.clear(); msg = null; beep('info'); drawTablet(); });
  rr(g, 250, 436, W - 264, 94, 14); g.fillStyle = paying ? HEX.hoja : total ? HEX.oro : '#3B2F25'; g.fill();
  g.fillStyle = total || paying ? HEX.bg : HEX.tenue;
  const lbl = paying ? 'Acerca tu llavero…' : total ? `Pagar con llavero · ${total}` : 'Pagar con llavero';
  fit(g, lbl, 800, FD, 38, W - 300); g.fillText(lbl, 250 + (W - 264) / 2, 483);
  btn(250, 436, W - 264, 94, pagar);
  g.textAlign = 'left';
  tex.needsUpdate = true;
}

function pulseNFC(done) {
  pulseRing.material.opacity = 1;
  anim(.9, k => {
    const s = 1 + 2.4 * ((k * 2) % 1); pulseRing.scale.setScalar(s); pulseRing.material.opacity = 1 - ((k * 2) % 1);
    readerMat.emissiveIntensity = .5 + 2 * Math.sin(k * Math.PI);
  }, () => { pulseRing.material.opacity = 0; readerMat.emissiveIntensity = .5; done(); });
}

function pagar() {
  if (paying) return;
  const total = totalCart();
  if (!total) { setMsg('Agrega productos primero', 'err', 3); beep('err'); return; }
  paying = true; msg = null; drawTablet(); beep('info');
  const token = ++payToken;
  pulseNFC(() => {
    if (token !== payToken) return;     // la visita se reinició durante el pulso
    paying = false;
    const num = nextNum;
    const r = cargo(total, `Comanda #${pad(num)}`, 'main', 'TAB-01', 'comanda_pagada');
    if (!r.ok) {
      beep('err');
      if (r.motivo === 'sin_llavero') {
        setMsg(MOTIVOS.sin_llavero, 'err', 6);
        say('Necesitas tu llavero NFC para pagar. Pídelo a Lorenzo en el lobby.', 'Barra');
      } else if (r.motivo === 'saldo') {
        setMsg(`${MOTIVOS.saldo}: tienes ${socio.saldo}, el total es ${total}`, 'err', 6);
        say('Saldo insuficiente. Puedes recargar cacaos con Lorenzo en el lobby.', 'Barra');
      } else setMsg(MOTIVOS[r.motivo] || 'No se pudo cobrar', 'err', 6);
      return;
    }
    nextNum++;
    const items = MENU.filter(m => cart.get(m.id)).map(m => ({ id: m.id, nombre: m.nombre, cant: cart.get(m.id) }));
    const c = { num, items, total, estado: 'pendiente', hora: horaHM(), t0: T, tEstado: T };
    comandas.push(c); cart.clear();
    publish('main', 'TAB-01', 'comanda', { num, items: items.map(i => `${i.cant}× ${i.nombre}`), total }, 'ok');
    publish('cocina', 'KDS-01', 'pendiente', { num });
    beep('ok'); setMsg(`Comanda #${pad(num)} enviada a cocina`, 'ok', 6); drawKDS();
  });
}

/* =====================================================================
   KDS-01 — pantalla de comandas del chef
   ===================================================================== */
const KW = 2.2, KH = 1.2375;
let kdsRects = [];
function buildKDS() {
  kds = new THREE.Group(); kds.position.set(5.6, 0, -7.4); kds.rotation.y = -1.88; scene.add(kds);
  box(.6, .04, .45, M.cacaoOsc, 0, .02, 0, kds);
  cyl(.05, .05, 1.1, M.acero, 0, .57, -.06, kds, 12);
  box(KW + .1, KH + .1, .06, M.negro, 0, 1.75, -.035, kds);
  box(KW + .12, .03, .08, M.oro, 0, 1.75 - KH / 2 - .06, -.035, kds);
  kdsScr = makeScreen(KW, KH, 1024); kdsScr.mesh.position.set(0, 1.75, .0005); kds.add(kdsScr.mesh);
  registerInteractive(kds, {
    id: 'KDS-01', name: 'Pantalla de comandas', zone: 'cocina', movable: true,
    hint: 'Toca una tarjeta para avanzarla. Arriba a la derecha: chef automático.',
    onSelect(p, hit) { const r = hitRects(kdsRects, kdsScr, hit); if (r) r.fn(); },
  });
  drawKDS();
}

function drawKDS() {
  if (!kdsScr) return;
  const { g, c, tex } = kdsScr; const W = c.width, H = c.height; kdsRects = [];
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H); g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = HEX.panel; g.fillRect(0, 0, W, 72); g.fillStyle = HEX.oro; g.fillRect(0, 70, W, 3);
  g.fillStyle = HEX.crema; g.font = `800 42px ${FD}`; g.fillText('Comandas', 24, 37);
  g.fillStyle = HEX.tenue; g.font = `400 20px ${FM}`; g.fillText('KDS-01 · cocina', 250, 30);
  g.fillText(new Date().toTimeString().slice(0, 8), 250, 54);
  // interruptor chef automático
  rr(g, 640, 12, 368, 48, 24); g.fillStyle = chefAuto ? HEX.hoja : '#2A211A'; g.fill(); g.strokeStyle = chefAuto ? HEX.hoja : HEX.linea; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.arc(chefAuto ? 984 : 664, 36, 18, 0, Math.PI * 2); g.fillStyle = HEX.crema; g.fill();
  g.textAlign = 'center'; g.fillStyle = chefAuto ? HEX.bg : HEX.texto; g.font = `800 24px ${FD}`;
  g.fillText(`Chef automático: ${chefAuto ? 'SÍ' : 'NO'}`, 824, 37);
  kdsRects.push({ x: 640, y: 8, w: 368, h: 56, fn: () => { chefAuto = !chefAuto; beep('info'); publish('cocina', 'KDS-01', 'chef_auto', { activo: chefAuto }); drawKDS(); } });
  // columnas
  const cols = ['pendiente', 'en_preparacion', 'lista'];
  cols.forEach((st, i) => {
    const x = 16 + i * 336, w = 320, e = ESTADO[st], list = comandas.filter(c2 => c2.estado === st);
    g.textAlign = 'left'; g.fillStyle = e.col; g.fillRect(x, 84, w, 42);
    g.fillStyle = HEX.bg; g.font = `800 28px ${FD}`; g.fillText(e.t, x + 14, 106);
    g.textAlign = 'right'; g.fillText(String(list.length), x + w - 14, 106);
    let y = 136, shown = 0;
    for (const c2 of list) {
      const lines = c2.items.slice(0, 4), h = 62 + lines.length * 28 + (c2.items.length > 4 ? 24 : 0);
      if (y + h > H - 34) break;
      rr(g, x, y, w, h, 10); g.fillStyle = HEX.panel; g.fill(); g.fillStyle = e.col; g.fillRect(x, y + 8, 6, h - 16);
      g.textAlign = 'left'; g.fillStyle = HEX.crema; g.font = `800 36px ${FD}`; g.fillText(`#${pad(c2.num)}`, x + 18, y + 30);
      const el = T - c2.t0;
      g.textAlign = 'right'; g.fillStyle = HEX.tenue; g.font = `400 20px ${FM}`; g.fillText(c2.hora, x + w - 14, y + 20);
      g.fillStyle = st === 'pendiente' && el > 60 ? HEX.terracota : HEX.texto; g.font = `600 24px ${FM}`; g.fillText(mmss(el), x + w - 14, y + 44);
      g.textAlign = 'left'; g.fillStyle = HEX.texto;
      lines.forEach((it, k) => { const t = `${it.cant}× ${it.nombre}`; fit(g, t, 400, FM, 24, w - 36); g.fillText(t, x + 18, y + 72 + k * 28); });
      if (c2.items.length > 4) { g.fillStyle = HEX.tenue; g.font = `400 20px ${FM}`; g.fillText(`+${c2.items.length - 4} más`, x + 18, y + 72 + 4 * 28); }
      kdsRects.push({ x, y, w, h, fn: () => avanzar(c2) });
      y += h + 10; shown++;
    }
    if (shown < list.length) { g.textAlign = 'center'; g.fillStyle = HEX.tenue; g.font = `600 20px ${FM}`; g.fillText(`+${list.length - shown} más`, x + w / 2, H - 46); }
    if (!list.length) { g.textAlign = 'center'; g.fillStyle = HEX.linea; g.font = `600 24px ${FD}`; g.fillText('—', x + w / 2, 170); }
  });
  g.textAlign = 'left'; g.fillStyle = HEX.tenue; g.font = `400 20px ${FM}`;
  g.fillText(`Toca una tarjeta para avanzarla · entregadas: ${comandas.filter(c2 => c2.estado === 'entregada').length}`, 24, H - 18);
  tex.needsUpdate = true;
}

function setEstado(c, estado) {
  c.estado = estado; c.tEstado = T;
  if (estado !== 'entregada') publish('cocina', 'KDS-01', estado, { num: c.num }, estado === 'lista' ? 'ok' : '');
  if (estado === 'lista') spawnTray(c);
  drawKDS(); drawTablet();
}
function avanzar(c) {
  if (c.estado === 'pendiente') { setEstado(c, 'en_preparacion'); beep('info'); }
  else if (c.estado === 'en_preparacion') setEstado(c, 'lista');
  else if (c.estado === 'lista') { toast(`Comanda #${pad(c.num)}: recógela en el pase`); beep('info'); }
}

/* =====================================================================
   COCINA — equipo y chef
   ===================================================================== */
function buildCocina() {
  const inox = mat(0xc4cacc, { m: .6, r: .35 });
  // mesa de trabajo de acero (línea del chef)
  solid(box(.8, .86, 2.0, inox, 8.4, .43, -9.6));
  box(.86, .04, 2.06, M.acero, 8.4, .88, -9.6);
  box(.5, .02, .35, mat(0x8a5a3a), 8.35, .91, -9.4);                       // tabla de picar
  cyl(.16, .1, .1, M.crema, 8.4, .95, -8.9);                                 // bol
  const tomate = mat(0xc0392b, { r: .5 }), cebolla = mat(0xe8dcc6, { r: .6 }), chile = mat(0x3f7a2a, { r: .5 });
  [[8.25, -10.05, tomate], [8.38, -10.1, tomate], [8.3, -10.2, cebolla], [8.5, -10.0, chile]].forEach(([x, z, m]) => mk('veg', () => new THREE.SphereGeometry(.045, 10, 8), m, x, .945, z, scene));
  // estufa con campana, horno y refrigerador junto al muro este
  solid(box(.65, .88, .9, inox, 11.55, .44, -9.4));
  box(.62, .02, .86, M.negro, 11.55, .89, -9.4);
  burnerMat = mat(0x220a05, { e: 0xff4a1a, ei: 0 });
  for (const [dx, dz] of [[-.14, -.2], [-.14, .2], [.14, -.2], [.14, .2]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 8, 24), burnerMat); t.rotation.x = Math.PI / 2; t.position.set(11.55 + dx, .905, -9.4 + dz); scene.add(t);
  }
  cyl(.13, .13, .16, M.acero, 11.45, .99, -9.2); cyl(.11, .1, .1, M.negro, 11.45, .96, -9.65);   // olla y sartén
  box(.8, .45, 1.1, inox, 11.5, 2.35, -9.4);                                 // campana
  solid(box(.65, .9, .8, mat(0x2b2b2b, { m: .5, r: .35 }), 11.55, .45, -8.35));
  ovenMat = mat(0x110805, { e: 0xff8a3a, ei: .15 }); box(.01, .4, .6, ovenMat, 11.22, .4, -8.35);
  box(.04, .03, .5, M.acero, 11.2, .66, -8.35);
  solid(box(.75, 2.0, .85, mat(0xdfe2e2, { m: .5, r: .35 }), 11.5, 1.0, -10.6));
  box(.012, .012, .85, M.negro, 11.12, 1.3, -10.6); box(.04, .6, .03, M.acero, 11.1, 1.65, -10.3); box(.04, .4, .03, M.acero, 11.1, .9, -10.3);
  // tarja y barra de preparación junto al muro sur
  solid(box(5, .9, .65, inox, 6, .45, -11.55));
  box(5.04, .04, .7, M.acero, 6, .92, -11.55);
  box(.6, .05, .45, M.negro, 4.6, .92, -11.55);
  box(4.6, .03, .3, M.acero, 6, 1.75, -11.75);                               // repisa
  for (let i = 0; i < 6; i++) cyl(.11, .09, .14 + (i % 3) * .04, i % 2 ? M.acero : M.barro, 4.2 + i * .75, 1.84, -11.75);
  // repisa del pase (cruza el hueco del muro x 9…11, z -5)
  box(2.0, .05, .9, M.acero, 10, 1.025, -5);
  box(1.8, .06, .25, mat(0x331a10, { e: 0xff7a2a, ei: .8 }), 10, 1.86, -5.25);   // lámpara térmica
  bell = new THREE.Group(); bell.position.set(9.15, 1.05, -4.68); scene.add(bell);           // campanita del pase
  cyl(.04, .045, .012, M.negro, 0, .006, 0, bell, 16);
  const cup = new THREE.Mesh(new THREE.SphereGeometry(.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.oro); cup.position.y = .012; bell.add(cup);
  cyl(.006, .006, .03, M.oro, 0, .065, 0, bell, 8);
  // chef animatrónico
  chef = new THREE.Group(); chef.position.set(9.3, 0, -9.5); chef.rotation.y = -Math.PI / 2; scene.add(chef);
  const blanco = mat(0xf2f0ea, { r: .7 }), piel = mat(0xb07a52, { r: .6 }), pant = mat(0x222222);
  box(.3, .85, .2, pant, 0, .43, 0, chef);
  const torso = cyl(.19, .17, .62, blanco, 0, 1.17, 0, chef, 16);
  const cab = new THREE.Group(); cab.position.set(0, 1.6, 0); chef.add(cab);
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), piel); cab.add(cabeza);
  cyl(.11, .1, .16, blanco, 0, .17, 0, cab, 16); const gorro = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 10), blanco); gorro.position.y = .27; cab.add(gorro);
  box(.06, .015, .01, M.negro, -.045, .02, .115, cab); box(.06, .015, .01, M.negro, .045, .02, .115, cab);
  chef.brazos = [-1, 1].map(s => {
    const h = new THREE.Group(); h.position.set(s * .23, 1.4, 0); chef.add(h);
    box(.08, .45, .08, blanco, 0, -.2, 0, h); const mano = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), piel); mano.position.y = -.45; h.add(mano);
    return h;
  });
  chef.cab = cab; chef.torso = torso;
  chef.updateMatrixWorld(true); addCollider(torso);
}

/* =====================================================================
   PAS-01 — charolas en el pase
   ===================================================================== */
function trayItems(c) {
  const g = new THREE.Group();
  box(.5, .02, .34, M.cacaoOsc, 0, .01, 0, g); const rim = mat(C.oro, { m: .6, r: .3, e: C.oro, ei: .35 }); box(.52, .03, .02, rim, 0, .025, .17, g); box(.52, .03, .02, rim, 0, .025, -.17, g);
  const vidrio = mat(0xd8eef2, { t: true, o: .35, r: .05 });
  const piezas = [];
  for (const it of c.items) for (let k = 0; k < it.cant; k++) piezas.push(it.id);
  const pos = [[-.16, -.08], [0, -.08], [.16, -.08], [-.16, .08], [0, .08], [.16, .08]];
  piezas.slice(0, 6).forEach((id, i) => {
    const [x, z] = pos[i], y = .02;
    if (id === 'agua' || id === 'barra') {
      mk('vaso', () => new THREE.CylinderGeometry(.035, .03, .12, 14), vidrio, x, y + .06, z, g);
      mk('liq', () => new THREE.CylinderGeometry(.03, .027, .08, 14), id === 'agua' ? mat(0x9fd3e6, { t: true, o: .6 }) : mat(0xb8742e, { t: true, o: .85 }), x, y + .045, z, g);
    } else if (id === 'cafe' || id === 'choco') {
      mk('platito', () => new THREE.CylinderGeometry(.06, .05, .01, 18), M.crema, x, y + .005, z, g);
      mk('taza', () => new THREE.CylinderGeometry(.04, .033, .07, 16), id === 'cafe' ? M.crema : M.barro, x, y + .045, z, g);
      mk('bebida', () => new THREE.CylinderGeometry(.036, .036, .005, 16), id === 'cafe' ? mat(0x3a2112) : mat(0x5a2e1a), x, y + .078, z, g);
    } else {
      mk('plato', () => new THREE.CylinderGeometry(.075, .06, .012, 20), M.crema, x, y + .006, z, g);
      if (id === 'quesadilla') {
        const q = mk('ques', () => new THREE.CylinderGeometry(.06, .06, .018, 20, 1, false, 0, Math.PI), mat(0xe2b55a, { r: .7 }), x, y + .022, z, g); q.rotation.y = .4;
      } else for (let t = 0; t < 3; t++) {
        const tc = mk('taco', () => new THREE.CylinderGeometry(.022, .022, .09, 12, 1, true, 0, Math.PI), mat(0xe9d39a, { r: .8, side: THREE.DoubleSide }), x - .035 + t * .035, y + .03, z, g);
        tc.rotation.set(Math.PI / 2, 0, Math.PI);
      }
    }
  });
  return g;
}
function spawnTray(c) {
  const used = new Set(trays.filter(t => !t.done).map(t => t.slot));
  const slot = [1, 0, 2, 3].find(s => !used.has(s)) ?? 3;
  const x = [9.35, 10.0, 10.65, 10.0][slot];
  const g = trayItems(c); g.position.set(x, 1.05 + (slot === 3 ? .1 : 0), -4.8); scene.add(g);
  // etiqueta con el número, visible desde la barra
  const tag = makeScreen(.3, .12, 256); const tg = tag.g, tw = tag.c.width, th = tag.c.height;
  tg.fillStyle = HEX.hoja; tg.fillRect(0, 0, tw, th); tg.fillStyle = HEX.bg; tg.textAlign = 'center'; tg.textBaseline = 'middle';
  tg.font = `800 66px ${FD}`; tg.fillText(`#${pad(c.num)}`, tw / 2, th / 2 + 2); tag.tex.needsUpdate = true;
  tag.mesh.position.set(0, .3, 0); g.add(tag.mesh); cyl(.006, .006, .22, M.acero, 0, .13, -.01, g, 6);
  if (bell) anim(1.2, k => { bell.rotation.z = Math.sin(k * 40) * .5 * (1 - k); }, () => { bell.rotation.z = 0; });
  g.scale.setScalar(.01); anim(.35, k => g.scale.setScalar(.01 + .99 * k));
  const t = { c, g, slot, done: false };
  t.entry = registerInteractive(g, {
    id: 'PAS-01', name: `Comanda #${pad(c.num)} lista`, zone: 'main', radius: .35,
    hint: 'Clic o gatillo: recoger la charola del pase.',
    onSelect() { entregar(t); },
  });
  trays.push(t);
  beep('coin'); after(.3, () => beep('coin'));
  say(`Comanda ${c.num} lista en el pase.`, 'Cocina');
}
function entregar(t) {
  if (t.done || t.c.estado !== 'lista') return;
  t.done = true; removeTargets(t.g);
  setEstado(t.c, 'entregada');
  publish('main', 'PAS-01', 'entregada', { num: t.c.num }, 'ok');
  beep('ok'); toast(`Comanda #${pad(t.c.num)} entregada · ¡provecho!`);
  // la charola viaja del pase a la barra, junto a la tablet
  tablet.updateMatrixWorld(true);
  const to = tablet.localToWorld(new THREE.Vector3(-.62, 0, -.2)), from = t.g.position.clone();
  anim(1.3, k => {
    const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    t.g.position.lerpVectors(from, to, e); t.g.position.y += Math.sin(k * Math.PI) * .45;
    t.g.rotation.y = e * tablet.rotation.y;
  }, () => after(6, () => anim(.5, k => t.g.scale.setScalar(1 - k * .99), () => quitarTray(t))));
}
function quitarTray(t) {
  removeTargets(t.g); scene.remove(t.g);
  const i = trays.indexOf(t); if (i >= 0) trays.splice(i, 1);
}

/* =====================================================================
   bucle, eventos y depuración
   ===================================================================== */
let acc = 0, accDraw = 0;
function update(dt, now) {
  T = now;
  acc += dt; accDraw += dt;
  if (acc >= .25) {
    acc = 0;
    if (chefAuto) for (const c of comandas) {
      if (c.estado === 'pendiente' && T - c.tEstado >= AUTO_PREP) setEstado(c, 'en_preparacion');
      else if (c.estado === 'en_preparacion' && T - c.tEstado >= AUTO_LISTA) setEstado(c, 'lista');
    }
    if (msg && msg.until <= T) { msg = null; drawTablet(); }
  }
  if (accDraw >= 1) { accDraw = 0; drawKDS(); }
  // chef: se mueve mientras hay comandas en preparación
  const prep = comandas.some(c => c.estado === 'en_preparacion');
  const [bi, bd] = chef.brazos;
  if (prep) {
    bi.rotation.x = -1.0 + Math.sin(now * 7) * .35; bd.rotation.x = -1.1 + Math.sin(now * 7 + 2) * .4;
    chef.cab.rotation.x = .25 + Math.sin(now * 2) * .05; chef.cab.rotation.y = Math.sin(now * 1.3) * .25;
    burnerMat.emissiveIntensity = 1.2 + Math.sin(now * 9) * .2; ovenMat.emissiveIntensity = 1.2;
  } else {
    bi.rotation.x *= .9; bd.rotation.x *= .9; chef.cab.rotation.x *= .9; chef.cab.rotation.y = Math.sin(now * .5) * .3;
    burnerMat.emissiveIntensity *= .95; ovenMat.emissiveIntensity = .15;
  }
  chef.torso.rotation.z = prep ? Math.sin(now * 3.5) * .04 : 0;
}

/** Píxeles de pantalla (vista actual) de los botones principales: para pruebas e integración. */
function debugPx() {
  const v = new THREE.Vector3();
  const px = (scr, cx, cy) => {
    scr.mesh.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const w = scr.mesh.geometry.parameters.width, h = scr.mesh.geometry.parameters.height;
    v.set((cx / scr.c.width - .5) * w, (.5 - cy / scr.c.height) * h, 0); scr.mesh.localToWorld(v); v.project(camera);
    return v.z < 1 ? [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)] : null;
  };
  const out = { tablet: {}, kds: {}, charolas: [] };
  MENU.forEach((m, i) => { const y = 72 + i * 58 + 29; out.tablet[m.id + '+'] = px(tabScr, 466, y); out.tablet[m.id + '−'] = px(tabScr, 352, y); });
  out.tablet.limpiar = px(tabScr, 125, 483); out.tablet.pagar = px(tabScr, 509, 483);
  out.kds.chefAuto = px(kdsScr, 824, 36);
  out.kds.tarjetas = kdsRects.slice(1).map(r => px(kdsScr, r.x + r.w / 2, r.y + r.h / 2));
  for (const t of trays) {
    if (t.done) continue; v.copy(t.g.position); v.project(camera);
    out.charolas.push({ num: t.c.num, px: v.z < 1 ? [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)] : null });
  }
  out.comandas = comandas.map(c => ({ num: c.num, estado: c.estado, total: c.total }));
  return out;
}

export function init() {
  buildBarra();
  buildMesas();
  buildTablet();
  buildCocina();
  buildKDS();
  onUpdate(update);
  on('visita:reiniciar', () => {
    for (const t of trays.slice()) quitarTray(t);
    comandas.length = 0; cart.clear(); nextNum = 1; msg = null; paying = false; payToken++;
    drawTablet(); drawKDS();
  });
  on('socio:cambio', () => drawTablet());
  on('fuentes', () => { drawTablet(); drawKDS(); });
  window.__barraCocina = { debugPx };
}

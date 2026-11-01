import { initCore, start } from './core.js';
import * as calle from './calle.js';
import * as lorenzo from './lorenzo.js';
import * as barraCocina from './barra-cocina.js';
import * as dispensario from './dispensario.js';

initCore();
for (const m of [calle, lorenzo, barraCocina, dispensario]) {
  try { m.init(); } catch (e) { console.error('Error al iniciar un módulo de zona', e); }
}
start();

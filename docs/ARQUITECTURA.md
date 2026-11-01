# Arquitectura

Página estática: `index.html` + módulos ES en `js/`. Sin bundler ni dependencias
instaladas; three.js r160 se carga desde jsDelivr.

```
index.html          HUD, estilos y <script type="module" src="js/main.js">
js/main.js          arranque: initCore() → init() de cada zona → start()
js/core.js          motor, punteros, colisiones, voz, monedero, eventos, HUD
js/calle.js         calle, cámara de reconocimiento facial, puerta automática
js/lorenzo.js       Lorenzo el Cacao: rostro, firma del día, monedas, llaveros NFC
js/barra-cocina.js  barra, tablet de pedidos, KDS de cocina, pase
js/dispensario.js   dispensadores con báscula, báscula de turno, gateway IoT
```

## Plano (metros)

`+z` apunta a la calle. El edificio va de z −12 a 12 y de x −12 a 12.

| Zona | x | z | Notas |
|---|---|---|---|
| Calle | −12 … 12 | 12 … 22 | Fachada en z = 12, puerta x −1 … 1 |
| Lobby | −6 … 6 | 4 … 12 | Paso al main en z = 4, x −1.2 … 1.2 |
| Main / barra | −12 … 12 | −5 … 4 | Barra al este, Dirección en el muro oeste |
| Cocina | 0 … 12 | −12 … −5 | Puerta x 4 … 5.5, pase x 9 … 11 |
| Dispensario | −12 … 0 | −12 … −5 | Puerta x −5 … −3 |

`core.js` construye muros, pisos y luces. Cada módulo de zona construye sus
muebles y máquinas.

## Contrato de `core.js`

- **Construcción:** `box`, `cyl`, `mat`, `M` (materiales), `makeScreen` (pantalla de
  lienzo), `fit`, `sign`, `wall`, `canvasTex`.
- **Física simple:** `addFloor` (suelo para teletransporte), `addBlocker` (detiene el
  rayo), `addCollider` (impide caminar; devuelve `{ enabled }` para puertas),
  `solid` (las dos cosas). `addCollider` toma la posición en el momento de
  llamarlo: úsalo después de colocar el grupo.
- **Interacción:** `registerInteractive(root, { id, name, zone, radius, hint,
  movable, onSelect(p, hit), onMove(p, hit), onRelease(p) })`. `hit.uv` sirve para
  pantallas táctiles y para firmar. `movable: true` permite moverlo en modo edición
  y exportar su posición.
- **Ciclo:** `onUpdate(fn(dt, now))`, `anim(dur, fn, done)`, `after(seg, fn)`.
- **Cabeza del jugador:** `headPos()`, `headDir()` (funcionan igual en VR y escritorio).
- **Voz:** `say(texto, quien)` habla en es-MX con Web Speech y muestra subtítulo en
  pantalla y dentro del visor. `beep('ok' | 'err' | 'coin' | 'info')`.
- **Socio:** `socio` (`rostro`, `firmaHoy`, `llavero`, `saldo`, `dispensadoMes`…),
  `updateSocio(patch)`, `cargo(precio, concepto, zona, id, evento)` (exige llavero y
  saldo; devuelve `{ ok, motivo }`), `abono(cacaos, concepto, zona, id, medio)`.
- **Eventos:** `publish(zona, id, evento, payload, tipo)` publica un mensaje MQTT
  simulado `cacaos/<zona>/<id>/<evento>` que aparece en el HUD y en la pantalla de
  Dirección. Bus interno: `on('socio:cambio' | 'visita:reiniciar' | 'fuentes' |
  'teleport', fn)` y `emit`.
- **Configuración:** `CONFIG` (precio del llavero, tipo de cambio peso→cacao, límite
  mensual, segundos de mirada) y `PLANO`.

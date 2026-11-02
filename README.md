# Cacaos Pay VR

Prototipo WebXR (Oculus Rift / Quest) de la casona del Club para probar las
máquinas IoT de [Cacaos Pay](https://github.com/desarrolloiacuentasaccesos-creator/cacaos-pay-presentacion).

Recorrido: **calle** con cámara de reconocimiento facial y puerta automática →
**lobby** con Lorenzo el Cacao (rostro, firma del día, monedas de $10, llavero NFC) →
**barra** con tablet de pedidos → **cocina** con comandas para el chef → **dispensario**.

## Recorrido

1. **Calle.** Mira la cámara de la fachada (CAM-01). Si eres socio, te saluda y abre.
   Si no te conoce, a los 5 s te avisa por voz y abre la puerta automática al lobby.
2. **Lobby.** Lorenzo el Cacao te captura la cara (míralo o haz clic en él), firmas el
   registro del día en su tablet con el lápiz (mantén el gatillo y traza), y le metes
   monedas de $10 en la panza. Con $20 jala la palanca y te da tu llavero NFC; lo que
   sobra se abona en cacaos.
3. **Barra.** En la tablet eliges, pagas con el llavero y la comanda llega a la cocina.
4. **Cocina.** El chef (automático o tocando las tarjetas) la pasa a preparación y a
   lista. Sale una charola en el pase; tócala para recogerla.
5. **Dispensario.** Llavero + turno abierto + límite mensual + báscula de salida.

"Soy socio registrado" salta el registro (rostro y llavero ya listos) y "Reiniciar
visita" vuelve a empezar como desconocido en la calle.

## Controles

| | Rift (Touch) | Escritorio |
|---|---|---|
| Usar / pagar | Gatillo | Clic |
| Firmar | Mantener gatillo sobre la tablet | Arrastrar sobre la tablet |
| Teletransporte | Gatillo al suelo | Clic al suelo |
| Caminar | Stick izquierdo | W A S D |
| Girar | Stick derecho (30°) | Arrastrar |
| Siguiente zona | X / A | 1 – 5 |
| Modo edición | Y / B | E (Q / R giran) |

La voz usa la síntesis del navegador en español de México si está instalada.

## Verlo

WebXR exige HTTPS o `localhost`:

```bash
python -m http.server 8000
```

Abre `http://localhost:8000/` en Chrome o Edge con la app de Oculus como runtime OpenXR
y pulsa **Entrar a VR**. Con GitHub Pages activado en `main` también funciona desde la URL pública.

Arquitectura y contrato entre módulos: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

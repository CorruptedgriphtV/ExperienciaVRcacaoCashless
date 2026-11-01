# Cacaos Pay VR

Prototipo WebXR (Oculus Rift / Quest) de la casona del Club para probar las
máquinas IoT de [Cacaos Pay](https://github.com/desarrolloiacuentasaccesos-creator/cacaos-pay-presentacion).

Recorrido: **calle** con cámara de reconocimiento facial y puerta automática →
**lobby** con Lorenzo el Cacao (rostro, firma del día, monedas de $10, llavero NFC) →
**barra** con tablet de pedidos → **cocina** con comandas para el chef → **dispensario**.

> Estado: en construcción. Calle, núcleo y dispensario listos; Lorenzo y barra + cocina en curso.

## Verlo

WebXR exige HTTPS o `localhost`:

```bash
python -m http.server 8000
```

Abre `http://localhost:8000/` en Chrome o Edge con la app de Oculus como runtime OpenXR
y pulsa **Entrar a VR**. Con GitHub Pages activado en `main` también funciona desde la URL pública.

Arquitectura y contrato entre módulos: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

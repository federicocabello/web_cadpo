# CADPO • Transferencia de físicas de Assetto Corsa

Aplicación de escritorio para modificar un mod receptor conservando su geometría y reemplazando grupos de comportamiento con los datos de otro mod donante.

## Ejecutar

En Windows, abrir `iniciar.bat`. También puede iniciarse con:

```powershell
python main.py
```

Solo utiliza la biblioteca estándar de Python; no requiere instalar paquetes.

## Flujo actual

1. Seleccionar la carpeta `data` del mod receptor. Este aporta la carrocería, las ruedas y la geometría que deben conservarse.
2. Seleccionar la carpeta `data` del mod donante. Este aporta los grupos de físicas elegidos.
3. Elegir los grupos y pulsar **Analizar**.
4. Revisar cada archivo que se reemplazará, agregará, fusionará o conservará.
5. Aplicar los cambios directamente sobre la carpeta `data` receptora.

La aplicación no crea respaldos. Se debe realizar el respaldo manual antes de aplicar los cambios.

## Criterio de seguridad de la primera versión

Se pueden transferir chasis físico, motor, transmisión, frenos, aerodinámica, neumáticos, suspensión, setup, electrónica, IA y daños. Los archivos `.lut`, `.rto` e `.ini` referenciados se detectan y agregan automáticamente. En `tyres.ini` se importa el comportamiento del donante pero se mantienen `RADIUS`, `RIM_RADIUS` y `WIDTH` del receptor.

En `car.ini` se transfieren masa, inercias, FFB, dirección, combustible, posición del tanque, reglas y tiempos de boxes. Se conservan del receptor `INFO`, `GRAPHICS`, `GRAPHICS_OFFSET`, `GRAPHICS_PITCH_ROTATION` y `RIDE`, para no mover el modelo, las cámaras ni las referencias visuales. En `STEER_RATIO` y `LINEAR_STEER_ROD_RATIO` se usa la magnitud del donante pero se conserva el signo del receptor, porque ese signo depende de la orientación de su geometría de dirección.

En `suspensions.ini` se transfieren los resortes, amortiguadores, barras estabilizadoras, topes, recorrido y masa de maza compatibles. Se mantienen del receptor `WHEELBASE`, `CG_LOCATION`, trochas, alturas base, offsets, tipos y todos los puntos geométricos. `setup.ini` se reemplaza desde el donante junto con las dependencias que referencia.

Por ahora se conservan siempre desde el receptor:

- `car.ini`
- `suspension_graphics.ini`
- `colliders.ini`
- `lods.ini`, cámaras, piloto, luces, espejos y escapes
- `setup.ini`

Estos archivos mezclan comportamiento con dimensiones o referencias a objetos 3D y por eso se mantienen desde el receptor.

## Advertencias

- Trabajar con carpetas `data` ya descomprimidas.
- Hacer el respaldo manual antes de aplicar y probar cada cambio por separado.
- Algunos mods cifrados pueden vincular sus datos con el KN5 y romperse al modificarlos.
- Si existe `data.acd`, verificar con Content Manager qué fuente de datos está usando el auto antes de probar.

# CADPO LAB · Editor de setup de Assetto Corsa

Aplicación de escritorio para cargar la carpeta `data` de un mod y administrar todas las secciones de `setup.ini`.

## Ejecutar

Abrir `iniciar.bat` o ejecutar:

```powershell
python main.py
```

No requiere paquetes externos; utiliza Python y Tkinter.

## Funciones

- Abre maximizada y busca por defecto los autos en `W:\Steam\steamapps\common\assettocorsa\content\cars`.
- Detecta todas las secciones existentes sin depender de una lista fija de nombres.
- Agrupa visualmente los controles por `TAB` (aerodinámica, suspensión, neumáticos, frenos, etc.).
- Permite editar `MIN`, `MAX`, `STEP`, `NAME`, `SHOW_CLICKS`, posiciones, ayuda y referencias `.rto`/`.lut`.
- Lee el valor predeterminado real desde el archivo físico asociado y permite modificarlo de forma coordinada.
- Detecta controles físicos que todavía no están publicados en `setup.ini` y permite habilitarlos. Por ejemplo, un `WING_n` trasero existente en `aero.ini`.
- Incluye un editor visual **Diseño de pestañas** que representa la distribución del juego: `POS_X=0` izquierda, `0.5` centro y `1` derecha; `POS_Y` determina la fila.
- Al cargar una carpeta `data`, el editor visual se abre automáticamente como pantalla principal de trabajo y permite guardar `setup.ini` desde la misma vista.
- Permite arrastrar controles, moverlos con botones, cambiar su pestaña `TAB`, crear una pestaña nueva y detectar posiciones superpuestas.
- Permite crear, renombrar y eliminar pestañas completas. Al eliminar una, solicita a qué pestaña deben trasladarse sus controles.
- Conserva el orden de primera aparición de las pestañas en `setup.ini`, en lugar de ordenarlas alfabéticamente.
- Puede ordenar automáticamente una pestaña completa en tres columnas sin superposiciones.
- Permite editar cualquier otra clave particular del mod.
- Valida rangos y calcula cuántas posiciones tendrá el selector.
- Detecta archivos relacionados y avisa si falta alguno.
- Permite agregar y eliminar secciones.
- Guarda directamente `setup.ini`, preservando comentarios y usando `CLAVE=VALOR` sin espacios alrededor de `=`.

## Módulos y efectos

El botón **Módulos y efectos** inspecciona y permite editar los sistemas adicionales del vehículo:

- Turbo y controladores de boost.
- Mapas de motor.
- ABS, control de tracción y diferencial electrónico EDL.
- DRS electrónico y aerodinámico.
- ERS/KERS y sus controladores.
- AWD, dirección en las cuatro ruedas y reparto electrónico de frenada.
- Temperatura avanzada de frenos y consumo avanzado.
- Controladores aerodinámicos, daños, llamas y backfire.
- Detección de push-to-pass, launch control, nitro/overboost y scripts de física CSP personalizados.

Los módulos estándar se pueden habilitar o deshabilitar sin perder sus parámetros. Los sistemas implementados dentro de scripts personalizados se identifican y se pueden inspeccionar, pero no se apagan automáticamente porque un mismo script puede controlar varias funciones del auto.

## Importante

La aplicación no crea respaldos. `setup.ini` define qué puede modificar el piloto, mientras que el valor predeterminado físico suele estar en el archivo asociado (`suspensions.ini`, `tyres.ini`, `aero.ini`, `drivetrain.ini`, etc.). El editor mantiene separados ambos conceptos y muestra el archivo y la clave donde se guardará cada valor inicial reconocido.

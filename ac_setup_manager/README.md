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
- Agrupa y filtra por `TAB`.
- Permite editar `MIN`, `MAX`, `STEP`, `NAME`, `SHOW_CLICKS`, posiciones, ayuda y referencias `.rto`/`.lut`.
- Permite editar cualquier otra clave particular del mod.
- Valida rangos y calcula cuántas posiciones tendrá el selector.
- Detecta archivos relacionados y avisa si falta alguno.
- Permite agregar y eliminar secciones.
- Guarda directamente `setup.ini`, preservando comentarios y usando `CLAVE=VALOR` sin espacios alrededor de `=`.

## Importante

La aplicación no crea respaldos. `setup.ini` define qué puede modificar el piloto, pero el valor predeterminado físico suele estar en el archivo asociado (`suspensions.ini`, `tyres.ini`, `aero.ini`, `drivetrain.ini`, etc.). Esta primera versión edita la exposición y los límites del setup; una siguiente etapa puede vincular cada sección con su valor físico de origen.

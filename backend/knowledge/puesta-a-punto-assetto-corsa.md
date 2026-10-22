# Puesta a punto de autos de competición y Assetto Corsa

En CADPO, los términos "setup" y "puesta a punto" se usan como sinónimos. Cuando una consulta menciona el setup de un auto, se refiere a la configuración mecánica y dinámica del vehículo, salvo que se indique expresamente otro significado.

Este contenido es una referencia interna para que Ayrton elabore respuestas; no es un artículo, manual o archivo publicado para los usuarios. Ayrton debe responder directamente y nunca decir que CADPO subió este contenido ni indicar que el usuario debe leerlo, abrirlo o descargarlo.

Se aplica principalmente a simulación y Assetto Corsa. Una puesta a punto nunca es universal: depende del auto, tipo de tracción, neumático, circuito, temperatura, combustible y conducción. No dar números exactos sin esos datos. Partir del setup base, calentar neumáticos, cambiar una sola variable por vez y comparar varias vueltas limpias.

## Alcance en campeonatos CADPO

En la mayoría de los mods oficiales utilizados en campeonatos CADPO la puesta a punto es fija. Normalmente solo se permite modificar:

- Presión de freno.
- Reparto o distribución de frenada.
- Relaciones de la caja de cambios.

Generalmente no se liberan más ajustes. Si la pregunta se refiere a un campeonato concreto, consultar primero su `setup_detalle` y no recomendar suspensión, camber, amortiguadores, diferencial, neumáticos o aerodinámica salvo que la configuración oficial indique expresamente que esos controles están habilitados. El resto de esta referencia solo debe aplicarse a consultas generales o a autos que efectivamente permitan esos ajustes.

## Método de diagnóstico

Antes de recomendar un cambio, identificar:

1. Fase: frenada, entrada, centro o salida de curva; piano/bache o recta.
2. Eje que pierde agarre: delantero = subviraje; trasero = sobreviraje.
3. Acción del piloto: soltando freno, velocidad constante o acelerando.
4. Condición: neumáticos fríos/calientes, combustible y tipo de curva.

Prioridad aconsejada: presiones y temperaturas; alineación; balance de freno y diferencial; barras y resortes; alturas y aerodinámica; amortiguadores; relaciones. Hacer cambios pequeños y reversibles. Si el problema aparece solo en un piano o bache, revisar primero fast bump/rebound, altura y topes; si aparece en una transferencia sostenida, revisar slow bump/rebound, resortes y barras.

## Neumáticos y presión

- La presión correcta es la presión estabilizada en caliente prevista para ese neumático, no un valor universal. Consultar el objetivo del mod o fabricante.
- Muy baja: carcasa flexible, respuesta lenta, más temperatura y desgaste en hombros, posible inestabilidad.
- Muy alta: menor huella, auto nervioso, tendencia a deslizar y calentamiento central.
- Comparar neumáticos después de varias vueltas representativas, con el mismo combustible y ritmo.
- Leer O/M/I: exterior, centro e interior. El reparto térmico ayuda a evaluar presión, camber y toe, pero una lectura en boxes no representa exactamente la carga de plena curva.
- No trasladar objetivos de PSI o temperatura de ACC a Assetto Corsa original ni entre mods: cada modelo de neumático puede tener otra ventana.

## Camber o caída

Camber negativo significa que la parte superior de la rueda se inclina hacia el auto. Ayuda a mantener la huella del neumático exterior durante la curva. Demasiado camber negativo reduce apoyo en recta y frenada, calienta excesivamente el borde interior y puede empeorar tracción y desgaste. Muy poco camber sobrecarga/calienta el exterior en curva.

Ajustar buscando agarre y temperatura razonablemente repartida en el neumático cargado, no solo tres temperaturas idénticas en boxes. En ACC, las notas oficiales de física remarcan que camber y toe cambian mucho la distribución térmica y desaconsejan diferencias extremas entre interior y exterior; eso es una referencia conceptual, no un objetivo numérico para todos los mods de AC.

## Toe o convergencia

- Toe-out delantero suele mejorar respuesta inicial y giro, a cambio de estabilidad, resistencia y temperatura/desgaste.
- Toe-in delantero suele estabilizar, pero puede quitar agilidad.
- Toe-in trasero suele dar estabilidad y tracción; demasiado genera arrastre y puede quitar rotación.
- Toe-out trasero vuelve al auto más rotador e inestable y debe usarse con cautela.

Los signos del valor cambian entre simuladores o mods. Hablar de convergencia/divergencia, no asumir que positivo o negativo significa siempre lo mismo.

## Caster o avance

Más caster suele aumentar autocentrado, peso de dirección y camber dinámico al girar. Puede mejorar apoyo delantero y estabilidad, pero demasiado puede volver pesada la dirección, elevar temperaturas o hacer agresivas las transferencias. En Assetto Corsa no todos los autos lo exponen en el setup.

## Resortes, wheel rate y altura

- Resortes más duros: menos movimiento y respuesta más directa, pero peor absorción y agarre mecánico en piso irregular.
- Resortes más blandos: más cumplimiento y tracción, pero más cabeceo/rolido y riesgo de tocar fondo.
- Endurecer relativamente el eje delantero suele llevar el balance hacia subviraje; endurecer relativamente el trasero suele favorecer rotación/sobreviraje. El resultado depende de geometría y aerodinámica.
- Bajar la altura reduce centro de gravedad y puede mejorar aero, pero aumenta golpes de fondo y uso de topes. Subirla da recorrido y tolerancia a pianos, con posible pérdida aero.
- El rake es la diferencia de altura entre ejes. En autos con piso aerodinámico cambia el balance y la carga; no ajustarlo sin revisar si el auto hace fondo a velocidad.

## Barras estabilizadoras

Controlan principalmente la distribución de rigidez al rolido entre ejes:

- Barra delantera más dura: normalmente menos agarre relativo delantero y más subviraje en apoyo; respuesta inicial más directa.
- Barra delantera más blanda: normalmente más agarre delantero, más rolido.
- Barra trasera más dura: normalmente más rotación y posible sobreviraje.
- Barra trasera más blanda: normalmente más tracción/estabilidad trasera.

En curvas con pianos o una sola rueda cargada, una barra muy dura puede hacer perder contacto al neumático interior.

## Amortiguadores: bump y rebound

Bump o compresión controla el movimiento cuando el amortiguador se acorta. Rebound o rebote/extensión controla el retorno cuando se alarga.

Slow y fast describen la velocidad del vástago del amortiguador, no la velocidad del auto:

- Slow bump/rebound: transferencias de carrocería por frenar, girar y acelerar. Influyen en respuesta transitoria y balance.
- Fast bump/rebound: impactos rápidos de pianos, baches y superficie irregular.

Más damping no significa automáticamente más agarre. Demasiada compresión impide absorber y puede hacer patinar/saltar el neumático. Demasiado rebound impide que la rueda vuelva a seguir el piso, puede producir "pack-down" en baches sucesivos y quitar tracción. Muy poco damping deja oscilaciones y respuesta imprecisa.

Guía de síntomas:

- Golpea o rebota al subir pianos: ablandar fast bump del eje afectado; si vuelve violentamente, suavizar fast rebound. Revisar también altura/topes.
- Oscila varias veces después de un bache: aumentar damping gradualmente, normalmente rebound.
- Pierde tracción en baches repetidos: puede haber rebound excesivo.
- Transferencia muy brusca al frenar/girar/acelerar: revisar slow bump/rebound, no fast.

No usar amortiguadores para ocultar un resorte, barra o altura claramente incorrectos. En Assetto Corsa los clics o números pueden representar fuerza o posición de ajuste de distinta manera según el mod; confirmar la etiqueta y probar la dirección del cambio.

## Frenos

- Más reparto delantero: mayor estabilidad, pero demasiado bloquea/activa ABS delantero y genera subviraje de entrada.
- Más reparto trasero: ayuda a rotar en entrada, pero demasiado vuelve inestable y puede bloquear atrás.
- Si bloquea un eje, mover el reparto alejándolo de ese eje en pasos pequeños.
- Presión de freno regula la fuerza máxima. Bajarla puede evitar bloqueo si el pedal no se puede modular, pero no corrige un reparto equivocado.
- Conductos más abiertos enfrían mejor con costo aerodinámico; cerrados calientan más y reducen drag. Mantener discos/pastillas en su ventana si el mod simula temperatura.
- Con ABS, un valor más intrusivo da seguridad pero puede alargar la frenada; uno menos intrusivo exige mejor modulación.

## Diferencial

- Power regula bloqueo acelerando. Más bloqueo puede dar tracción simétrica pero suele resistir el giro y provocar subviraje o sobreviraje de potencia según auto/tracción. Menos bloqueo facilita rotación, pero puede patinar la rueda interior.
- Coast regula bloqueo al soltar/frenar. Más bloqueo suele estabilizar el eje motriz en entrada; menos permite más rotación, con riesgo de inestabilidad.
- Preload actúa alrededor de la transición sin carga. Más precarga suaviza/estabiliza la transición pero puede quitar rotación; menos vuelve el auto más libre y reactivo.

## Aerodinámica

Más ala genera más carga y estabilidad a alta velocidad con menor velocidad final. Más ala trasera estabiliza el eje trasero y normalmente aumenta subviraje de alta. Más carga delantera mejora giro de alta, pero puede volver inestable la parte trasera si el balance queda adelantado. La altura, rake y hacer fondo pueden cambiar o perder carga abruptamente.

## Relaciones de caja

Acortar relaciones mejora aceleración pero aumenta cambios y puede alcanzar el limitador. Alargarlas mejora margen de velocidad final pero reduce aceleración. Elegir la relación final para que la marcha más alta se acerque al régimen útil al final de la recta principal, con margen para rebufo. Mantener el motor en su zona de potencia al caer de RPM entre marchas.

## Diagnóstico rápido por fase

- Subviraje en entrada: revisar frenada demasiado adelantada, coast/preload alto, frente rígido o toe; cambiar una cosa por vez.
- Sobreviraje en entrada: mover freno adelante, dar estabilidad trasera con toe-in, barra trasera más blanda o más coast, según causa.
- Subviraje en centro: revisar presión/camber delantero, balance de barras/resortes y carga aero.
- Sobreviraje en centro: revisar neumático trasero, ablandar barra trasera o aumentar apoyo aero trasero.
- Subviraje al acelerar: revisar diferencial power, rigidez delantera/trasera y técnica de acelerador.
- Sobreviraje al acelerar: revisar presiones traseras, power, barra/resorte trasero, control de tracción y entrega de potencia.

## Particularidades de Assetto Corsa

No todos los autos o mods habilitan los mismos ajustes. Ayrton debe decir "si el auto lo permite" antes de recomendar un control que quizá no esté disponible. Los nombres habituales incluyen presiones, CAMBER, TOE, SPRING o WHEEL RATE, ARB, HEIGHT, BUMP, REBOUND, FAST BUMP, FAST REBOUND, BRAKE BIAS, DIFFERENTIAL, WING y GEAR RATIO. No inventar unidades ni sentido de incremento: algunos mods tienen etiquetas o escalas propias.

Assetto Corsa y Assetto Corsa Competizione no comparten necesariamente el mismo modelo ni la misma ventana de neumáticos. Los valores de ACC sirven solo si la pregunta trata de ACC; para AC original, usar telemetría, app de neumáticos y documentación del mod.

## Forma de responder

Responder breve y práctico: explicar causa probable, proponer entre uno y tres cambios en orden, indicar el efecto secundario y pedir datos solo si son imprescindibles (auto, tracción, circuito, fase de curva y temperaturas/presiones). No prometer que un cambio siempre bajará el tiempo. Para autos reales, aclarar que es orientación conceptual de competición y que prevalecen fabricante e ingeniero; no dar valores peligrosos de presión, montaje o seguridad.

## Fuentes técnicas internas

Estas fuentes se utilizaron para elaborar el conocimiento interno. No presentarlas como artículos o archivos subidos a CADPO ni remitir al usuario a ellas, salvo que solicite expresamente fuentes externas.

- Kunos Simulazioni / Assetto Corsa Competizione, notas oficiales de física v1.9: https://assettocorsa.gg/wp-content/uploads/ACCv19-physics_notes.pdf
- Öhlins Racing, manual TPX/TTX44 sobre compresión, rebote y ajustes de baja/alta velocidad: https://ohlins.com/storage/2A8B753854E036FD880C1FB3E4C6D8199C69ED0EF83D810B95D2C760D50A820A/3b2ca8fc14d34827b61f1148cc714ddf/pdf/media/8d8df7ceb5224d9db91ae83c153c2cc8/OM_07440-02_TPX_TTX44.pdf
- Hoosier Racing Tire, guías oficiales de presión, temperatura y camber para circuito: https://www.hoosiertire.com/tires/circuit-racing
- Brembo Racing, catálogo técnico sobre balance y temperatura de frenos: https://www.brembo.com/cz/Varie/2015-16%20BREMBO%20RACING%20CATALOGUE%20%28595%29.pdf

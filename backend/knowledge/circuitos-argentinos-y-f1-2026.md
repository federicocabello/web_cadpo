# Circuitos argentinos de CADPO y calendario actual de Fórmula 1

Documento de referencia para Ayrton. Actualizado el 18 de octubre de 2026.

## Cómo interpretar esta información

- El catálogo `requestedSections.circuits` de MySQL es la fuente para afirmar qué circuito, variante, categoría y temporada utilizó CADPO. Que un autódromo exista en la tabla `circuitos` no prueba por sí solo que CADPO haya corrido allí: para eso debe existir una fecha en `usos_cadpo`.
- El estado real de un escenario puede cambiar por obras, habilitaciones o calendarios. Usar las expresiones **activo nacional en 2026**, **reactivado**, **histórico/inactivo** o **estado actual no confirmado**, según corresponda. No llamar abandonado a un circuito sin una fuente explícita.
- Distinguir siempre el autódromo de su variante. Gálvez 5, 8, 9 y 12; Cabalén perimetral; Termas perimetral; Toay 2; Rosario 2 y cualquier variante corta son trazados diferentes aunque compartan predio.
- Una pista disponible como mod de Assetto Corsa no implica que el escenario real esté activo, homologado o abierto al público.
- La tabla `circuitos` de CADPO no posee actualmente un campo de superficie. No inferir asfalto o tierra por el nombre: usar únicamente las superficies expresamente documentadas aquí.

## Escenarios argentinos registrados en CADPO

### Buenos Aires y CABA

- **Oscar y Juan Gálvez, Buenos Aires:** circuito histórico y activo, con variantes 5, 8, 9 y 12 registradas. Fue sede del Gran Premio de Argentina de Fórmula 1 en distintos trazados; la última edición fue en 1998. No integra el calendario de F1 2026.
- **Roberto Mouras, La Plata:** activo y de uso nacional frecuente; CADPO también registra variante corta.
- **Juan María Traverso, San Nicolás:** activo nacional en 2026.
- **Juan Manuel Fangio, Balcarce:** escenario serrano histórico. Volvió a la actividad nacional en septiembre de 2026 después de 15 años de inactividad y obras de recuperación; por eso debe describirse como **reactivado**, no abandonado.
- **Ciudad de 9 de Julio:** activo en competencias regionales/nacionales según calendario; CADPO registra dibujo principal y corto.
- **Eusebio Marcilla, Junín; Hermanos Emiliozzi, Olavarría; Ciudad de Dolores:** circuitos reales registrados por CADPO, con actividad que puede ser regional o intermitente. Confirmar calendario vigente antes de afirmar una fecha actual.
- **Ezequiel Crisol, Bahía Blanca:** CADPO conserva trazado normal e histórico. Diferenciar la representación histórica del estado del predio moderno y no presentarlo automáticamente como sede nacional vigente.
- **Ciudad de Mar del Plata:** referencia histórica de CADPO; su presencia como mod no acredita actividad real actual. Tratar como histórico/estado actual no confirmado.
- **Kartódromo Internacional de Buenos Aires y Kartódromo Internacional de Zárate:** kartódromos, no confundir con autódromos de autos de turismo.

### Centro y Litoral

- **Oscar Cabalén, Alta Gracia:** activo nacional en 2026; CADPO registra trazado principal y perimetral.
- **Parque Ciudad de Río Cuarto:** activo nacional en 2026.
- **Juan Oria, Marcos Juárez:** actividad principalmente regional; confirmar el calendario vigente.
- **Ciudad de Paraná:** activo nacional en 2026.
- **Ciudad de Concordia:** activo nacional en 2026.
- **Concepción del Uruguay:** activo nacional en 2026.
- **Ciudad de Rafaela:** activo nacional en 2026; óvalo de altísima velocidad con variantes, incluida corta en CADPO. No describir el óvalo como abandonado por tener uso menos frecuente.
- **Municipal/Juan Manuel Fangio de Rosario:** activo nacional en 2026 y con obras de infraestructura en curso; CADPO registra dos variantes.
- **Parque de la Velocidad, San Jorge:** escenario real de larga tradición, con uso nacional menos frecuente que en otras épocas; confirmar actividad vigente.
- **Callejero de Santa Fe:** trazado urbano histórico/no permanente. No existe como autódromo permanente y su mod representa las ediciones callejeras.

### Cuyo, norte y región mediterránea

- **San Juan Villicum, Albardón:** activo nacional en 2026, instalación moderna.
- **Eduardo Copello/El Zonda:** trazado histórico de montaña. Su actividad nacional ha sido intermitente; confirmar habilitación y calendario antes de llamarlo activo en la temporada actual.
- **Jorge Ángel Pena, San Martín de Mendoza:** activo nacional en 2026.
- **Ciudad de San Rafael:** circuito real con uso regional/intermitente; CADPO registra variante corta.
- **Rosendo Hernández, San Luis:** activo nacional en 2026; CADPO también registra variante corta.
- **José Carlos Bassi/La Pedrera, Villa Mercedes:** circuito semipermanente real; no asumir una fecha actual sin calendario oficial.
- **Martín Miguel de Güemes, Salta; Ciudad de La Rioja; Santiago Yaco Guarnieri, Resistencia:** escenarios reales con actividad regional o intermitente. Confirmar la temporada vigente.

### Mesopotamia y nordeste

- **Rosamonte, Posadas:** activo nacional en 2026.
- **Ciudad de Oberá:** activo nacional en 2026.

### Patagonia

- **Enrique Quique Freile, El Calafate:** activo nacional en 2026.
- **Ciudad de Viedma:** activo nacional en 2026.
- **Parque Provincia del Neuquén, Centenario:** activo nacional en 2026.
- **Provincia de La Pampa, Toay:** activo nacional en 2026; CADPO registra más de una variante.
- **Mar y Valle, Trelew; General San Martín, Comodoro Rivadavia; José Muñiz, Río Gallegos:** escenarios reales de fuerte tradición patagónica. Su actividad puede ser nacional o regional según el año; consultar el calendario vigente.

## Circuitos zonales y escenarios pequeños

CADPO no se limita a los autódromos nacionales. El historial de MySQL confirma carreras en trazados cortos, escenarios regionales y kartódromos. Para decir que CADPO corrió en uno, exigir `fechas_disputadas_cadpo` mayor que cero.

### Asfalto utilizado por CADPO

- **Eusebio Marcilla de Junín, 9 de Julio y su variante corta, Balcarce corto, Roberto Mouras corto, Dolores, Juan Oria de Marcos Juárez, San Rafael, Ciudad de La Rioja, Martín Miguel de Güemes de Salta, Santiago Yaco Guarnieri de Resistencia, Ezequiel Crisol histórico y Ciudad de Mar del Plata** aparecen en fechas de categorías zonales, Fórmula 3CV, TN u otras clases de CADPO.
- **Rosendo Hernández corto, Rafaela corto, Parque de la Velocidad de San Jorge y Concepción del Uruguay** fueron usados por Zonal Clase 2 o Zonal Clase 3, además de otras categorías según cada circuito.
- **Kartódromo Internacional de Buenos Aires y Kartódromo Internacional de Zárate** fueron utilizados por Karting 100 CC. Son circuitos asfaltados de karting y no deben presentarse como autódromos de turismos.
- Los trazados cortos y variantes deben contarse por separado: haber usado la variante corta no demuestra que CADPO haya usado el circuito largo en esa temporada.

### Tierra y óvalos zonales argentinos

- El automovilismo zonal argentino incluye campeonatos sobre tierra compactada, entre ellos Turismo Zonal Tierra, velocidad en óvalo y numerosos certámenes de karting en tierra. La superficie cambia frenado, agarre, puesta a punto y evolución de pista; no trasladar automáticamente referencias de asfalto.
- En 2026 existen calendarios oficiales de tierra fiscalizados por federaciones regionales. Entre los escenarios documentados aparecen **San Andrés de Giles** para velocidad en óvalo; **Isla Verde, Bell Ville, Villa Nueva, Arias, Buchardo y Laboulaye** en el entorno cordobés; también hay actividad zonal en otros escenarios que debe confirmarse con su federación.
- Estos nombres forman parte del contexto real argentino, pero **no afirmar que CADPO ya corrió allí** mientras no aparezcan vinculados a una fecha en `requestedSections.circuits`.
- Si CADPO agrega en el futuro un mod de tierra, la fecha de calendario confirma que se usará; un proyecto activo solo confirma que está en desarrollo.

### Cómo hablar de usos futuros

- `fechas_programadas_cadpo > 0` y `proxima_fecha_cadpo` confirman una carrera futura ya cargada.
- Un elemento activo en `requestedSections.projects` confirma un circuito en desarrollo, pero no una fecha ni una categoría asignada.
- Un circuito simplemente cargado con cero fechas no es pasado ni futuro confirmado: describirlo como disponible en el catálogo.
- Los ejemplos futuros no se fijan en este documento porque cambian con el calendario. Consultar siempre los campos dinámicos de MySQL.

## Referencia de actividad nacional 2026

Los calendarios oficiales 2026 de ACTC y TN/APAT confirman actividad nacional, entre otros, en El Calafate, Viedma, Centenario, Concepción del Uruguay, Termas de Río Hondo, Alta Gracia, Rafaela, Posadas, Villicum, Paraná, San Luis, San Nicolás y Rosario. Balcarce fue reabierto en septiembre de 2026. Esta lista sirve para estado real; el historial propio de CADPO siempre surge de `requestedSections.circuits`.

## Calendario vigente de Fórmula 1 2026

El calendario FIA fue enmendado el 26 de marzo de 2026 tras las bajas de Bahréin y Arabia Saudita. Luego se incorporó una fecha extraordinaria en Sepang: el Gran Premio de Bahréin en Malasia. El calendario oficial vigente de Formula 1 quedó en **23 Grandes Premios**. Usar esta versión actual, no el anuncio original de 24 fechas publicado en 2025. Argentina no integra el calendario.

1. Australia, Melbourne: 6 al 8 de marzo.
2. China, Shanghái: 13 al 15 de marzo.
3. Japón, Suzuka: 27 al 29 de marzo.
4. Miami, Estados Unidos: 1 al 3 de mayo.
5. Canadá, Montreal: 22 al 24 de mayo.
6. Mónaco, Montecarlo: 5 al 7 de junio.
7. España, Barcelona-Catalunya: 12 al 14 de junio.
8. Austria, Spielberg/Red Bull Ring: 26 al 28 de junio.
9. Gran Bretaña, Silverstone: 3 al 5 de julio.
10. Bélgica, Spa-Francorchamps: 17 al 19 de julio.
11. Hungría, Hungaroring/Budapest: 24 al 26 de julio.
12. Países Bajos, Zandvoort: 21 al 23 de agosto.
13. Italia, Monza: 4 al 6 de septiembre.
14. España, Madrid: 11 al 13 de septiembre, sujeto a homologación FIA en la publicación oficial.
15. Azerbaiyán, Bakú: 24 al 26 de septiembre; la carrera fue programada para el sábado 26.
16. Gran Premio de Bahréin en Malasia, Sepang: 2 al 4 de octubre.
17. Singapur, Marina Bay: 9 al 11 de octubre.
18. Estados Unidos, Austin/Circuit of the Americas: 23 al 25 de octubre.
19. México, Ciudad de México/Hermanos Rodríguez: 30 de octubre al 1 de noviembre.
20. Brasil, São Paulo/Interlagos: 6 al 8 de noviembre.
21. Estados Unidos, Las Vegas: 19 al 21 de noviembre.
22. Qatar, Lusail: 27 al 29 de noviembre.
23. Emiratos Árabes Unidos, Abu Dhabi/Yas Marina: 4 al 6 de diciembre.

Para responder por la próxima carrera o por resultados actuales, usar la fecha actual y este orden oficial; no inventar resultados en vivo.

## Argentina y la Fórmula 1

- El Gran Premio de Argentina se disputó históricamente en Buenos Aires, en el Autódromo Oscar y Juan Gálvez y sus diferentes configuraciones.
- La última carrera puntuable de Fórmula 1 en Argentina fue en 1998.
- En 2026 no hay Gran Premio de Argentina. No interpretar que tener Gálvez, Interlagos, Spa, Barcelona o Red Bull Ring cargados en CADPO significa que forman parte de un campeonato actual de la comunidad.

## Reglas de respuesta para Ayrton

- Ante “¿dónde corrió CADPO?” o “¿qué categorías corrieron en este circuito?”, responder con `usos_cadpo`; si está vacío, decir que el circuito está cargado pero no hay una fecha vinculada en el historial consultado.
- Ante “¿dónde correrá CADPO?”, responder solo con fechas_programadas_cadpo y proxima_fecha_cadpo. Si solo existe un proyecto, decir “en desarrollo”, no “próxima carrera”.
- Cuando pregunten por zonales, incluir trazados pequeños y distinguir asfalto, tierra, óvalo y karting. Si la superficie no está expresamente indicada, decir que CADPO no la tiene registrada.
- Ante “¿está activo/abandonado?”, usar esta ficha y aclarar el año de referencia. Si figura como intermitente o no confirmado, no convertir incertidumbre en una afirmación.
- Ante una consulta de la próxima fecha CADPO, manda `championshipCalendars`, no este documento.
- Ante una consulta del calendario de Fórmula 1, aclarar que se trata de la temporada real FIA 2026 y no de CADPO.
- No inventar longitudes, récords, sentido de giro, cantidad de curvas ni homologaciones si no aparecen en los datos entregados.

## Fuentes editoriales

- FIA, calendario deportivo 2026 aprobado y enmendado por el World Motor Sport Council.
- Formula 1, calendario oficial de carreras 2026.
- ACTC, calendarios y catálogo de autódromos 2026.
- TN/APAT, calendario deportivo 2026.
- Municipios y organismos públicos responsables de cada escenario para obras y habilitaciones.
- Federación Regional de Automovilismo Deportivo de Córdoba, calendarios 2026 de karting en asfalto y tierra.
- Federación Metropolitana de Automovilismo Deportivo, reglamentos 2026 de Turismo Zonal Tierra.
- Federación de Deporte Motor, calendario y reglamento de velocidad en óvalo de tierra.

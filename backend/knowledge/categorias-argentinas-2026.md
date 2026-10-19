# Categorías argentinas de automovilismo: contexto 2026

Documento de referencia de Ayrton, revisado el 18/10/2026. Distinguir siempre entre:

1. **Categoría real en 2026:** datos del reglamento o sitio oficial vigente.
2. **Categoría o mod de CADPO:** autos que devuelve `categoryCars` desde MySQL para esa temporada virtual.

No asumir que el parque del mod reproduce la temporada real 2026. CADPO también corre categorías históricas y recreaciones. Si preguntan "qué autos tiene CADPO", manda `categoryCars`; si preguntan "qué corre en la realidad en 2026", usar este documento. Los reglamentos pueden cambiar mediante anexos durante el año.

## Siglas y nombres

- **TN:** Turismo Nacional, denominado oficialmente TN APAT. Tiene Clase 2 y Clase 3. No significa Turismo Neuquino.
- **TC:** Turismo Carretera. No confundir con TC2000.
- **TC2000:** Turismo Competición 2000. "Súper TC2000" identifica una etapa anterior; la división superior volvió a llamarse TC2000.
- **Top Race:** categoría nacional de autos prototipo/silueta; la carrocería representa modelos de calle, pero la mecánica es normalizada.
- **Turismo Pista:** categoría nacional diferente del Turismo Nacional y de los zonales.
- **Zonal:** campeonato regional. "Clase 1/2/3" no define por sí sola un reglamento nacional: depende de la federación y región. No atribuirle peso o potencia sin identificar el zonal.

## TN APAT Clase 2, temporada real 2026

Turismos compactos de gran producción, motor delantero y tracción delantera. Modelos homologados publicados por APAT para 2026: Volkswagen Gol Trend, Ford Fiesta Kinetic, Toyota Etios, Citroën DS3, Chevrolet Onix, Nissan March, Fiat Argo, Toyota Yaris, Chevrolet New Onix, New Peugeot 208 y Audi A1.

Datos reglamentarios comunes: caja secuencial de seis marchas y reversa, diferencial autoblocante, límite de 8500 RPM, llanta de 14 x 7 pulgadas y despeje mínimo de 70 mm. Cilindrada, restrictor y peso se determinan por la ficha de homologación de cada modelo; no existe un único peso ni una potencia oficial común publicados en el reglamento general.

Comportamiento: autos livianos, ágiles y con menor potencia que Clase 3. La tracción delantera concentra dirección, frenado y aceleración en el eje delantero; pueden subvirar al acelerar temprano y castigar neumáticos delanteros. Se favorecen entrada limpia, conservación de velocidad y buena rotación sin saturar el frente.

## TN APAT Clase 3, temporada real 2026

Turismos medianos, motor delantero y tracción delantera. Fichas APAT 2026: Renault Fluence, Volkswagen Vento, Honda All New Civic, Toyota Corolla, Kia Cerato, Chevrolet Cruze, Peugeot 408, Fiat Tipo, Ford Focus Sedán, Toyota Corolla 2020, Nissan Sentra, Citroën C-Elysée, Volkswagen Virtus, otra homologación de Vento y Honda Civic Advance.

Datos comunes: límite de 8500 RPM, llantas de 17 x 8 pulgadas y despeje mínimo de 80 mm. Motor, cilindrada, restrictor, compresión y peso dependen de la ficha del modelo. Como referencia reglamentaria, fichas 2026 del Honda All New Civic y Chevrolet Cruze fueron actualizadas a 1095 kg con piloto y líquidos; no trasladar ese peso automáticamente al resto. APAT no declara una cifra única oficial de caballos para toda la Clase 3, por lo que Ayrton no debe inventarla.

Comportamiento: más potencia, masa, neumático y velocidad que Clase 2. Sigue siendo tracción delantera: el desafío es aplicar potencia sin patinar la rueda interior ni generar subviraje de salida. El autoblocante, convergencia, presiones y rigidez trasera influyen mucho en rotación y tracción.

## Turismo Carretera, temporada real 2026

**TC significa Turismo Carretera.** Es una categoría nacional de prototipos con motor delantero longitudinal y tracción trasera. Los modelos modernos autorizados en el reglamento 2026 son Toyota Camry, Torino NG, Chevrolet Camaro, Ford Mustang, Dodge Challenger, BMW M4 y Mercedes-Benz CLE 53.

El reglamento oficial 2026 fija, según marca/configuración, cilindradas aproximadas entre 3400 y 3550 cm³ y regímenes máximos alrededor de 8700/8800 RPM. Los pesos mínimos publicados son 1300 kg para Torino NG y 1310 kg para los otros modelos indicados, incluyendo piloto y condiciones reglamentarias. La potencia exacta no aparece como una cifra única oficial en el reglamento consultado: no responder con un número categórico sin una fuente vigente.

Comportamiento: mucha potencia y velocidad, eje trasero motriz y fuerte sensibilidad a la aplicación del acelerador. Puede aparecer sobreviraje de potencia y degradación trasera. La aerodinámica, el diferencial, la relación de caja y el control del peso por performance cambian el balance.

En CADPO, la categoría Turismo Carretera puede usar los modelos clásicos Chevrolet Chevy, Ford Falcon, Dodge GTX y Torino IKA. Son una recreación histórica del mod, no los modelos reales vigentes en 2026.

## TC2000, temporada real 2026

TC2000 significa Turismo Competición 2000. Desde 2025 utiliza siluetas SUV y en 2026 la información oficial enumera Volkswagen Nivus, Toyota Corolla Cross, Honda ZR-V, Chevrolet Tracker, Fiat Pulse, Renault Captur, Ford Kuga, Peugeot 2008 y Nissan Kicks.

Ficha técnica oficial: motor común BaseN de cinco cilindros turbo, 2500 cm³, 500 HP, 550 Nm, máximo 8000 RPM; tracción delantera; caja XTrac secuencial de seis marchas y reversa; suspensión independiente; frenos a disco; llantas de 18 pulgadas; Pirelli P Zero; peso publicado actualmente de 1120 kg con piloto; hasta 600 kg estimados de carga aerodinámica según setup.

Comportamiento: es un turismo de altísima potencia con tracción delantera y mucha carga aerodinámica. En baja velocidad exige dosificar los 500 HP para no patinar y subvirar; en curvas rápidas depende mucho de altura, plataforma aerodinámica y confianza del tren delantero.

En CADPO, **Súper TC2000** contiene sedanes de una generación anterior —Cruze, C4 Lounge, Cronos, Linea, Focus, Civic, 408, Fluence y Corolla, según MySQL—. No describirlos como el parque SUV real 2026.

## Top Race, temporada real 2026

Top Race usa autos silueta de tracción trasera, motor delantero longitudinal y mecánica normalizada. El reglamento 2026 admite Grupo 3.5 (Top Race V6) y Grupo 3.0 (anteriores Top Race Series). Ambos usan V6; el Grupo 3.5 declara 3500 cm³, aproximadamente 300 HP y 7300 RPM, mientras el Grupo 3.0 declara 3000 cm³ y aproximadamente 300 HP. La categoría aplica Balance of Performance y el reglamento/anexos mandan sobre cifras históricas.

Las carrocerías son representativas: los resultados oficiales 2026 muestran, entre otras, Fiat, Ford, Mercedes-Benz y Lexus. Para los autos exactos del campeonato virtual, usar `categoryCars`.

Comportamiento: al ser tracción trasera requiere cuidar acelerador y neumático posterior; permite rotar con potencia, pero puede sobrevirar en salida. Tiene más carga aerodinámica y una conducción distinta de los TN de tracción delantera.

## Turismo Pista Clase 2, temporada real 2026

Categoría nacional de autos chicos, motor delantero y tracción delantera. El reglamento 2026 admite Fiat Uno Way/Mobi/500, Chevrolet Classic, Nuevo Ford Ka, Volkswagen Up y Renault Kwid, con posibles incorporaciones homologadas. Motor, peso y restricciones dependen de la ficha técnica del modelo; no dar una potencia o peso únicos sin consultar esa ficha y sus anexos.

Comportamiento: baja masa, potencia moderada y carreras de pelotón. Es importante conservar velocidad, reducir arrastre y no sobrecargar el neumático delantero. El Volkswagen Up que figura en CADPO coincide con uno de los modelos reales homologados, pero la física del mod puede estar balanceada por CADPO.

## Categorías zonales de CADPO

Los nombres Zonal Clase 1, 2 y 3 son genéricos y no permiten identificar una federación real. No asegurar que corresponden a ATZP, FeMAD, FRAD Cuyo u otra entidad sin que la pregunta lo especifique.

Según los autos cargados actualmente en CADPO:

- Zonal Clase 1: Fiat 600. Arquitectura típica de motor trasero y tracción trasera; muy liviano, sensible a transferencias y sobreviraje.
- Zonal Clase 2: Fiat 128, 147, Duna y Uno SCR. Motor delantero, tracción delantera; autos simples y livianos, donde importan inercia y agarre delantero.
- Zonal Clase 3: Ford Escort, Peugeot 206 y Volkswagen Gol G2. En las versiones representadas habitualmente son tracción delantera y de mayor prestación que Clase 2.

Peso, cilindrada y potencia deben provenir del reglamento zonal concreto o de la física del mod. No existe una cifra nacional universal para esas tres clases.

## Otras categorías almacenadas en CADPO

- Copa Abarth Argentina: mod monomarca Fiat 500 Abarth, motor delantero turbo y tracción delantera. No asumir que hay campeonato argentino real activo en 2026.
- Copa Bora: Volkswagen Bora, motor delantero y tracción delantera; tratarla como categoría virtual/histórica salvo fuente vigente.
- Fórmula 3CV: Citroën 3CV de tracción delantera, baja potencia y gran conservación de inercia; es una recreación de CADPO.
- Fórmula Internacional: el auto cargado es F2 Codasur; monoplaza de motor trasero y tracción trasera. No atribuirle especificaciones 2026 sin reglamento.
- GT Internacional: BMW M4 y Porsche 911 GT3 en CADPO; autos GT de tracción trasera, pero sus cifras dependen del mod y Balance of Performance.
- Karting 100 CC: Tony Kart 100 CC; motor trasero y transmisión al eje posterior, sin diferencial. Muy directo y sensible al reparto de peso.
- Monomarca R12: Renault 12, motor delantero y tracción delantera; prioriza inercia, rolido y tracción del eje delantero.

## Cómo debe responder Ayrton

- Mencionar primero el nombre completo de la sigla: "TN, Turismo Nacional" o "TC, Turismo Carretera".
- Indicar siempre si describe **la realidad 2026** o **el mod/campeonato de CADPO**.
- Dar potencia y peso como reglamentarios solo cuando este documento los identifica como tales. Si varían por modelo o no están publicados, decirlo.
- Para modelos disponibles en una inscripción de CADPO, usar `categoryCars`, no una lista real de 2026.
- Para comportamiento, relacionar tipo de tracción, masa, potencia y aero; evitar afirmar que todos los mods reproducen exactamente el auto real.

## Fuentes oficiales principales

- TN APAT, reglamento y fichas 2026: https://apat.org.ar/noticias/detalle/reglamento
- Reglamento técnico TN APAT 2026: https://apat.org.ar/descargas/REGLAMENTO%20TECNICO-APAT%20-%202026%20Final.pdf
- ACTC, reglamentos de Turismo Carretera: https://actc.org.ar/tc/reglamentos.html
- Reglamento técnico TC 2026: https://actc.org.ar/upload/rules/369.pdf
- TC2000, autos y ficha técnica: https://tc2000.com.ar/autos.php
- Top Race, reglamentos 2026: https://toprace.com.ar/toprace/reglamento.html
- Reglamento técnico Top Race 2026: https://toprace.com.ar/upload/rules/75.pdf
- Turismo Pista Clase 2, reglamento 2026: https://aptpweb.com.ar/wp-content/uploads/2025/12/Reg-TECNICO-C2-2026.pdf

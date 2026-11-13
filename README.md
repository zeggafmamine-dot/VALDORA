# Valdora

Juego original de construcción y supervivencia inspirado en los city builders de aldeas. Interfaz en español, renderizado 3D WebGL 2 con Three.js r180 incluido en el proyecto, sin servicios externos. Modelos originales y materiales de madera, tejas, piedra y hierba generados para el juego. La vista 2D anterior queda como modo de compatibilidad para dispositivos sin WebGL 2.

## Jugar

Funda una aldea con ocho habitantes. Construye un campo y una cabaña recolectora para alimentar a los colonos. Añade un puesto forestal y un leñador antes del invierno. Las casas permiten recibir nuevos habitantes al empezar cada estación. Completa los cuatro objetivos y continúa expandiendo la aldea.

- Clic en un edificio del panel y después en el mapa: construir.
- Caminos: selecciona Camino de piedra, arrastra entre dos extremos y suelta. La vista previa muestra todo el recorrido y su coste; Esc cancela sin gastar.
- Puentes: selecciona Puente de madera y arrastra de tierra a tierra sobre el río. El eje se alinea automáticamente.
- Clic en un edificio existente: ver su estado y ajustar trabajadores.
- Arrastrar: desplazar la cámara. Rueda o botones +/−: zoom.
- Botón derecho + arrastrar: girar e inclinar la cámara. Q/E: girar.
- Los botones de cámara permiten girar, inclinar y ocultar la interfaz.
- Ajustes: calidad Alta, Equilibrada o Ligera.
- Espacio: pausa. 1/2/3: velocidades 1×/2×/5×.
- G: marcar árboles y rocas para recoger. C: centrar. Esc: cancelar.
- B: casa. F: campo. WASD o flechas: mover la cámara.
- En móvil, botón Construir y gestos de arrastre.

El mundo procedural ahora es **continuo durante la partida**: el generador determina cada casilla por semilla y coordenadas globales, y puedes recorrerlo en cualquier dirección sin una frontera de 64 × 64. Cada región lógica mide 64 × 64 casillas, pero el renderizador dibuja también una franja de transición para evitar cortes visibles. Los sectores de generación miden **64 × 64 casillas**. La caché mantiene un máximo de **25 sectores** (102.400 casillas) y descarta automáticamente los más lejanos. Los sectores vecinos se generan progresivamente en segundo plano entre fotogramas, mientras los nuevos paisajes 3D aparecen mediante una transición suave de **1,15 segundos** en vez de surgir bruscamente. Se conserva un margen de terreno alrededor de la cámara para que no se vean cortes al cambiar de región. Las zonas no visitadas no ocupan memoria. Los edificios, caminos, puentes y recursos modificados se registran por coordenada y reaparecen al volver, incluso después de guardar y cargar. Las mismas coordenadas y semilla producen siempre el mismo terreno. En «Nuevo valle» escoges solo el punto inicial; para explorar durante la partida usa WASD, arrastre, o el minimapa. La tecla C vuelve a la aldea original. El modo de terreno clásico (guardados muy antiguos sin versión) se mantiene sin streaming para no modificar su geografía. Cada estación tiene 30 días. Un día equivale a 2,5 segundos de simulación a velocidad 1×. El juego incluye edificios con trabajadores, costes, construcción, cultivos estacionales, recolección, pesca, pastos, recursos forestales, cantera, viviendas, almacenes, pozo, mercado, caminos y puentes. Los aldeanos tienen rutas visuales; la producción se calcula diariamente por edificio, sin simular cadenas individuales de transporte.

El guardado automático utiliza localStorage y ocurre cada 20 segundos. El terreno no modificado no se guarda: solo los cambios, los habitantes, los edificios y la posición de cámara. El espacio disponible en el navegador sigue siendo limitado; exporta una copia JSON periódicamente si expandes mucho tu asentamiento. El menú permite guardar, exportar e importar JSON, y empezar una partida con otra semilla. Al recuperar una partida, el tiempo comienza pausado. No hay progreso mientras el juego está cerrado.

## Archivos

- `dist/index.html`: estructura y controles accesibles.
- `dist/style.css`: interfaz adaptable a pantalla.
- `dist/sim.mjs`: simulación determinista, generación de terreno y guardado.
- `dist/terrain.mjs`: muestreo continuo de relieve procedural en coordenadas globales X/Y.
- `dist/chunks.mjs`: caché LRU de sectores de 64 × 64, precarga incremental y cambios persistentes.
- `dist/reveal.mjs`: curva de interpolación para la aparición gradual del relieve, vegetación y caminos.
- `dist/render3d.mjs`: terreno con relieve, cámara en perspectiva, agua animada, luces, sombras, follaje instanciado y selección con rayos.
- `dist/models3d.mjs`: texturas, casas, árboles, aldeanos, ovejas y otros modelos.
- `dist/vendor/`: Three.js r180 y su licencia MIT.
- `dist/paths.mjs`: trazados continuos, validación y costes de cada tramo completo.
- `dist/visuals.mjs`: materiales detallados, relieve superficial, viento, cielo, reflejos del río, puentes continuos y posprocesado.
- `dist/assets/village-materials-v3.png`: atlas original de materiales.
- `dist/render.mjs` y `dist/detail2d.mjs`: vista compatible con texturas, edificios de entramado, follaje detallado y puentes con barandillas.
- `dist/game.mjs`: controles, cámara, interfaz y audio opcional.

## Comprobaciones

```bash
node --test tests/*.test.mjs
node --check dist/game.mjs
node --check dist/render3d.mjs
node --check dist/models3d.mjs
```

Para ejecutar, servir `dist/` con un servidor HTTP estático. Los módulos ES necesitan HTTP, no abrir `index.html` directamente con `file://`.

## Validación de la actualización 3D

Se verificaron por código la creación de todos los modelos, datos geométricos finitos, selección mediante rayos, cámara, cambios de estación, actualización de obras, calidad gráfica y compatibilidad de partidas. La simulación conserva sus ocho pruebas. El navegador de QA tiene WebGL desactivado; en ese entorno se comprobó el modo de compatibilidad, pero la representación final WebGL no pudo verificarse visualmente.


## Actualización de gráficos y trazados

Las carreteras se unen con bordes redondeados. Los puentes forman tableros completos con pilares, barandillas y accesos, y los aldeanos pueden atravesarlos. Se conservan al guardar, incluida su orientación. La validación de un arrastre es atómica: si hay edificios, montaña, agua inadecuada o recursos insuficientes, no se construye ni se cobra parte del recorrido. Las diagonales de carretera mantienen continuidad para los aldeanos, que se desplazan en cuatro direcciones.

La vista 3D incorpora materiales con grano y relieve, buhardillas, porches, tejas superpuestas, más ramas y follaje, movimiento por viento, sombras de 4096 píxeles en calidad Alta, oclusión de contacto, exposición y cielo con nubes. El río refleja la escena mediante una cámara especular y muestra diferencias de profundidad y ondas. La calidad Equilibrada reduce la resolución de sombras y la frecuencia de los reflejos. Ligera desactiva reflejos y sombras. La vista compatible también incorpora el atlas y nuevos árboles detallados.

El atlas fue generado con ImageGen para este proyecto: cuatro cuadrantes de materiales planos y sin texto — tablones de roble envejecido, tejas de madera marrón, mampostería gris y suelo de pradera oliva. Se utiliza el archivo original, sin activos de Banished.

Validación histórica: 13 pruebas de simulación y trazado; creación de todos los modelos, geometría finita, cámara, rayos, estaciones y guardado; prueba de arrastre real en el navegador de un camino de seis tramos y un puente de seis tramos con el coste exacto. El navegador de QA no ofrece WebGL: se revisó visualmente la vista compatible; el resultado y rendimiento de los efectos WebGL requieren revisión en un equipo con aceleración gráfica.

## Mundo infinito (noviembre 2026)

El streaming y el guardado disperso están cubiertos por `tests/infinite.test.mjs` y `tests/streaming.test.mjs`: continuidad del relieve, exploración de regiones negativas y lejanas, límite de caché, persistencia de carreteras, tala, edificios y cámara. Ejecuta `node --test tests/*.test.mjs`; GitHub Actions también comprueba la sintaxis y las pruebas. Las limitaciones prácticas son la precisión numérica del navegador y el espacio local disponible para modificaciones; no existe un mapa completo que debamos cargar o almacenar.

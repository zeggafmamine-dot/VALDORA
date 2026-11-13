# Valdora

**Jugar la versión actualizada:** https://zeggafmamine-dot.github.io/VALDORA/ (redirige a la aplicación en `dist/`). El juego original de ChatGPT Sites no se sincroniza con GitHub; para ver estas mejoras utiliza esta edición publicada en GitHub Pages.

Juego original de construcción y supervivencia inspirado en los city builders de aldeas. Interfaz en español, renderizado 3D WebGL 2 con Three.js r180 incluido en el proyecto, sin servicios externos. Modelos originales y materiales de madera, tejas, piedra y hierba generados para el juego. La vista 2D anterior queda como modo de compatibilidad para dispositivos sin WebGL 2.

## Jugar

Funda una aldea con ocho habitantes. Construye un campo y una cabaña recolectora para alimentar a los colonos. Añade un puesto forestal y un leñador antes del invierno. Las casas permiten recibir nuevos habitantes al empezar cada estación. Completa los cuatro objetivos y continúa expandiendo la aldea.

- Clic en un edificio del panel y después en el mapa: construir.
- Botón junto al logotipo **VALDORA**: plegar o desplegar el menú izquierdo. Al plegarlo, el mapa se amplía; la preferencia se recuerda en este navegador. En móvil, el botón y «Construir» abren/cierra el mismo menú flotante.
- Caminos: selecciona Camino de piedra, arrastra entre dos extremos y suelta. La vista previa muestra todo el recorrido y su coste; Esc cancela sin gastar.
- Puentes: selecciona Puente de madera y arrastra de tierra a tierra sobre el río. El eje se alinea automáticamente.
- Clic en un edificio existente: ver su estado y ajustar trabajadores.
- Arrastrar: desplazar la cámara. Rueda o botones +/−: zoom.
- Botón derecho + arrastrar: girar e inclinar la cámara. Q/E: girar.
- Los botones de cámara permiten girar, inclinar y ocultar la interfaz.
- Ajustes: calidad Alta, Equilibrada o Ligera. Cada inicio de juego se configura automáticamente en **Ligera**; si deseas más detalle, puedes cambiarlo durante esa sesión.
- Espacio: pausa. 1/2/3: velocidades 1×/2×/5×.
- G: marcar árboles y rocas para recoger. C: centrar. Esc: cancelar.
- B: casa. F: campo. WASD o flechas: mover la cámara.
- En móvil, botón Construir y gestos de arrastre.

El mundo procedural ahora es **continuo durante la partida**: el generador determina cada casilla por semilla y coordenadas globales, y puedes recorrerlo en cualquier dirección sin una frontera de 64 × 64. Cada región lógica mide 64 × 64 casillas, pero el renderizador dibuja también una franja de transición para evitar cortes visibles. Los sectores de generación miden **64 × 64 casillas**. La caché mantiene un máximo de **24 sectores** (98.304 casillas) y descarta automáticamente los más lejanos. El renderizador 3D ya no sustituye toda la región cuando se cruza una frontera. Mantiene una ventana de búsqueda visual de hasta 15 × 15 sectores de 64 × 64 según la posición de la cámara (3 veces más distancia visible en cada eje), incorpora los nuevos progresivamente y reduce la opacidad de los que van quedando atrás. La aparición depende de la **distancia real a la cámara**, no de haber cruzado un límite de 64 casillas. El horizonte activo actual se ajusta al zoom y a un presupuesto reducido de 256–384 casillas, sin procesar sectores que quedan fuera de pantalla, y construye un máximo de dos sectores gráficos simplificados por fotograma y precarga vecinos mientras exploras. La banda física de aparición se mantiene en 74 casillas (entre 436 y 510 unidades de distancia de cámara), igual que antes. Las geometrías de sectores que permanecen visibles se reutilizan, con un límite adicional de 170 sectores gráficos durante desplazamientos rápidos. Los sectores de relieve lejano se dibujan sin cargar sus 4.096 objetos de casilla, de modo que la caché lógica sigue limitada a 36 sectores. Las zonas no visitadas no ocupan memoria. Los edificios, caminos, puentes y recursos modificados se registran por coordenada y reaparecen al volver, incluso después de guardar y cargar. Las mismas coordenadas y semilla producen siempre el mismo terreno. En «Nuevo valle» escoges solo el punto inicial; para explorar durante la partida usa WASD, arrastre, o el minimapa. La tecla C vuelve a la aldea original. El modo de terreno clásico (guardados muy antiguos sin versión) se mantiene sin streaming para no modificar su geografía. Cada estación tiene 30 días. Un día equivale a 2,5 segundos de simulación a velocidad 1×. El juego incluye edificios con trabajadores, costes, construcción, cultivos estacionales, recolección, pesca, pastos, recursos forestales, cantera, viviendas, almacenes, pozo, mercado, caminos y puentes. Los aldeanos tienen rutas visuales; la producción se calcula diariamente por edificio, sin simular cadenas individuales de transporte.

El guardado automático utiliza localStorage y ocurre cada 20 segundos. El terreno no modificado no se guarda: solo los cambios, los habitantes, los edificios y la posición de cámara. El espacio disponible en el navegador sigue siendo limitado; exporta una copia JSON periódicamente si expandes mucho tu asentamiento. El menú permite guardar, exportar e importar JSON, y empezar una partida con otra semilla. Al recuperar una partida, el tiempo comienza pausado. No hay progreso mientras el juego está cerrado.

## Archivos

- `dist/index.html`: estructura y controles accesibles.
- `dist/style.css`: interfaz adaptable a pantalla.
- `dist/sim.mjs`: simulación determinista, generación de terreno y guardado.
- `dist/terrain.mjs`: muestreo continuo de relieve procedural en coordenadas globales X/Y.
- `dist/chunks.mjs`: caché LRU de sectores de 64 × 64, precarga incremental y cambios persistentes.
- `dist/reveal.mjs`: interpolación de transición usada por versiones anteriores.
- `dist/stream-window.mjs`: planificación por distancia, aparición gradual y retirada de sectores gráficos independientes.
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

El juego se inicia siempre en calidad **Ligera** (sin sombras ni reflejos, con resolución de píxel 1×) para que el horizonte ampliado rinda mejor. La vista 3D incorpora materiales con grano y relieve, buhardillas, porches, tejas superpuestas, más ramas y follaje, movimiento por viento, sombras de 4096 píxeles en calidad Alta, oclusión de contacto, exposición y cielo con nubes. El río refleja la escena mediante una cámara especular y muestra diferencias de profundidad y ondas. La calidad Equilibrada reduce la resolución de sombras y la frecuencia de los reflejos. Ligera desactiva reflejos y sombras. La vista compatible también incorpora el atlas y nuevos árboles detallados.

El atlas fue generado con ImageGen para este proyecto: cuatro cuadrantes de materiales planos y sin texto — tablones de roble envejecido, tejas de madera marrón, mampostería gris y suelo de pradera oliva. Se utiliza el archivo original, sin activos de Banished.

Validación histórica: 13 pruebas de simulación y trazado; creación de todos los modelos, geometría finita, cámara, rayos, estaciones y guardado; prueba de arrastre real en el navegador de un camino de seis tramos y un puente de seis tramos con el coste exacto. El navegador de QA no ofrece WebGL: se revisó visualmente la vista compatible; el resultado y rendimiento de los efectos WebGL requieren revisión en un equipo con aceleración gráfica.

## Mundo infinito (noviembre 2026)

El streaming y el guardado disperso están cubiertos por `tests/infinite.test.mjs` y `tests/streaming.test.mjs` y `tests/stream-window.test.mjs`: continuidad del relieve, exploración de regiones negativas y lejanas, límite de caché, persistencia de carreteras, tala, edificios y cámara. Ejecuta `node --test tests/*.test.mjs`; GitHub Actions también comprueba la sintaxis y las pruebas. Las limitaciones prácticas son la precisión numérica del navegador y el espacio local disponible para modificaciones; no existe un mapa completo que debamos cargar o almacenar.

### Ventana visual continua (noviembre 2026)

La cámara dirige la carga de zonas de 64 × 64, incluso antes de llegar a su borde. El terreno, árboles, rocas y caminos de cada sector conservan su geometría mientras permanezcan próximos. La aparición y desaparición utilizan una interpolación gradual de opacidad; fuera del radio visual, las geometrías se liberan. El modo 2D sigue dibujando casillas bajo demanda. Las pruebas de GitHub verifican las transiciones matemáticas, el streaming lógico y el guardado; la suavidad final en WebGL debe comprobarse también en un navegador real.

### Horizonte 3× y gráficos ligeros por defecto (noviembre 2026)

La cámara inicia a 84 unidades en lugar de 28. La niebla, el cielo, el agua y el plano lejano acompañan el nuevo alcance; los sectores continúan midiendo 64 × 64 casillas y apareciendo mediante el mismo margen físico de 74 unidades, sin ampliar las casillas generadas cada vez. Se usa malla de terreno de menor resolución (32 divisiones por sector) y solo se generan los árboles, las rocas y los caminos detallados en los sectores cercanos. El modo 2D también abre con una vista tres veces más amplia. Al reiniciar el navegador, se restaura calidad Ligera incluso si se seleccionó otra calidad durante la partida anterior.

### Horizonte adaptativo y calidad Ligera verificable (noviembre 2026)

La cámara inicial se ha ampliado a **112 unidades** (frente a 28 en el primer sistema 3D). La versión actual reduce el horizonte cargado hasta un máximo de **384 casillas** desde la cámara, sin modificar los sectores de 64 × 64 casillas. Un controlador analiza de forma progresiva el tiempo entre fotogramas: amplía el horizonte si los FPS se mantienen altos y lo reduce si cae la fluidez. El horizonte comienza a 288 y tiene límites de 256 a 384; el campo necesario se ajusta también al zoom. **La transición de aparición y desaparición siempre ocupa 74 casillas**, sea cual sea el horizonte: no hay un recorte de terreno visible fuera de la banda de fundido.

Se ha reforzado el arranque en modo **Ligera** en dos lugares: en el constructor 3D y en el inicio de la interfaz, también si se restaura una partida guardada. La etiqueta permanente «Gráficos: Ligera» en el mapa y el botón seleccionado en Ajustes permiten comprobarlo. Se usa resolución 1×, sin sombras y sin postprocesado costoso; el procesado avanzado se prepara únicamente al seleccionar Equilibrada o Alta. El usuario puede subir la calidad durante la partida, pero el siguiente inicio vuelve a Ligera. El modo 2D de compatibilidad muestra «Vista 2D ligera».

Las pruebas nuevas comprueban el cálculo del horizonte según los FPS, el ancho de fundido, la estabilidad entre regiones, la reposición del perfil Ligera y la presencia del indicador en un navegador real. Estos cambios son para la versión del repositorio GitHub y su despliegue correspondiente: **no actualizan automáticamente un proyecto independiente de ChatGPT Sites**.

### Canteras y piedra finita (noviembre de 2026)

La cantera extrae exclusivamente depósitos rocosos reales que ya existen en un **radio de 9 casillas**. Debe construirse cerca de rocas, sobre terreno llano. Cada casilla rocosa tiene una cantidad de mineral reproducible, determinada por las coordenadas, la semilla y la geología. La cantidad es un número entero, no una clase nueva de terreno: las **cinco etapas visuales** (intacta, grande, mediana, pequeña y agotada) son una representación del porcentaje restante. En 3D la roca pierde escala y cambia de tono; al explotarla, permanece una pequeña marca de suelo desnudo. El modo 2D también representa el desgaste y la huella de extracción.

Dos canteras que alcancen la misma roca comparten el mismo depósito y no pueden obtener más piedra de la que contiene. Cuando se agota el radio cercano, la producción se detiene y se informa al jugador. No se regenera automáticamente ni después de demoler la cantera, volver a otra región, cerrar el navegador o cargar una partida. El panel del edificio enseña las unidades de piedra que quedan alrededor. Las recogidas manuales consumen ese mismo inventario finito. Si el almacén de piedra está lleno, la cantera no agota recursos que no puede almacenar.

Los guardados nuevos guardan la cantidad restante y si el terreno ha sido excavado como modificaciones dispersas de las casillas. Se admiten los formatos antiguos de 8 o 9 campos, además del nuevo formato de 10 campos. En las partidas antiguas, las rocas todavía presentes adquieren una reserva inicial y las que se habían recogido permanecen agotadas. Las pruebas en `tests/quarry.test.mjs` comprueban la extracción y el guardado de los depósitos agotados.

### Selección de canteras y círculo de influencia (noviembre 2026)

Al seleccionar una cantera, el juego muestra un **círculo de radio 9 casillas**, con relleno verde semitransparente y contorno dorado ancho en 3D y 2D. No es un cuadrado. Se muestra asimismo mientras eliges dónde colocar la cantera (verde si la ubicación es válida; rojizo si es inválida). La simulación conserva la extracción circular original. La cantidad de piedra disponible aparece destacada en la ficha del edificio y en una banda visible sobre el mapa. Se han ampliado las superficies de selección de edificios cuando la cámara está alejada. Las pruebas del navegador incluyen un clic real sobre la cantera, no solo la invocación de una función interna.

### Zonas de trabajo unificadas (noviembre de 2026)

Al seleccionar o colocar un edificio productor, el juego dibuja el **mismo círculo visible** de influencia usado por la cabaña recolectora. Los radios son: cabaña recolectora 7, puesto forestal 8 y cantera 9 casillas; cabaña de pesca 6, leñador 6, campo 2,5 y pastizal 3 como referencias visuales de su entorno. La zona de cantera y las zonas de recolección/gestión forestal coinciden con las casillas utilizadas por sus respectivas simulaciones. La ficha y la banda superior muestran la información pertinente: porcentaje de bosque, unidades de piedra, madera disponible en el almacén, agua cercana o rendimiento de la parcela. Los números se actualizan durante la partida. **El leñador no extrae troncos de su círculo:** transforma en leña la madera almacenada globalmente; su círculo es orientativo y la ficha lo aclara. La pesca, los cultivos y el pastizal también muestran áreas visuales sin introducir límites artificiales sobre su producción. No se dibujan zonas falsas para viviendas, carreteras o almacenes.

La representación se comparte entre los modos 3D y 2D, con relleno transparente, contorno visible y previsualización al construir. Los nuevos edificios de trabajo abren automáticamente su panel tras colocarlos. `tests/work-areas.test.mjs` y la prueba WebGL verifican sus radios y fichas.

### Menor terreno cargado (noviembre de 2026)

Se conserva el tamaño visible de la cámara y la generación infinita, pero se ha reducido el horizonte 3D mantenido en memoria: arranca a **288 casillas**, puede bajar a **256** cuando hay pocos FPS y como máximo sube a **384** cuando el equipo va sobrado (antes llegaba a 640). La ventana de búsqueda se limita a 15 × 15 sectores y el límite de geometrías 3D baja a 170, frente a 420. En la caché de simulación se mantienen como máximo **24 sectores** frente a 36; la precarga automática solo alcanza los ocho sectores vecinos inmediatos, sin generar otro anillo lejano. Los sectores individuales siguen siendo de 64 × 64 casillas y la aparición gradual mantiene la misma franja de **74 casillas**, sin saltos bruscos. La cámara conserva su distancia y zoom, y los círculos e indicadores de los edificios no cambian. Las construcciones y depósitos alterados continúan guardándose independientemente de la caché, por lo que no desaparecen al descargar una región.

### Ajuste adicional de carga de terreno (noviembre de 2026)

Para reducir ligeramente el trabajo gráfico sin empequeñecer la cámara ni cambiar la jugabilidad, el streaming arranca ahora a **256 casillas** de horizonte (antes 288), puede bajar a **224** con FPS bajos y subir hasta **320** con margen de rendimiento (antes 384). El planificador evalúa como máximo **13 × 13 sectores** (antes 15 × 15); el límite de sectores gráficos activos baja a **135** (antes 170), y la caché de simulación a **20 sectores** (antes 24). Cada sector continúa midiendo 64 × 64 casillas y la transición gradual ocupa las mismas **74 casillas**. Se mantienen los círculos de cantera, recolector, forestal y otros edificios, así como la calidad Ligera al iniciar, las construcciones y los guardados.

### Carga de terreno al 50 % (noviembre de 2026)

La siguiente optimización reduce la **superficie aproximada cargada** a la mitad respecto a la versión anterior, sin reducir a la mitad la distancia de cámara (lo que haría la vista demasiado pequeña). El horizonte 3D pasa de **256 a 180 casillas** inicialmente, de **224 a 160** en modo de ahorro por FPS y de **320 a 224** como máximo; en cada caso, el área cuadrada equivalente es alrededor del **50 %** de la anterior. Los candidatos de renderizado pasan de **13 × 13 a 9 × 9 sectores**, la memoria gráfica máxima de **135 a 70 sectores** y la caché lógica de **20 a 12 sectores**, conservando espacio para la región y sus vecinos inmediatos. Cada sector continúa midiendo 64 × 64; el margen de aparición y desaparición gradual se mantiene en **74 casillas** y la cámara, los controles, el modo Ligera al iniciar y los círculos de trabajo no se modifican. Se mantienen todos los cambios de terreno y construcciones en los guardados incluso después de descargar sectores.

### Optimización del renderizado real (noviembre de 2026)

Además de mantener el horizonte reducido, se han eliminado trabajos de CPU que bloqueaban fotogramas sin mejorar los gráficos. La geometría del relieve por sector pasa de 32 × 32 a **20 × 20 subdivisiones**, aproximadamente un 62 % menos de triángulos. La textura de profundidad del agua calcula **80 × 80 muestras en vez de 160 × 160** (un 75 % menos), sobre una superficie proporcional para mantener una densidad de muestras equivalente; se actualiza solo después de desplazamientos significativos en lugar de cada frontera de sector. Se sustituye la lectura de las 4.096 casillas de una región por la referencia directa a su sector ya generado. Las revisiones por sector permiten refrescar los árboles y las rocas únicamente cuando las casillas cambian, evitando regeneraciones cada día de simulación. En calidad Ligera/Equilibrada se omite la creación de decenas de miles de instancias de hierba que están ocultas; si el usuario selecciona Alta, se crean entonces. Las piezas de un mismo árbol comparten su matriz calculada, sin repetir el muestreo del terreno por tronco, hojas y ramas. En gráficos **Ligera**, el agua utiliza un shader de coste reducido que evita calcular reflejos, espuma y normales complejas por cada píxel; al activar Equilibrada o Alta se recuperan los efectos completos. Además, Ligera dibuja internamente al 80 % de la resolución de la pantalla (aproximadamente un 36 % menos de píxeles) y reescala el resultado; la interfaz HTML sigue nítida. La carga del relieve se reparte como máximo a un sector cada 28 ms y la vegetación se incorpora progresivamente. Las consultas visuales de los aldeanos no fuerzan la generación de sectores para comprobar los puentes.

Se preservan el mapa procedural sin fin, la distancia de cámara, los círculos de los edificios, la explotación permanente de la cantera, el guardado, el fundido de 74 casillas y la selección automática de gráficos Ligera. Las pruebas comprueban que la revisión de los sectores se mantiene tras descargar la caché y, en WebGL real, que no se procesan sectores sin cambios ni se crean hierbas invisibles. El efecto exacto sobre los FPS depende de la CPU y GPU del equipo, y debe comprobarse en el navegador del jugador.

### Vegetación visible desde todos los ángulos (noviembre de 2026)

Se corrigió un fallo de profundidad causado por la aparición gradual del mundo: los materiales de hojas y terreno conservaban `transparent=true` y `depthWrite=false` incluso cuando ya habían alcanzado la opacidad completa. Esto podía dibujar árboles por delante de montañas u hojas superpuestas incorrectamente, dependiendo de la posición de la cámara. Ahora el fundido es temporal y, al acabar, cada material recupera sus propiedades originales de opacidad y escritura de profundidad. Los materiales recortados con `alphaTest` conservan el recorte de textura, sin efectos de transparencia permanentes.

Las copas de coníferas y árboles de hoja ancha incorporan ahora un núcleo sólido **de muy pocos polígonos** detrás de las hojas, por lo que mantienen volumen cuando las láminas de vegetación se ven de canto o desde arriba. Para evitar árboles flotando en laderas, se sitúan sobre la altura interpolada de los triángulos de terreno realmente dibujados (en vez de una altura teórica más precisa que la malla gráfica). No se aumenta la distancia de carga ni se generan nuevos sectores; se mantienen las optimizaciones de CPU/GPU, la calidad Ligera, el fundido gradual, las reservas de piedra, los círculos y las partidas guardadas. La prueba WebGL valida estos materiales, las copas con volumen y el renderizado al orientar la cámara en cuatro direcciones.

### Reutilización de geometría y reducción de trabajo por fotograma (noviembre de 2026)

Los modelos procedurales de los **tres tipos de árbol** se generan ahora una sola vez por renderizador y sus geometrías se comparten entre los `InstancedMesh` de todos los sectores. Antes cada nuevo sector con vegetación reconstruía árboles completos, con cientos de ramas y planos de hojas, y enviaba nuevas geometrías a la GPU. Las rocas y las marcas de cantera también comparten mallas. Al retirar sectores se liberan los buffers propios de las instancias, pero no los prototipos utilizados por otros sectores; la memoria de prototipos queda limitada a los tipos de modelo, en lugar de crecer por región. Los colores de desgaste de las rocas se reutilizan sin crear cientos de objetos por actualización.

Además, los habitantes quietos conservan su altura del suelo y solo vuelven a calcularla si cambian de posición o se modifica el puente sobre el que caminan. La animación de ciudadanos utiliza como máximo **30 actualizaciones por segundo en modo Ligera**; el renderizado de la cámara continúa con su frecuencia normal. Los indicadores de construcción, cantera, recolección y sus círculos de trabajo solo recalculan la validez y la geometría cuando cambian la casilla, la selección, el modo, el día o los recursos. La vista no reduce su resolución adicionalmente, no carga menos terreno y conserva la calidad de vegetación y los guardados. Las comprobaciones WebGL verifican que los árboles comparten geometría, que liberar un sector no destruye mallas en uso y que los habitantes inmóviles no fuerzan muestreos del terreno.

### Regiones naturales y cordilleras procedurales (noviembre de 2026)

El mundo infinito ahora alterna regiones amplias y continuas de **estepa abierta, llanura con muy pocos árboles, pradera, arboledas dispersas, bosque, colinas, montaña y cumbres alpinas**. Antes la vegetación llana se decidía con una probabilidad elevada que hacía que casi todas las regiones pareciesen un bosque. Ahora la densidad se calcula desde una capa climática suave de escala territorial, no mediante una cantidad fija de árboles para cada casilla. La geología usa capas adicionales de relieve y crestas para producir **cordilleras** que ascienden gradualmente desde las colinas y tienen zonas rocosas y cumbres claras. Las montañas contienen mayores concentraciones de roca extraíble; las llanuras, muchas menos. Los depósitos siguen agotándose de manera definitiva. El valle de llegada de los colonos permanece despejado y conserva el espacio para las primeras casas y vías.

El generador sigue siendo determinista por semilla y coordenadas globales: no aparecen saltos de paisaje en los límites de sectores 64×64 ni se guarda el terreno natural por duplicado. Se mantienen tres categorías estructurales compatibles con el sistema de construcción (`water`, `grass`, `hill`), mientras que el atributo `biome` distingue el paisaje natural. El renderizador 3D colorea grandes praderas, bosques, laderas rocosas y cumbres según el bioma, reutilizando la muestra de relieve de cada vértice; el modo 2D y el minimapa muestran la misma diversidad. Los edificios, caminos y cambios de casillas siguen guardándose en el formato existente. En partidas anteriores el paisaje natural todavía no modificado puede actualizar su aspecto al regenerarse, pero las construcciones y piedras que ya se extrajeron permanecen registradas.

### Llanuras despejadas y alta montaña protegida (noviembre de 2026)

Se ha reducido nuevamente la densidad de árboles en las zonas llanas: la estepa, las llanuras y las praderas forman grandes áreas abiertas con **muy pocos árboles**; las arboledas siguen una gradación climática y el bosque denso queda concentrado en manchas más excepcionales. Las colinas y montañas contienen **muchas menos rocas individuales**: el aspecto geológico lo aporta principalmente el propio suelo, no miles de objetos de piedra sobre las laderas. Las piedras aprovechables disminuyen gradualmente al ganar altura y desaparecen por completo antes del límite alpino.

**A partir de altura 14**, el bioma `alpine` es de **alta montaña protegida**. La superficie recibe una **textura propia de roca fría, hielo y nieve**, creada una sola vez como textura compartida de 256 × 256 píxeles y aplicada mediante el shader del terreno, con transición progresiva a la textura de las zonas inferiores. En este terreno no es posible construir viviendas, industrias, granjas, canteras o caminos; tampoco recolectar madera ni piedras, plantar árboles o extraer roca desde una cantera situada fuera del límite. La restricción se aplica igualmente a órdenes antiguas de recolección y a depósitos restaurados desde partidas guardadas, y los habitantes no pueden atravesar estos terrenos. En el modo 2D también hay un aspecto helado distintivo y el minimapa mantiene las cumbres claras.

El umbral es una altura del modelo de relieve, no metros reales. El resto de las montañas permanece explorable desde sus valles y mantiene recursos escasos para las canteras, con reservas finitas. La simulación conserva los formatos de guardado; la geografía procedural sin modificar puede cambiar respecto a partidas anteriores, pero los edificios y los cambios registrados siguen persistiendo.

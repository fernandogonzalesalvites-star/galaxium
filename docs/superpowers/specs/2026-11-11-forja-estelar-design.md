# Forja Estelar — Documento de diseño

**Fecha:** 2026-11-11
**Estado:** aprobado por secciones, pendiente de revisión final
**Nombre:** *Forja Estelar* (provisional)

## 1. Resumen

Juego sandbox para Android en el que el jugador construye su propio sistema solar en 3D realista. La gravedad es de N cuerpos (todos se atraen) e incluye eventos: fusiones, fragmentaciones, ruptura de lunas en anillos, absorción por estrellas y expulsiones. El objetivo es colocar y ajustar planetas y lunas en la zona habitable y mantenerlos estables para que la vida avance por etapas hasta una civilización.

| Decisión | Elección |
|---|---|
| Tipo de juego | Constructor sandbox |
| Plataforma | Android (pruebas en el navegador del móvil y después APK) |
| Estilo visual | 3D realista, generado por código |
| Física | N cuerpos y eventos |
| Colocación | Solo órbita circular automática |
| Cuerpos (v1) | Estrellas (varios tipos y sistema doble), planetas rocosos y gaseosos, lunas |
| Edición | Crear y editar planetas y lunas |
| Objetivo | Zona habitable y etapas de vida |
| Tecnología | TypeScript, Three.js, Vite y Capacitor |
| Idioma | Español |

## 2. Cómo se juega

### 2.1 Inicio
1. Pantalla de inicio: **Nuevo sistema**, **Cargar** y **Ajustes**.
2. Nuevo sistema: se elige la estrella central entre cuatro tarjetas con vista previa y se le pone nombre al sistema.

| Estrella | Masa (M☉) | Luminosidad (L☉) | Color | Zona habitable aprox. |
|---|---|---|---|---|
| Enana roja | 0,3 | 0,012 | Rojo anaranjado | ~0,1 UA |
| Tipo Sol | 1,0 | 1,0 | Amarillo | ~1 UA |
| Gigante azul | 10 | 5 000 | Azul blanco | ~40–80 UA |
| Sistema doble | 2 × 0,8, separadas 0,2 UA en órbita circular | 2 × 0,45 | Amarillo | ~1 UA |

La zona habitable se dibuja como un anillo verde translúcido en el plano orbital. Se calcula para una atmósfera como la terrestre (ver 4.6).

### 2.2 Crear cuerpos
- El botón **＋** abre el **editor**. Se parte de un tipo base: rocoso pequeño, tipo Tierra, supertierra, gigante gaseoso, gigante helado o luna.
- El jugador ajusta los valores (ver 2.3) y pulsa **Colocar**.
- **Planeta:** un planeta fantasma sigue el dedo sobre el plano orbital (y = 0) y muestra el círculo de la órbita que tendría. Al levantar el dedo se coloca en órbita circular automática.
- **Luna:** primero se toca un planeta. Se muestra la franja permitida, entre 1,2 × el límite de Roche y 0,5 × el radio de Hill, y la luna se coloca dentro.
- Color del círculo de vista previa, calculado con la atmósfera y el agua de ese cuerpo:
  - **Verde:** sería habitable.
  - **Azul:** demasiado frío.
  - **Rojo:** demasiado caliente.
  - **⚠ con motivo:** zona inestable (fuera de la esfera de Hill, o demasiado cerca de las dos estrellas en un sistema doble).
- Hay un botón Cancelar.

### 2.3 Editor de planetas y lunas
Se usa el mismo editor para crear y para editar. Mientras está abierto, la simulación se pausa sola. Los cambios se aplican al cerrarlo.

| Propiedad | Planeta | Luna | Efecto |
|---|---|---|---|
| Masa | ✔ | ✔ | Cambia la gravedad. El cuerpo conserva su velocidad, así que su órbita y las vecinas cambian. |
| Tamaño (radio) | ✔ | ✔ | Cambia la densidad (afecta al límite de marea) y el tamaño de choque. |
| Distancia | ✔ (a la estrella) | ✔ (a su planeta) | Se recoloca en órbita circular en el mismo ángulo. Sus lunas se mueven con él conservando su posición relativa. |
| Atmósfera (0–1) | ✔ | ✔ | Efecto invernadero de 0 a +100 K. Cambia el color y el grosor del halo. |
| Agua (0–1) | ✔ (rocosos) | ✔ | Proporción de océano. Sin agua no hay vida. |
| Apariencia | ✔ | ✔ | Colores de superficie, océano y nubes. |
| Nombre | ✔ | ✔ | Texto libre. |
| Eliminar | ✔ | ✔ | Pide confirmación. |

- A las **estrellas** solo se les puede cambiar el tipo, lo que mueve la zona habitable.
- Si se edita la masa, la distancia, la atmósfera o el agua de un cuerpo con vida, su habitabilidad se evalúa de nuevo enseguida y puede perder etapas según las reglas de retroceso (4.7).

### 2.4 Tiempo
Controles: **pausa, ×1 (1 día/s), ×10, ×100, ×1000 (≈2,7 años/s) y máximo (≈10 años/s)**.

La física tiene un presupuesto de tiempo por fotograma (ver 5.3). Si no da para la velocidad pedida, la simulación avanza más despacio y la interfaz muestra la velocidad real.

## 3. Arquitectura

### 3.1 Herramientas
- **TypeScript** y **Three.js** para el 3D.
- **Vite** como servidor de desarrollo y para el empaquetado.
- **Vitest** para los tests.
- **Capacitor** para generar el APK de Android.
- Interfaz en HTML y CSS normales encima del canvas, sin framework.

### 3.2 Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `src/sim/` | Cuerpos, gravedad N cuerpos, integrador, eventos (choques, marea, absorción, expulsión) y utilidades orbitales (velocidad circular, elementos orbitales, esfera de Hill, límite de Roche). TypeScript puro, sin Three.js. | — |
| `src/life/` | Temperatura, condiciones de habitabilidad, límites de la zona habitable y máquina de estados de las etapas de vida. | `sim/` (solo lectura) |
| `src/render/` | Escena Three.js, mallas de cuerpos, shaders procedurales, estelas, anillos, zona habitable, fondo, posprocesado y calidad automática. Solo dibuja el estado de la simulación. | `sim/`, `life/` |
| `src/input/` | Gestos táctiles, selección por raycast y colocación en el plano. | `render/` |
| `src/ui/` | Pantallas, editor, ficha, controles de tiempo, avisos y tutorial. | `game/` |
| `src/game/` | Coordinador: estado de la partida, velocidad del tiempo y órdenes (añadir, editar, eliminar, seleccionar). | todos |
| `src/storage/` | Guardar y cargar en JSON (5 ranuras con miniatura y guardado automático). | `sim/`, `life/` |

### 3.3 Qué pasa en cada fotograma
1. La interfaz envía órdenes a `game/`, que modifica el estado de la simulación.
2. `sim.step()` hace N subpasos fijos según la velocidad del tiempo, sin pasarse del presupuesto.
3. La simulación devuelve una lista de eventos (fusión, fragmentación, anillo, absorción, expulsión).
4. `life.update(dtSimulado)` actualiza temperaturas medias, habitabilidad y etapas.
5. `render.sync()` copia el estado a los objetos 3D. La interfaz muestra los avisos y actualiza la ficha.

### 3.4 Unidades
UA, masas solares y años, con G = 4π² UA³ / (M☉ · año²). Masas planetarias en la interfaz en masas terrestres (1 M⊕ = 3,003 × 10⁻⁶ M☉).

## 4. Física, eventos y vida

### 4.1 Integrador
- **Leapfrog (kick-drift-kick)** con paso fijo de **dt = 1/2000 año (≈4,4 h)**, que conserva bien la energía.
- Las velocidades más altas hacen más subpasos, no pasos más grandes.
- Gravedad por suma directa O(n²) con un suavizado mínimo para evitar divisiones por cero.
- **Límite de 40 cuerpos.** Las partículas de los anillos son solo visuales y no cuentan.

### 4.2 Escala visible y radio de choque
- Las distancias son reales. Los radios se dibujan aumentados para que se vean:
  - Planetas y lunas: `radioVisual = radioReal × 10`.
  - Estrellas: `radioVisual = radioReal × 5`.
  - Los factores son ajustables en una constante. No pueden ser mayores sin que las lunas queden dentro de su planeta (con ×10, la Luna, a su distancia real de 0,00257 UA, queda a unos 6 radios visuales de la Tierra).
- **El radio de choque es el radio visual:** si se ven tocarse, chocan.
- En el zoom lejano, un cuerpo de menos de 4 px se dibuja como un punto con su nombre.

### 4.3 Órbita automática
- **Planeta:** v = √(G·M/r), perpendicular al radio y en sentido antihorario visto desde +y, donde M es la masa de la estrella (o la suma de las dos en un sistema doble) y r la distancia a su centro de masas.
- **Luna:** la velocidad del planeta más la velocidad circular relativa alrededor del planeta. Solo se permite entre 1,2 × el límite de Roche y 0,5 × el radio de Hill del planeta.
- **Sistema doble:** aviso ⚠ si r < 3 × la separación entre las estrellas.

### 4.4 Eventos

| Evento | Condición | Resultado |
|---|---|---|
| Fusión | Dos cuerpos se solapan con v_rel < 1,5 · v_esc mutua | Un solo cuerpo. Conserva masa y momento. Radio según la suma de volúmenes. Atmósfera y agua mezcladas por masa. Conserva el nombre y la apariencia del más masivo. |
| Fragmentación | Solapan con v_rel ≥ 1,5 · v_esc | El cuerpo mayor conserva su masa más el 50 % de la del menor. El otro 50 % se reparte en 3 a 6 escombros rocosos, sin pasar del límite de cuerpos. Se conservan la masa y el momento. Si no queda sitio para ningún escombro, se trata como una fusión. |
| Ruptura por marea | Una luna está dentro del límite de Roche de su planeta: d < 2,44 · R_planeta · (ρ_planeta/ρ_luna)^(1/3), usando radios visuales | La luna se elimina, su masa pasa al planeta y aparece un anillo (radios interior y exterior alrededor de d). Si ya había anillo, se amplía. |
| Absorción | Un cuerpo se solapa con una estrella | La estrella suma su masa. |
| Expulsión | Distancia al centro de masas > máx(50 UA, 10 × el borde exterior de la zona habitable) y energía orbital positiva | Se elimina el cuerpo y aparece el aviso «X ha sido expulsado». |

Todos los eventos generan un aviso con el botón **Ver** y un efecto visual.

### 4.5 Temperatura
- T_eq = 255 K · L^(1/4) / √d (temperatura de equilibrio con albedo 0,3; L en L☉ y d en UA).
- T = T_eq + 100 K · atmósfera^0,9. Con atmósfera 0,3 suma ≈ 34 K, así que la Tierra da ≈ 289 K; con atmósfera 1 suma 100 K.
- Con dos estrellas se suman los flujos de luz.
- Se usa la **media móvil exponencial** de T con constante ≈ 1 periodo orbital, para que no cambie de golpe en órbitas excéntricas.

### 4.6 Habitabilidad
Un cuerpo es habitable si cumple todo esto:
- 273 K ≤ T_media ≤ 373 K.
- agua > 0,05.
- Es rocoso, con 0,1 M⊕ ≤ masa ≤ 10 M⊕.
- Excentricidad < 0,2, medida respecto a su cuerpo central.

Las lunas pueden ser habitables. El anillo verde de la zona habitable se calcula con T entre 273 y 373 K para una atmósfera de 0,3.

La ficha muestra el motivo si un cuerpo no es habitable: «demasiado frío», «demasiado caliente», «sin agua», «gaseoso», «muy pequeño», «muy grande» u «órbita inestable».

### 4.7 Etapas de vida
- Etapas: Sin vida → **Océanos (20 años)** → **Microbios (50)** → **Plantas (100)** → **Animales (200)** → **Civilización (400)**. El número es el tiempo simulado, mientras el cuerpo sea habitable, necesario para pasar a la siguiente etapa.
- Retroceso:
  - Si el cuerpo deja de ser habitable, tiene 5 años de margen y después pierde una etapa cada 10 años.
  - Una fusión con otro cuerpo de más del 10 % de su masa lo devuelve a Océanos (o a Sin vida si ya no es habitable).
  - Una fragmentación en la que participa le quita 2 etapas.
- Al subir o bajar de etapa, el progreso de la nueva etapa empieza en 0.

### 4.8 Fuera de la primera versión
Muerte o evolución de las estrellas, calentamiento de las lunas por marea, asteroides y cometas, órbitas inclinadas y lanzamiento manual con tirachinas.

## 5. Gráficos y rendimiento

### 5.1 Representación (todo procedural, sin imágenes externas)
- **Rocoso:** ruido 3D en el shader para los continentes, con el umbral de océano según el agua. Hielo polar si T < 260 K y superficie quemada si T > 373 K. Capa de nubes que gira (esfera aparte).
- **Gaseoso o helado:** bandas por latitud con turbulencia de ruido y tormentas.
- **Atmósfera:** halo brillante en el borde, con el grosor y la opacidad según la atmósfera.
- **Estrella:** superficie emisiva animada, sprite de brillo y luz puntual que ilumina los planetas (día y noche). Color según el tipo.
- **Anillos:** disco de partículas instanciadas, más un anillo semitransparente en calidad Baja.
- **Zona habitable:** anillo verde translúcido en y = 0.
- **Estelas:** las últimas N posiciones de cada cuerpo en una línea que se desvanece.
- **Fondo:** campo de puntos estelares y una franja tenue de vía láctea.
- **Vida visible:**
  - Océanos: el océano se vuelve azul intenso.
  - Plantas: verde en los continentes.
  - Civilización: luces de ciudades en el lado de noche.
- **Efectos:** destello y partículas en los choques, partículas al formarse un anillo.
- **Escala:** zoom logarítmico. La escena se recoloca alrededor del objetivo de la cámara para evitar temblores, y la física usa doble precisión.

### 5.2 Calidad

| | Alta | Media | Baja |
|---|---|---|---|
| Resolución (máx. pixelRatio) | 2 | 1,5 | 1 |
| Brillo (*bloom*) | Sí | Sí, a media resolución | No |
| Segmentos de esfera | 64 | 48 | 24 |
| Longitud de estela | 400 | 200 | 80 |
| Partículas de anillo | 20 000 | 8 000 | Solo anillo |

Empieza en Media. Si la media de fps baja de 45 durante 3 s, la calidad baja un nivel. También se puede cambiar a mano en Ajustes.

### 5.3 Rendimiento
- Objetivo: 60 fps en un Android de gama media de 2021 o posterior, y como mínimo 30 fps.
- La física tiene un presupuesto de **6 ms por fotograma**.
- No se crean objetos en el bucle principal (se reutilizan vectores).
- Se pausa con `visibilitychange` o con el evento de pausa de Capacitor.

## 6. Interfaz y controles

### 6.1 Vista principal
- **Barra superior:** nombre del sistema, años simulados, «🌍 con vida: n» y menú (Guardar, Cargar, Ajustes, Salir).
- **Abajo a la izquierda:** controles de tiempo con la velocidad real.
- **Abajo a la derecha:** botón ＋, que abre el editor.
- **Avisos:** mensajes que se apilan, con el botón Ver.

### 6.2 Gestos

| Gesto | Acción |
|---|---|
| Arrastrar con 1 dedo | Girar la cámara |
| Pellizcar | Zoom |
| Arrastrar con 2 dedos | Mover la vista |
| Tocar un cuerpo | Seleccionar y abrir la ficha |
| Doble toque en un cuerpo | Seguirlo con la cámara |
| Tocar el espacio vacío | Deseleccionar |
| Botón ⌖ | Encuadrar todo el sistema |

### 6.3 Ficha del cuerpo
Panel inferior que ocupa media pantalla.
- **Info:** masa, radio, distancia, periodo, excentricidad, temperatura, si es habitable (con el motivo) y la etapa con su barra de progreso.
- **Editar:** el editor de 2.3.
- **Botones:** Seguir con cámara y Eliminar.

### 6.4 Otros
- **Guardado:** 5 ranuras con miniatura y guardado automático cada 30 s y al salir. Formato JSON versionado (`version: 1`) en `localStorage`.
- **Tutorial:** 4 pasos la primera vez (elegir estrella, añadir planeta, acelerar el tiempo, ver la vida). Se puede saltar.
- **Pantalla:** vertical (la principal) y horizontal.
- **Toque:** botones de al menos 48 dp. Vibración breve en choques y al subir de etapa (Capacitor Haptics; en el navegador, `navigator.vibrate`).

## 7. Pruebas

Tests de Vitest para `sim/`, `life/` y `storage/`:
- La Tierra a 1 UA del Sol tiene un periodo de 1 año (±0,5 %).
- La energía total cambia menos de un 0,1 % tras 1 000 órbitas.
- La órbita automática tiene una excentricidad menor de 0,01.
- La fusión conserva la masa y el momento. La fragmentación conserva la masa.
- Una luna dentro del límite de Roche se convierte en anillo.
- Se detecta la expulsión de un cuerpo con velocidad de escape.
- La Tierra con atmósfera 0,3 da T ≈ 288 K (±3 K).
- Las etapas suben y bajan con los tiempos de 4.7.
- Guardar y cargar un sistema lo deja igual.

Pruebas manuales en Chrome del PC (vista de móvil) y en el Android del usuario después de cada fase.

## 8. Entregas por fases
1. Proyecto base: estrella y un planeta en 3D con los gestos de cámara.
2. Física N cuerpos, colocación en órbita automática y controles de tiempo.
3. Editor de planetas y lunas, y ficha.
4. Eventos: fusión, fragmentación, anillo, absorción y expulsión.
5. Temperatura, zona habitable y etapas de vida, con sus efectos visuales.
6. Gráficos pulidos: shaders, brillo y calidad automática.
7. Menús, guardado, tutorial y vibración.
8. APK con Capacitor.

**Pruebas en el móvil durante el desarrollo:** `vite --host` y abrir `http://<IP-del-PC>:5173` en Chrome de Android, en la misma WiFi. No se puede instalar como PWA porque la red local no es una dirección segura (HTTPS).

**APK:** el usuario instala Android Studio (trae JDK y SDK) una sola vez. Luego se ejecutan `npx cap add android` y `gradlew assembleDebug`, y el APK de pruebas se instala por USB o copiando el archivo. Publicar en Google Play requiere firmarlo y una cuenta de desarrollador; queda fuera de este alcance.

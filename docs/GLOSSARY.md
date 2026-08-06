# ðŸ“– Threshold â€” Diccionario TÃ©cnico

> Glosario exhaustivo de todos los tÃ©rminos, jerga, patrones y conceptos que aparecen en el desarrollo de Threshold.
> Cubre: arquitectura, sincronizaciÃ³n, base de datos, UI/UX, IA, dominio de conocimiento, infraestructura, DevOps y patrones generales de IngenierÃ­a de Software aplicados en la app.
> Ãšltima actualizaciÃ³n: Agosto 2026.

---

## Ã�ndice

- [A](#a) Â· [B](#b) Â· [C](#c) Â· [D](#d) Â· [E](#e) Â· [F](#f) Â· [G](#g) Â· [H](#h) Â· [I](#i) Â· [J](#j) Â· [K](#k) Â· [L](#l) Â· [M](#m) Â· [N](#n) Â· [O](#o) Â· [P](#p) Â· [Q](#q) Â· [R](#r) Â· [S](#s) Â· [T](#t) Â· [U](#u) Â· [V](#v) Â· [W](#w) Â· [Z](#z) Â· [AcrÃ³nimos](#apÃ©ndice--acrÃ³nimos-rÃ¡pidos)

---

## A

### AbortController
API nativa del runtime que permite cancelar operaciones asÃ­ncronas en curso (fetch, timers). En Threshold se usa en `findAvailableBackendParallel()` para abortar los checks de backend perdedores una vez que el primero responde con 200.

### Active Recall (Recuerdo Activo)
PrÃ¡ctica cognitiva de forzar al cerebro a recuperar informaciÃ³n de la memoria sin pistas externas (ej. voltear una flashcard de Threshold). Es el pilar del sistema de aprendizaje junto a la repeticiÃ³n espaciada.

### ADR (Architecture Decision Record)
Documento formal que registra una decisiÃ³n arquitectÃ³nica importante: el contexto, las opciones consideradas y la decisiÃ³n tomada. Ejemplo: `ADR-012-DashboardBootPipeline.md`. Sirven como memoria histÃ³rica del "por quÃ©" de cada decisiÃ³n.

### Aggregate / Aggregate Root
Concepto de Domain-Driven Design (DDD). Un agregado es un clÃºster de entidades y *Value Objects* tratados como una unidad con sus propias invariantes. El *Aggregate Root* es la entidad principal a travÃ©s de la cual interactÃºan agentes externos. En Threshold, `Subject` actÃºa casi como un Aggregate Root para un curso entero.

### AI Capability
AbstracciÃ³n dentro del `AIOrchestrator` que encapsula una capacidad de IA especÃ­fica. Hay 5 en Threshold: **Chat**, **Flashcard** (generaciÃ³n), **OCR**, **PDF** (extracciÃ³n) y **Transcription** (audio). Cada Capability conoce sus proveedores disponibles y cÃ³mo invocarlos.

### AI Execution Policy
Conjunto de reglas que determinan cÃ³mo se ejecuta una operaciÃ³n de IA. Tiene 6 modos: `local-only`, `cloud-only`, `local-preferred`, `cloud-preferred`, `fastest`, `cheapest`. La polÃ­tica se configura segÃºn el Device Tier y la conectividad.

### AI Orchestrator
MÃ³dulo central (`AIOrchestrator.ts`) que coordina todas las capacidades de IA. Decide quÃ© proveedor usar (local vs. cloud) segÃºn la `AIExecutionPolicy`. Los consumidores solo conocen el Orchestrator, nunca a Groq, Gemini ni llama directamente.

### ALTER TABLE
Comando SQL que modifica la estructura de una tabla existente (agrega columnas, cambia tipos). Las migraciones de Threshold usan `ALTER TABLE ... ADD COLUMN`. Se verifica con `PRAGMA table_info` antes para evitar errores de columna duplicada.

### Ancla Cognitiva
TÃ©rmino acuÃ±ado en Threshold para referirse a un tipo especial de flashcard o elemento de diseÃ±o destinado a diferenciar, contrastar y desambiguar tÃ©rminos confusos o muy similares dentro de un mazo. ActÃºa anclando la diferencia especÃ­fica en la memoria del estudiante.

### Arquitectura Limpia (Clean Architecture)
Paradigma de diseÃ±o donde las reglas de negocio (Dominio) estÃ¡n en el centro absoluto, aisladas rigurosamente de los detalles de implementaciÃ³n como la UI, la red o la base de datos, lo que permite cambiar herramientas sin reescribir el negocio.

### Assessment (EvaluaciÃ³n)
Entidad del dominio que representa un examen, parcial, entrega universitaria o hito. Genera notificaciones automÃ¡ticas y se vincula fuertemente al Reminder Engine para proyectar alertas regresivas.

### AsyncStorage
LibrerÃ­a de React Native para almacenamiento clave-valor asÃ­ncrono. En Threshold se usa como **cachÃ© HTTP con TTL de 10 minutos** para respuestas GET. MÃ¡s lento que MMKV (basado en JS). Considerado **legacy** frente a MMKV.

### Asset
Archivo binario que pertenece a un usuario: foto, grabaciÃ³n de audio, documento escaneado. A diferencia de los metadatos (JSON), los assets siguen el **Asset Pipeline** en lugar del Sync Protocol estÃ¡ndar.

### Asset Entity Pattern
PatrÃ³n de sincronizaciÃ³n para entidades que contienen un binario. La entidad se divide en: (1) **Metadata** â†’ Sync Protocol como JSON, (2) **Binario (blob)** â†’ Asset Pipeline. La `cloud_url` sÃ­ se sincroniza; la `local_uri` nunca.

### Asset Locality Invariant
Invariante arquitectÃ³nico: ningÃºn dato especÃ­fico del dispositivo puede sincronizarse. `local_uri`, rutas absolutas, cachÃ©s locales y permisos del SO quedan excluidos del Sync Protocol.

### Asset Pipeline
Infraestructura de sincronizaciÃ³n para archivos binarios. Orquestada por `AssetSyncEngine`. Incluye: `AssetUploadManager` (2 concurrentes, retry exponencial), `AssetDownloadManager` (3 concurrentes, prioridades, resume), `PersistentLocalAssetStore` (LRU 3GB) y `AssetValidator` (checksum post-descarga).

### AssetDownloadManager
Gestiona las descargas de binarios desde la nube. Admite 3 descargas concurrentes, verifica checksums, asigna prioridades y puede reanudar descargas interrumpidas.

### AssetSyncEngine
Orquestador del Asset Pipeline (`AssetSyncEngine.ts`). Coordina uploads y downloads de binarios de forma separada al sync JSON. Se integra como fase paralela dentro del `SyncManager`.

### AssetUploadManager
Gestiona las subidas de binarios a la nube. Admite 2 uploads concurrentes con retry exponencial ante fallos de red.

### AssetValidator
Verifica la integridad de los assets descargados calculando y comparando checksums. Detecta archivos corruptos post-descarga.

### At-least-once Delivery
GarantÃ­a del Sync Protocol: toda operaciÃ³n en la cola se reintentarÃ¡ hasta 5 veces antes de descartarse. Puede causar que el servidor reciba la misma operaciÃ³n mÃ¡s de una vez, lo que se maneja con idempotencia.

### Atomic Card Generator
Utilitario backend (`atomicCardGenerator.js`) que fragmenta automÃ¡ticamente flashcards con demasiado contenido en tarjetas mÃ¡s pequeÃ±as y atÃ³micas, optimizadas para la retenciÃ³n cognitiva.

### AudioSynchronizer
ImplementaciÃ³n de `EntitySynchronizer` para grabaciones de audio. Extiende el Asset Entity Pattern aplicado a `audio_recordings`.

---

## B

### Backend
Servidor API REST construido en **Node.js + Express** (JavaScript CommonJS). No es la fuente de verdad: es un mecanismo de sincronizaciÃ³n, respaldo y continuidad entre dispositivos. La lÃ³gica de dominio vive en el mÃ³vil.

### Barrel File (`index.ts`)
Archivo que consolida y re-exporta mÃºltiples mÃ³dulos de un directorio. En Threshold, se debe tener especial cuidado al usarlos porque pueden causar *Require Cycles* indeseados.

### BaseRepository
Clase base (`BaseRepository.ts`) que implementa operaciones CRUD sobre SQLite para todos los repositorios. Proporciona: `insert()`, `update()` (con auto-incremento de `version_number`), `delete()`, `findById()`, `findAll()`. Siempre emite eventos al `RepositoryEventBus` tras cada mutaciÃ³n.

### bcrypt
Algoritmo de hashing para contraseÃ±as. El backend usa `bcrypt` con salt rounds configurables. Nunca se almacenan contraseÃ±as en texto plano.

### Blueprint
Plano o diseÃ±o arquitectÃ³nico fundamental. En Threshold, los "Blueprints" son los documentos fundacionales (como `SYNC_PROTOCOL.md` o `NOTIFICATION_ARCHITECTURE.md`) que definen inexorablemente cÃ³mo deben estructurarse los motores lÃ³gicos o componentes antes de que una sola lÃ­nea de cÃ³digo sea escrita.

### Boilerplate
Secciones de cÃ³digo repetitivo y rÃ­gidamente estructurado que se requiere incluir en mÃºltiples lugares. Threshold usa Zustand y custom React Hooks para minimizar el boilerplate comparado con alternativas como Redux.

### Bootstrap
Proceso de arranque de la aplicaciÃ³n orquestado por `BootstrapManager.ts`. Fases: **DB** (SQLite + migraciones) â†’ **MMKV** (hydration) â†’ **READY** (loadAllData) â†’ **NETWORK** (fire-and-forget) â†’ **SYNC** (fire-and-forget). La red **nunca bloquea** el arranque.

### BootstrapManager
MÃ³dulo (`BootstrapManager.ts`) que orquesta las fases del bootstrap. Garantiza que la UI estÃ© lista antes de que la red responda. Emite el estado `READY` cuando SQLite y MMKV estÃ¡n disponibles.

### Bottom Sheet
Componente UI modal que emerge desde la base de la pantalla. Es el patrÃ³n visual primario en Threshold para presentar menÃºs contextuales, selectores rÃ¡pidos y pequeÃ±os formularios (`BottomSheetModal`).

### Bridge (React Native)
Sistema legacy de React Native donde JS y los mÃ³dulos nativos se comunican asÃ­ncronamente mediante mensajes serializados en JSON. En Threshold, estÃ¡ siendo reemplazado por JSI vÃ­a la New Architecture.

### Bundle ID
Identificador Ãºnico de la app en los stores. En Threshold: `com.oponobono.threshold`.

### Bytecode
RepresentaciÃ³n intermedia de cÃ³digo JavaScript compilada por **Hermes** antes de ejecutarse. Reduce radicalmente el tiempo de startup.

---

## C

### Cache Policy Manager
`CachePolicyManager.ts` â€” mÃ³dulo que determina cuÃ¡nto tiempo viven los datos en cachÃ© segÃºn el tipo de entidad y el estado de conectividad.

### Card Log
Registro histÃ³rico de cada sesiÃ³n de repaso de una flashcard (`card_logs`). **No es una entidad sincronizable** â€” es auditorÃ­a pura. No tiene `sync_version` ni `deleted_at`. Se conserva indefinidamente incluso si el card padre es borrado. Fuente de verdad para analytics y mÃ©tricas FSRS histÃ³ricas.

### Cascade (Delete)
PropagaciÃ³n de un borrado desde una entidad padre a todas sus entidades hijas. Ejemplo: borrar un `subject` tambiÃ©n borra sus `courses`, `flashcard_decks`, `assessments`, `ai_chats`, `audio_recordings`, `scanned_documents` y `youtube_transcripts`. Cada hijo tambiÃ©n se registra en `sync_deletions`.

### CDN (Content Delivery Network)
Red de servidores distribuidos que sirven archivos estÃ¡ticos con baja latencia. En Threshold, **UploadThing** actÃºa como CDN para fotos, documentos y audios.

### Checksum
Valor hash calculado sobre el contenido de un archivo para verificar su integridad. El `AssetValidator` calcula y compara checksums post-descarga para descartar corrupciÃ³n.

### CI/CD (Continuous Integration / Continuous Delivery)
Flujo automatizado de integraciÃ³n y despliegue. En Threshold: **GitHub Actions** ejecuta la Reminder Regression Suite (275 tests) en cada push. **EAS Build** automatiza los builds nativos.

### CommonJS
Sistema de mÃ³dulos de Node.js. El backend usa `"type": "commonjs"` â€” los archivos usan `require()` y `module.exports` en lugar del `import/export` de los ES Modules.

### Componente (Component)
Bloque de construcciÃ³n fundamental en React Native (archivos `.tsx`). En contraste con un *MÃ³dulo*, un Componente UI se enfoca estrictamente en la capa de presentaciÃ³n (renderizado visual, inputs del usuario) y jamÃ¡s debe procesar lÃ³gica de dominio pesada ni orquestar a la base de datos.

### Concurrency (Concurrencia)
EjecuciÃ³n simultÃ¡nea o intercalada de mÃºltiples tareas. Threshold maneja concurrencia controlada en la descarga de assets (vÃ­a `AssetDownloadManager`), limitando los hilos simultÃ¡neos para no ahogar la red ni agotar la memoria.

### ConflictResolver
MÃ³dulo (`ConflictResolver.ts`) que resuelve conflictos de sincronizaciÃ³n entre la versiÃ³n local y la del servidor. Implementa 4 estrategias: `LAST_WRITE_WINS`, `SERVER_WINS`, `CLIENT_WINS` y `MERGE`.

### Confidence Score
MÃ©trica del dominio de conocimiento que representa quÃ© tan seguro es el sistema sobre el nivel de dominio del usuario en un tema. Se calcula a partir de datos FSRS y se expone a travÃ©s del `KnowledgeSnapshot`.

### ConsistencyReport
Herramienta (`ConsistencyReport.ts`) que verifica la convergencia del Sync Engine comparando el conteo de filas por tabla entre el backend y todos los dispositivos simulados.

### Contrato (Contract)
Conjunto inquebrantable de reglas y firmas que define cÃ³mo se comunican dos piezas de software (ej. entre un MÃ³dulo y el Dominio, o entre Cliente y API). En Threshold, los "Contratos ArquitectÃ³nicos" (ej. `Sync Entity Contract`, `KnowledgeProvider`) gobiernan el diseÃ±o de los motores, prohÃ­ben el acoplamiento sucio y dictan quÃ© mÃ©todos y payloads son aceptables.

### Convergence Score
MÃ©trica que mide quÃ© tan alineados estÃ¡n los datos entre dispositivos tras una sincronizaciÃ³n. Un score de 100% indica convergencia total.

### CORS (Cross-Origin Resource Sharing)
Mecanismo HTTP que controla quÃ© dominios pueden hacer requests al backend. El backend usa el paquete `cors` configurado para permitir solo orÃ­genes autorizados.

### Course
Entidad del dominio que representa una materia/asignatura universitaria asociada a un semestre o periodo acadÃ©mico. Es hija de `subject`. Entidad sincronizable.

### Course Hub
Funcionalidad que agrupa las materias en un acordeÃ³n visual (`CourseAccordion`, `CourseSubjectCard`), calcula el `aggregatedMomentumScore` y aplica `momentum decay`.

### CRUD
AcrÃ³nimo para las 4 operaciones bÃ¡sicas sobre persistencia: **C**reate, **R**ead, **U**pdate, **D**elete. Cada entidad sincronizable tiene CRUD completo tanto local (SQLite) como remoto (API REST).

### Curva del Olvido (Forgetting Curve)
Modelo matemÃ¡tico de Ebbinghaus que describe cÃ³mo decae y se esfuma la retenciÃ³n de memoria con el tiempo si no hay repaso. FSRS en Threshold se basa Ã­ntegramente en aplanar y domar esta curva para cada flashcard.

---

## D

### Data Loader
`DataLoader.ts` â€” mÃ³dulo que carga todos los datos necesarios durante el bootstrap desde SQLite hacia los stores Zustand. Se ejecuta en la fase READY.

### DataStore
Capa de abstracciÃ³n de datos que agrupa Repositories y Queries. La UI siempre consume datos a travÃ©s de DataStore, Repositories o Queries â€” **nunca directamente desde `services/api`**.

### Debouncing
TÃ©cnica que agrupa una rÃ¡faga de eventos rÃ¡pidos (ej. inputs de teclado veloces) en uno solo que se ejecuta despuÃ©s de que transcurra un tiempo *sin* nuevos eventos. Previene operaciones costosas redundantes.

### Deep Linking
Mecanismo que permite abrir una pantalla especÃ­fica de la app desde una URL externa o desde otra app usando un schema (ej. `threshold://`).

### Deletion Version (`deletion_version`)
NÃºmero de versiÃ³n asignado a cada entrada en `sync_deletions`. Es el criterio principal para que otros dispositivos descubran quÃ© fue borrado. `deleted_at` es solo metadata de auditorÃ­a â€” **toda decisiÃ³n de sync usa `deletion_version`**.

### Delta Sync
SincronizaciÃ³n incremental: solo descarga las entidades cuyo `sync_version` es mayor al Ãºltimo conocido por el cliente. Endpoint: `GET /api/sync/delta?version=N`.

### Dependency Injection (DI)
PatrÃ³n de diseÃ±o donde un objeto recibe pasivamente aquellos objetos de los que depende en lugar de crearlos Ã©l mismo. Ejemplo: FSRS recibe la fecha actual en lugar de ejecutar `new Date()` interno, garantizando su determinismo.

### Dependency Resolver
MÃ³dulo (`DependencyResolver.ts`) del `SyncQueueReducer` que ordena topolÃ³gicamente las operaciones reducidas para respetar el orden causal: subject se debe crear antes que su course, y course antes que su flashcard-deck.

### Design Token
Variable del sistema de diseÃ±o que representa un valor semÃ¡ntico (color, tipografÃ­a, espaciado). Se definen en `src/styles/theme.ts`. Los componentes usan tokens, no valores hardcodeados para garantizar consistencia.

### Device Tier
ClasificaciÃ³n del dispositivo segÃºn su RAM **total** en: `low`, `medium` o `high`. Determina la `AIExecutionPolicy` activa. 

### Docusaurus
Framework de generaciÃ³n de sitios estÃ¡ticos basado en React, mantenido por Meta. Se utiliza en Threshold para construir, estructurar y publicar la documentaciÃ³n tÃ©cnica, arquitectÃ³nica y de producto (incluyendo este diccionario).

### Domain (Dominio)
Esfera de conocimiento, reglas, procesos e invariantes alrededor de la cual gira la lÃ³gica de la aplicaciÃ³n (ej. Learning Domain, Reminder Domain). En Threshold, operar sobre el dominio significa ir mÃ¡s allÃ¡ de un simple CRUD, integrando reglas de negocio rigurosas.

### Domain-Driven Design (DDD)
Enfoque de arquitectura de software aplicado fuertemente en Threshold. Separa las responsabilidades en dominios aislados, enfocÃ¡ndose en modelar la lÃ³gica profunda del negocio y desacoplando estrictamente la capa de infraestructura (red, BD) y la capa de presentaciÃ³n (UI).

### Domain Service
Clase que orquesta la lÃ³gica de negocio profunda de una entidad. `FlashcardDomainService` es el Ãºnico autorizado para modificar los metadatos FSRS. Los Domain Services no conocen la capa de red ni la UI.

### dotenv
LibrerÃ­a que carga variables de entorno desde un archivo `.env`. El backend la usa para mantener credenciales de manera segura.

### DTO (Data Transfer Object)
Objeto "tonto" utilizado para empaquetar datos y enviarlos de un subsistema a otro (ej. de Backend a MÃ³vil). Los DTOs no tienen comportamiento, mÃ©todos ni lÃ³gica interna; son puramente valijas de transporte estructurado.

### Dual Write
TÃ©cnica de migraciÃ³n donde el backend escribe datos en dos formatos simultÃ¡neamente para garantizar compatibilidad hacia atrÃ¡s durante una transiciÃ³n crÃ­tica.

---

## E

### EAS (Expo Application Services)
Plataforma cloud de Expo para builds y publicaciones. **EAS Build** compila el APK/IPA en la nube; **EAS Submit** lo publica en Google Play o App Store.

### End-to-End (E2E) Testing
Pruebas que validan un sistema entero de principio a fin, simulando el flujo completo de un usuario en un entorno muy cercano a la producciÃ³n.

### Engine (Motor)
En la nomenclatura de Threshold, un Engine es un sistema lÃ³gico autÃ³nomo responsable de una tarea sistÃ©mica masiva, de alta complejidad computacional o de orquestaciÃ³n en background. Sus ramificaciones tocan toda la app. Ej: `Reminder Engine`, `Sync Engine`, `Grading Engine`.

### Entity (Entidad)
Concepto de DDD: Un objeto que tiene una identidad constante a travÃ©s del tiempo y que puede modificarse (mutar sus propiedades), a diferencia de un *Value Object* que es inmutable.

### Entity Synchronizer
Interfaz abstracta (`EntitySynchronizer.ts`) que define el contrato para sincronizar un tipo especÃ­fico de entidad. Las implementaciones concretas son `PhotoSynchronizer`, `AudioSynchronizer`, `DocumentSynchronizer`.

### Event Bus
Sistema de comunicaciÃ³n pub/sub que desacopla emisores de consumidores. En Threshold: `RepositoryEventBus` (mutaciones de BD â†’ stores Zustand) y `OperationProgressEmitter` (progreso de LROs â†’ UI + notificaciones).

### Expo
SDK y ecosistema de herramientas que simplifica el desarrollo React Native. Provee mÃ³dulos nativos precompilados, el sistema de build EAS y el Router basado en archivos.

### Expo Router
Sistema de routing basado en archivos para React Native (similar a Next.js). Las rutas se definen por la estructura de carpetas en `/app`. Soporta typed routes y deep linking automÃ¡tico.

### expo-secure-store
MÃ³dulo de Expo que guarda datos sensibles en el **Keychain** (iOS) o **Keystore** (Android). Almacena los JWT tokens. Es el Ãºnico lugar donde se guardan secretos en texto plano.

### expo-sqlite
MÃ³dulo de Expo que expone SQLite nativo en Android e iOS. Es la fuente de verdad local de Threshold para todos los datos estructurados del dominio.

---

## F

### Fabric (Renderer)
Nuevo sistema de renderizado de React Native (New Architecture). Reemplaza al renderizador JavaScript-based por uno que se comunica directamente con el hilo UI nativo a travÃ©s de JSI.

### Feature Flag / Feature Toggle
TÃ©cnica de ingenierÃ­a que permite encender o apagar bloques funcionales enteros de la aplicaciÃ³n (ej. una nueva vista IA) dinÃ¡micamente sin necesidad de compilar o desplegar un binario nuevo en las tiendas.

### Feature Matrix
Documento (`FEATURE_MATRIX.md`) que mapea cada entidad del sistema a sus capacidades: lifecycle, estado, relaciones, capacidades IA y soporte offline. Toda entidad nueva debe completarla antes de implementarse.

### FIFO (First In, First Out)
PolÃ­tica de cola donde el primer elemento en entrar es el primero en salir. La `sync_queue` local funciona como una cola FIFO para operaciones pendientes.

### File-based Routing
Paradigma de Expo Router donde la estructura de carpetas en `/app` define automÃ¡ticamente las rutas, reduciendo el boilerplate de configuraciÃ³n.

### Fire-and-forget
PatrÃ³n donde se inicia una operaciÃ³n asÃ­ncrona pero la aplicaciÃ³n no se detiene a esperar su resultado. En el bootstrap, la detecciÃ³n de la red (`NETWORK`) y el sync (`SYNC`) son fire-and-forget.

### Flashcard
Tarjeta de estudio con frente y reverso. Son entidades sincronizables atadas rigurosamente a metadatos FSRS (`fsrs_stability`, `fsrs_difficulty`, `next_review_date`).

### Flashcard Deck (Mazo)
Entidad lÃ³gica (`flashcard_decks`) que agrupa colecciones de flashcards bajo el paraguas de un `Subject`. Sirve como el contenedor primario de estudio secuencial y aloja tanto *Anclas Cognitivas* como tarjetas atÃ³micas.

### FlashcardDomainService
Domain Service que es la **Ãºnica autoridad** para modificar los metadatos FSRS de una flashcard. Calcula el nuevo estado, persiste en SQLite, emite eventos y encola la operaciÃ³n en el Sync Engine.

### FlashList
Componente de lista de ultra-alto rendimiento desarrollado por Shopify. En Threshold, reemplaza a `FlatList` para renderizar colecciones masivas (ej. flashcards o subjects), reutilizando vistas en memoria para no dropear frames a 60 fps.

### Foreign Key (FK)
RestricciÃ³n de base de datos que referencia la clave primaria de otra tabla impidiendo orphan data. En SQLite se deben activar explÃ­citamente encendiendo `PRAGMA foreign_keys = ON`.

### FSRS (Free Spaced Repetition Scheduler)
Algoritmo de repeticiÃ³n espaciada v4.5. Calcula cuÃ¡ndo mostrar una flashcard basÃ¡ndose en `stability` (durabilidad de la memoria) y `difficulty` (dificultad de recordar). Es la **Ãºnica fuente de verdad del conocimiento** en Threshold.

### FSRS Difficulty
ParÃ¡metro FSRS (`fsrs_difficulty`) que representa quÃ© tan difÃ­cil le resulta al usuario recordar un concepto. Oscila matemÃ¡ticamente, y mayor dificultad â†’ intervalos mÃ¡s cortos.

### FSRS Repetitions
Contador de repasos realizados sobre una flashcard (`fsrs_repetitions`). Usado por FSRS para la proyecciÃ³n del intervalo subsecuente.

### FSRS Stability
ParÃ¡metro FSRS (`fsrs_stability`) que representa quÃ© tan estable o longeva es la memoria del usuario sobre un concepto. Mayor estabilidad â†’ intervalos mÃ¡s largos.

---

## G

### GGUF
Formato de archivo binario y serializado para modelos de lenguaje cuantizados. Los modelos de Zyren en modo offline (Llama, Phi, Mistral) se cargan en este formato ultraligero a travÃ©s de `llama.rn`.

### Ghost Deletion (borrado fantasma)
Bug que ocurre cuando un dispositivo hace DELETE + CREATE de la misma entidad de manera rÃ¡pida pero el registro en `sync_deletions` no se limpia. Al sincronizar, otros dispositivos aplican el DELETE ciegamente y eliminan la entidad reciÃ©n creada. Se previene llamando `removeDeletion()` tras un RESTORE.

### Glassmorphism
EstÃ©tica de diseÃ±o UI que simula vidrio esmerilado: fondos con blur, transparencia y bordes sutiles con luz direccional. Usado en overlays y modales de Threshold para aportar un feel orgÃ¡nico y premium.

### Grading Engine
Servicio backend (`gradingEngine.js`) que traduce y normaliza calificaciones entre diferentes sistemas (0-5, 0-10, 0-100, letras de USA), operando como motor de conversiÃ³n acadÃ©mica.

### Groq
Proveedor cloud de inferencia LLM ultra-rÃ¡pida (LPU). El backend usa la API REST de Groq con modelos `llama-3.3-70b-versatile` (principal) y `llama-3.1-8b-instant` (fallback).

---

## H

### Haptic Feedback
RetroalimentaciÃ³n tÃ¡ctil del dispositivo (vibraciones del motor hÃ¡ptico). Threshold lo emplea sutilmente en transiciones crÃ­ticas para confirmar interacciones fÃ­sicas (`expo-haptics`).

### Helmet
Middleware de Express en el backend que configura headers HTTP de seguridad: CSP, HSTS, X-Frame-Options, previniendo vectores comunes como clickjacking o XSS.

### Hermes
Motor de JavaScript optimizado para React Native por Meta. Compila JS a bytecode (AOT) durante el build, reduciendo la penalidad inicial del startup de la app. Activo obligatoriamente en RN 0.81.

### Hook (React)
FunciÃ³n de React que inyecta estado y side-effects en componentes funcionales. Threshold posee docenas de hooks personalizados en `src/hooks/` aislando la complejidad.

### Hook de Dominio
Un React Hook especÃ­fico (ej. `useKnowledgeInsights`) que trasciende al manejo simple de estado UI. Encapsula la suscripciÃ³n profunda al EventBus y efectÃºa llamadas directas a un Contrato (KnowledgeProvider), entregando informaciÃ³n de negocio pre-masticada a las pantallas.

### HSL (Hue, Saturation, Lightness)
Modelo de color preferible a RGB/HEX porque permite ajustar paramÃ©tricamente el brillo o saturaciÃ³n garantizando paletas armoniosas sin requerir diseÃ±o ad-hoc.

### HSTS (HTTP Strict Transport Security)
Header HTTP emitido por el backend que obliga a los navegadores o clientes API a comunicarse vÃ­a HTTPS exclusivamente, denegando el downgrade HTTP.

### HTTP Cache
CachÃ© de nivel de transporte para reducir ancho de banda. Threshold la implementa mediante AsyncStorage para respuestas GET idÃ©nticas (TTL: 10 mins).

### Hydration
Proceso crudo de extraer datos del almacenamiento persistente fÃ­sico (MMKV, SQLite) y volcarlos hacia la RAM en los stores (Zustand) al arrancar. Fase vital para operar Offline-First al instante.

---

## I

### i18n (Internationalization)
Proceso de adaptaciÃ³n de software para tolerar y mutar segÃºn mÃºltiples lenguajes y regiones. En Threshold se implementa vÃ­a `i18next` + `react-i18next` abarcando espaÃ±ol, inglÃ©s y portuguÃ©s.

### IDOR (Insecure Direct Object Reference)
Vulnerabilidad explotable donde un usuario manipula IDs de la API para intervenir datos de otro usuario. Threshold la previene mediante el middleware `validateOwner.js`.

### Idempotencia
Propiedad matemÃ¡tica/computacional donde aplicar una operaciÃ³n repetidas veces produce invariablemente el mismo resultado que aplicarla una sola vez. En Sync, un CREATE fallido reintentado 5 veces no crea 5 registros gracias a las operaciones `UPSERT`.

### Initial Sync
Primera gran operaciÃ³n de sincronizaciÃ³n. Descarga en un Ãºnico dump el estado del mundo (`user_id`). Se detona si la app detecta que el `lastSyncVersion === 0`.

### INSERT ... ON CONFLICT DO UPDATE
TambiÃ©n llamado **UPSERT**. Intenta insertar una nueva fila SQL; si colisiona con un ID primario existente, aplica un UPDATE condicional. Base absoluta de la idempotencia en Threshold.

### Interfaz (Interface)
DeclaraciÃ³n formal de un Contrato en TypeScript. Oculta la implementaciÃ³n interna sucia de un MÃ³dulo y expone y documenta Ãºnicamente los mÃ©todos pÃºblicos permitidos (ej. `NotificationProvider`).

### InterruptionPolicy
MÃ³dulo del motor de recordatorios (`InterruptionPolicy.ts`) que intercepta una notificaciÃ³n inminente y autoriza o deniega su disparo en funciÃ³n del contexto (No Molestar, Silencio, en Llamada, etc).

### Invariante (Invariant)
Regla de negocio, dogma o axioma arquitectÃ³nico absoluto que nunca debe romperse bajo ninguna circunstancia. Ejemplo en Threshold: "La red nunca bloquea el Bootstrap", o "El Snapshot cognitivo es cien por ciento inmutable".

---

## J

### JS Thread
El hilo principal de ejecuciÃ³n lÃ³gico en React Native donde corre todo el runtime de JavaScript. Su principal debilidad es que si se bloquea computacionalmente, la UI entera dropea frames (se congela).

### JSI (JavaScript Interface)
Capa fundamental de la New Architecture de React Native que destruye el antiguo puente asÃ­ncrono, permitiendo comunicaciÃ³n en memoria sincrÃ³nica (C++) entre JavaScript y mÃ³dulos nativos pesados (Skia, MMKV, Nitro).

### JSON (JavaScript Object Notation)
Formato texto ubicuo de serializaciÃ³n. En Threshold se persisten en JSON tanto las configuraciones como los payloads completos dentro del SQLite local (`sync_queue`).

### JWT (JSON Web Token)
EstÃ¡ndar criptogrÃ¡fico para transferir identidad. El backend emite tokens; el app los refugia en `expo-secure-store` y los incluye en cabeceras de API bajo el scheme `Bearer`.

---

## K

### Keychain (iOS) / Keystore (Android)
El bÃ³veda hardware/software cifrada y segura a nivel de sistema operativo para refugiar credenciales sensibles. Expuesta a React Native a travÃ©s de `expo-secure-store`.

### Knowledge Domain
Universo de dominio, interfaces y abstracciones matemÃ¡ticas que rige cÃ³mo calcula, proyecta y expone Threshold el estado cognitivo del usuario (su cerebro virtual en la app).

### KnowledgeHealthCard
Componente visual del Dashboard que dibuja el pulso cognitivo del aprendizaje de un usuario. Es puro (sÃ³lo renderiza lo provisto por `KnowledgeSnapshot`) sin saber quÃ© motor ni base de datos hay detrÃ¡s.

### KnowledgeProjection
El maestro de orquesta del Learning Domain. Succiona los datos crudos FSRS desde SQLite vÃ­a `KnowledgeQuery`, se los alimenta al Builder, y entrega finalmente el `KnowledgeSnapshot` a la UI.

### KnowledgeProvider
Fachada o interfaz pÃºblica estricta. Todo elemento fuera del dominio (Dashboards, IA, Calendar) estÃ¡ obligado a usar al Provider para solicitar informaciÃ³n cognitiva, manteniÃ©ndolos agnÃ³sticos a las matemÃ¡ticas internas.

### KnowledgeSnapshot
**Value Object** cien por ciento inmutable que congela el estado de conocimiento del usuario en un nanosegundo de tiempo. Al instanciarse se sella con `Object.freeze()`. Nadie lo muta: requiere crear uno nuevo.

### KnowledgeSnapshotBuilder
ImplementaciÃ³n pura del patrÃ³n Builder que procesa FSRS y escupe un `KnowledgeSnapshot`. Totalmente aislado y carente de I/O directo.

---

## L

### Last Write Wins (LWW)
Estrategia de resoluciÃ³n de conflictos pragmÃ¡tica. Ante dos modificaciones en pugna, gana la versiÃ³n cuyo timestamp `updated_at` sea matemÃ¡ticamente mÃ¡s reciente en tiempo absoluto. Estrategia reina del `ConflictResolver`.

### lastSyncVersion
Puntero guardado localmente (MMKV) por cada cliente. ActÃºa como marcador de libro (bookmark): indica el Ãºltimo estado de la historia remota (`sync_version` global) del cual este dispositivo tiene conocimiento.

### Lazy Loading (Carga Diferida)
PatrÃ³n de optimizaciÃ³n esencial. Ciertos mÃ³dulos pesados, vistas Lottie o dependencias no se cargan en la RAM al arranque inicial de Threshold, sino que se inyectan dinÃ¡micamente solo en el milisegundo exacto en que el usuario los solicita.

### Learning Health
CategorÃ­a dentro del `KnowledgeSnapshot` que destila las matemÃ¡ticas y dice, en tÃ©rminos legibles (Tarjetas CrÃ­ticas, Salud %, Buen estado), cÃ³mo le estÃ¡ yendo al estudiante.

### llama.rn
Bindings eficientes puenteando `llama.cpp` a React Native, capacitando a dispositivos de gama media y alta a levantar inferencia LLM en RAM propia. (Cerebro offline de Zyren).

### LMS (Learning Management System)
Software institucional de las universidades (Moodle, Blackboard, Canvas). Threshold los integra vÃ­a conectores `lms_accounts` en un esfuerzo de ingestiÃ³n de informaciÃ³n sin fricciÃ³n (ETL).

### Local-First
Principio de diseÃ±o radical. El SQLite embebido en el telÃ©fono celular es tratado soberanamente como la Fuente de Verdad Inmediata, de cara a la UI. El Backend es relegado a rol de replicador secundario o nube de respaldo.

### Local URI
Ruta del disco local fÃ­sico (`file://...`) apuntando a un archivo. En Threshold, **Nunca** abandona el dispositivo ni viaja en un Sync (ViolarÃ­a el Asset Locality Invariant) porque perderÃ­a sentido en otro celular.

### Lock / Deadlock (Database is locked)
Escenario catastrÃ³fico transitorio en SQLite. MÃºltiples promesas/threads forcejean para alterar registros y el motor levanta escudos cerrando los archivos de DB. Threshold usa WAL mode y triggers manuales de Checkpoints para suavizar la pugna concurrente.

### Lottie
Formato de grÃ¡ficos vectoriales animados con cÃ³digo puro (JSON), 100x mÃ¡s eficientes que un video. Threshold los explota para construir las visualizaciones inmersivas y orgÃ¡nicas como la esfera interactiva de Zyren.

### LRO (Long Running Operation)
AbstracciÃ³n de Threshold para controlar UX en operaciones que excedan la fricciÃ³n (2+ segundos). Obliga terminantemente a fluir su estado usando el `OperationProgressEmitter`, prohibiendo que el autor de la operaciÃ³n invoque notificaciones manuales o alertillas sueltas, delegÃ¡ndoselo todo al framework.

### LRU (Least Recently Used)
Algoritmo de expulsiÃ³n (eviction) para vaciar espacio. Si la App excede 3GB llenÃ¡ndose de PDFs, el `PersistentLocalAssetStore` buscarÃ¡ y barrerÃ¡ silenciosamente aquellos activos no tocados durante mayor tiempo.

---

## M

### Memoization
TÃ¡ctica drÃ¡stica de performance. Consiste en guardar el resultado derivado de una funciÃ³n o componente costoso en memoria cachÃ©, escupiendo este remanente en lugar de recalcular al toparse de nuevo con el mismo Input. (`useMemo`, `useCallback`, `React.memo`).

### Memory Level
El escaÃ±o conceptual donde descansa la asimilaciÃ³n del usuario de una Flashcard (`new`, `learning`, `review`, `mature`), calculado estrictamente derivando la curva de retenciÃ³n de FSRS.

### Metro Bundler
El empaquetador oficial de Meta para React Native. Su trabajo es ingerir las dependencias de node_modules y el cÃ³digo TS, transformarlo velozmente en un mega-paquete consumible por Hermes para montar el bundle on-the-fly y durante HMR.

### Middleware
Capa de software interceptora. En el Backend (Express), son funciones encadenadas que examinan el Request entrante antes de dejarlo pasar al Controlador definitivo, escudando a Threshold procesando validaciones (Zod), Autenticaciones (JWT) o cabeceras CORS.

### Migration (Base de Datos)
GuiÃ³n inmutable que instruye cÃ³mo mutar el esquema SQL de un estado `n` al estado `n+1`. Corren estricta y cronolÃ³gicamente sÃ³lo una vez por dispositivo. En Threshold se ha refinado el `Migration Runner` para que evadan crashes usando flags `PRAGMA table_info` si la mutaciÃ³n ya existÃ­a sorpresivamente en el disco.

### MMKV
El motor de Key-Value Storage ultrarrÃ¡pido creado por WeChat (Tencent), codificado en C++. En Threshold releva los flags, configuraciones y variables de Bootstrap. **Prohibido** usarlo como fuente de verdad para el negocio (Ese es el reino de SQLite).

### Mock
ManiquÃ­ de cÃ³digo. ImplementaciÃ³n falsa de un mÃ³dulo inyectada durante testings automÃ¡ticos que obedece dictados e intercepta llamadas de manera controlada. Ej: `NotificationSchedulerMock` garantiza correr pruebas unitarias sobre Recordatorios sin gatillar alertas reales a los desarrolladores.

### MÃ³dulo (Module)
Pieza de arquitectura lÃ³gica, encapsulada y altamente cohesionada que agrupa Repositorios, Servicios, Validaciones y Contratos para cumplir una misiÃ³n sistÃ©mica. (Ej. MÃ³dulo de Recordatorios, MÃ³dulo de SincronizaciÃ³n). Un MÃ³dulo reside en las entraÃ±as del motor, a diferencia de los Componentes que viven en la presentaciÃ³n (UI).

### Momentum Score
Formula implementada en el Hub de Cursos. EvalÃºa el peso y la masa activa del estudiante. Decae frÃ­amente si no se ejerce actividad (Momentum Decay). Recompensa al usuario cuando mantiene tracciÃ³n sostenida.

### Monorepo
PrÃ¡ctica Dev-Ops: Guardar el backend, el app frontend y hasta las documentaciones en un mega-repositorio de Git interconectado. Ayuda a preservar la consistencia sincrÃ³nica si se introduce un cambio en un contrato compartido (Payload API).

### Morgan
Software de bitÃ¡cora (Logging middleware) inyectado al servidor Node.js que escupe trazas de toda peticiÃ³n recibida a la consola, facilitando la depuraciÃ³n visual.

### Multer
Modulo Node.js que se encarga exclusivamente de destripar los envÃ­os en rÃ¡faga (Multipart Form Data) recibiendo el byte-stream del telÃ©fono celular para estacionar binarios o assets temporalmente.

### Mutation Matrix
Cuadro estratÃ©gico de auditorÃ­a (Documento `MUTATION_MATRIX.md`). InventarÃ­a las acciones de UX y verifica si sus ondas expansivas tocan (y limpian) cascadas, dependencias o registros de sincronizaciÃ³n segÃºn lo dictado por la arquitectura.

---

## N

### NetInfo
LibrerÃ­a que interpela a los radios del telÃ©fono reportando (mediante triggers event-based) si el dispositivo navega en WIFI, LTE o si ha naufragado al modo sin conexiÃ³n. Orquestador base para decidir si el LRO aborta, pausa, o confÃ­a en la cola de Background Sync.

### New Architecture (React Native)
RevoluciÃ³n estructural por defecto desde React Native 0.81 (y 0.68+ como bandera experimental). Dinamita el Bridge histÃ³rico abrazando JSI, TurboModules nativos y el Fabric Renderer para lograr interoperabilidad con C++ saltando penalidades en el paso de variables (serializaciones en JSON).

### Nitro Modules
Sistema agnÃ³stico que explota las bondades de JSI, agilizando escandalosamente la creaciÃ³n de TurboModules para integrarlos a RN con 0% impacto en el Event Loop.

### Node.js
Motor que extirpa el runtime V8 fuera del navegador y lo usa en servidores de propÃ³sito general. Es el andamiaje donde ruge el backend de Threshold (Node >= 18).

### no-op
*No-Operation*. ExpresiÃ³n para designar un estado nulo de acciÃ³n. Si el Sync Reducer lee en la cola que un Card se creÃ³ en un instante y 2 segundos despuÃ©s el usuario la borrÃ³ furiosamente (`CREATE` + `DELETE`), la condensa y neutraliza como `no-op`, aligerando la carga de red.

### Notifee
Library suprema (y paga comercialmente alguna vez) de Push Notifications y recordatorios que maneja las peculiaridades crueles y disÃ­miles entre Android e iOS. En Threshold estÃ¡ arrinconada tras un interfaz (`NotifeeOperationProvider`) para nunca permear a los servicios core del negocio.

### NotificationProvider
Contrato TypeScript de hierro. Define a quÃ© deben atenerse las alarmas sin comprometer quÃ© tecnologÃ­a emite los sonidos.

### NotificationReconciler
Sistema autÃ³nomo que confronta agresivamente dos realidades paralelas de Threshold: "Lo que el motor de BD local dice que debes recordarme" Vs "Lo que el Sistema Operativo del TelÃ©fono dice que tiene programado despertar". Si no coinciden, purga y resetea (Healing).

### NotifeeOperationProvider
Estrategia en cÃ³digo concreta y servil a `NotificationProvider`. Su tarea aburrida es invocar flags del Sistema Operativo como (Canal Ongoing, AutoCancel) a travÃ©s de Notifee.

---

## O

### Observer Pattern
Mecanismo de diseÃ±o donde una matriz ("Sujeto") colecciona instancias pasivas de observadores, para radiarles instantÃ¡neamente alertas cuando sufra mutaciones. Base fundacional del EventBus y la reacciÃ³n en cadena de los componentes Zustand hacia la UI de Threshold.

### OCR (Optical Character Recognition)
Algoritmos que "ven" un .JPG o PDF rastrillÃ¡ndolo para extraer pÃ¡rrafos ASCII entendibles. En Threshold se usa intensamente Google ML Kit (Offline) y Modelos Vision 11B (Cloud) para extraer jugos de los escaneos documentales.

### Offline-First
Axioma de experiencia de usuario de Threshold: Cero *Spinners* congelantes. Al abrir la App el usuario no es mendigo del ancho de banda. Puede crear materias enteras desconectado del planeta. La red no dicta sus rutinas de estudio, las complementa asÃ­ncronamente en el background.

### ON CONFLICT
InstrucciÃ³n de SQLite fundamental. Protege el estado determinista y conjura las debilidades HTTP dictaminando cÃ³mo proceder cuando una llave choca. Threshold usa compulsivamente `ON CONFLICT(id) DO UPDATE SET...` forjando Upserts anti-balas.

### OpenAPI / Swagger
EspecificaciÃ³n universal e interactiva que documenta la superficie y el vientre de la API. En Threshold, permite usar UI en Swagger `/api-docs` para jugar o entender quÃ© rutas viven en Node.

### OperationProgressEmitter
Bus de Eventos especializado (Singleton) que trafica reportes frÃ­os (progreso, finalizaciÃ³n, fallecimiento, aborto) emanados de las LRO en las sombras de los servicios y entregados cordialmente a la UI.

### OperationReducer
Motor lÃ³gico empotrado en la infraestructura del SyncQueue. Reduce las operaciones atÃ³micas apiladas a un estado comprimido usando reglas puras.

### Orphan Data
*Datos HuÃ©rfanos*. Basura estancada o registros que pierden su Padre debido a borrados negligentes que omitieron arrastrar cascadas. Vulnerabilidad purgada histÃ³ricamente mediante revisiones exhaustivas sobre la `Ownership Matrix`.

### Ownership Matrix
Mapeo de jerarquÃ­as: Padre -> Hijo que sella dependencias (Eje: Subject -> Course -> FlashcardDeck -> Flashcard). Documento vital que blinda el cÃ³digo ante el riesgo de Orphan Data.

---

## P

### PaaS (Platform as a Service)
La infraestructura en la nube moderna donde no configuramos servidores Ubuntu crudos. **Render** aloja el cÃ³digo de Threshold y gestiona la RAM, Puertos y CPU sin burocracia de DevOps.

### Payload
La carga valiosa que viaja dentro de la cabina (Body) de un Request de API. TambiÃ©n es el furgÃ³n que transporta informaciÃ³n del estado mutado dentro de la Cola Local `sync_queue`. En contexto de Cifrado (JWT) son los secretos o IDs incrustados.

### PDF Extractor Module
SurgiÃ³ por carencias severas de React Native para deglutir textos pesados Offline. Es un mÃ³dulo nativo customizado a medida (`threshold-pdf-extractor`) codificado en Kotlin/Swift.

### PersistentLocalAssetStore
BÃ³veda inteligente (File Manager) que administra los miles de PDF e imÃ¡genes del sistema operando el FileSystem y desalojando con (LRU de 3GB) si detecta que la salud de la ROM del dispositivo padece escasez.

### Pipeline
Arquitectura en cadena de ensamblaje industrial donde la salida (output) de un mÃ³dulo es inyectada intacta como la entrada (input) del siguiente bloque. Threshold posee **Asset Pipelines** y **Reducer Pipelines** donde el dato viaja transformÃ¡ndose por etapas controladas.

### Policy Engine
Juez supremo de `AIOrchestrator` que evalÃºa contextos variables: RAM (`Device Tier`), Status Red (NetInfo), Bandera Preferencial y dictamina en fracciones de segundo si Groq debe ser invocado o la Llama on-device debe despertar.

### PostgreSQL
Motor Open Source legendario. Si bien el local-first domina en los mÃ³viles (SQLite), el Backend fue hibridado para tolerar PostgreSQL.

### PRAGMA
Ã“rdenes y secretos crÃ­pticos del motor SQLite para activar comportamientos (Ej. `PRAGMA foreign_keys = ON`, `PRAGMA table_info`). Las Migraciones de Threshold dependen dramÃ¡ticamente de ellos.

### Presentation Layer
Capa frÃ¡gil de Threshold. Los componentes funcionales `.tsx`. Regla de Hierro arquitectÃ³nica: JAMAS tocan una red, API o BD; SÃ³lo rinden los destilados inyectados por los Hooks / Zustand.

### Publisher-Subscriber (Pub/Sub)
DiseÃ±o de comunicaciÃ³n donde la voz parlante no tiene ni idea de quiÃ©n o cuÃ¡ntos la estÃ¡n oyendo, y los oyentes estÃ¡n pasivos esperando el anuncio para transitar estados (Total desacoplamiento UI vs Logic).

### Pull (Sync)
Momento del ciclo de sincro donde Threshold clama y exige traccionar diferencias (Deltas) desde el Backend.

### Pure Function (FunciÃ³n Pura)
Concepto matemÃ¡tico infalible. Se garantiza que f(x)=y en el 100% de las trillones de corridas si X es la misma invariante. Cero estados globales, cero llamadas I/O por debajo de cuerda. Todo `calculateFSRS` y el `ReductionPipeline` de Threshold deben honrar este axioma.

### Push (Sync)
Momento de desahogo de sincro donde el MÃ³vil empuja frenÃ©ticamente la cola reducida e idempotente para reescribir la base del Backend.

---

## Q

### Query (Dominio)
Concepto que engloba a mÃ³dulos estrictos de consulta en BD `(read-only)`. Ajenos a side-effects (escrituras, locks). `KnowledgeQuery` arranca y ensambla vistas transaccionales.

---

## R

### Race Condition
AnomalÃ­a brutal concurrente de Software. (Ejemplo corregido de los Subjects: Un SELECT que verificaba la existencia y tardaba nanosegundos adicionales en el INSERT, permitiendo a otro Thread re-insertar rompiendo Unique Keys). Todo arreglado con UPSERT transaccionales.

### Rate Limiting
Muralla defensiva (`express-rate-limit`) que asfixia Requests malintencionados en el Backend que buscan colapsar a punta de metralleta el Login o la API de Threshold.

### React Compiler
*(Aka. React Forget)*. Avance revolucionario en experimentaciÃ³n que erradica la escritura manual asfixiante de hooks de *Memoization* (Muerte a los `useMemo`), pre-calculando el Ã¡rbol virtual. Threshold lo activa como optimizaciÃ³n agresiva de Vanguardia.

### React Native
Ecosistema robusto de Facebook. AbstracciÃ³n que permite usar JSX + LÃ³gica JS (o TS) generando comandos interpretables para los views nativos del Sistema Operativo de Apple y Google.

### Reanimated
Biblioteca salvadora frente al cuello de botella del viejo "Bridge". Traslada y ejerce la gimnasia computacional de animaciones vectoriales delegÃ¡ndolas agresivamente al "UI Thread" aislado mediante *Worklets*. Los `60 Frames Per Second` de Threshold viven o mueren por ella.

### ReductionReport
Reporte estructurado con estadÃ­sticas escupido rutinariamente luego que un proceso del Pipeline SyncReducer mutila una cola pesada para resumirla. (Incluyendo los muertos: `merged`, `noop`, `restored`).

### Refactoring (RefactorizaciÃ³n)
AlteraciÃ³n profunda de entraÃ±as arquitectÃ³nicas o estÃ©ticas del bloque de cÃ³digo. Regla: NingÃºn Refactor agresivo debe desfigurar las aserciones pÃºblicas finales; un test bien parametrizado deberÃ¡ seguir validÃ¡ndolo en luz verde (A menos que exista un cambio sustancial del Dominio).

### Regression Testing
BatallÃ³n de Tests Automatizados inquebrantables e inflexibles que se disparan post-integraciÃ³n, destinados a re-certificar que el desarrollador no ha roto funcionalidades viejas en nombre del cÃ³digo nuevo. El *Reminder Regression Suite* es el orgullo de la CI.

### Render (PaaS)
Hogar definitivo del Backend y base de datos relacional Cloud de Threshold.

### Reminder Engine
Masa encefÃ¡lica del ecosistema LRO y Agenda de Threshold. Triturador lÃ³gico `(ReminderEngine.ts)` que mastica calendarios, husos horarios, y dictados de dominancia, emitiendo veredictos a NotificationScheduler sin contaminar su proceso con Notifee.

### ReminderCoordinator
GuardiÃ¡n esclavo del EventBus. Su trabajo silencioso es atestiguar y espiar las rÃ¡fagas de alteraciones de base de datos en torno a ExÃ¡menes o Citas y alertar vigorosamente al `ReminderEngine` para recambios de notificaciÃ³n.

### Reminder System
Sistema mastodÃ³ntico y maduro del Domain de Recordatorios, forjado para aguantar transiciones horarias (`mobile/src/services/reminders/`). Probado y blindado contra fuego con 23 suites y aprox. 300 checks de CI.

### RepeticiÃ³n Espaciada (Spaced Repetition)
TÃ©cnica madre de aprendizaje cognitivo. Consiste en incrementar paulatinamente los intervalos de tiempo en blanco entre repasos de un material previamente entendido. Threshold la lleva a su mÃ¡ximo exponente implementando el algoritmo **FSRS** para esculpir el Knowledge Domain.

### Repository
Capa intermedia. Encapsula y entierra los `SELECT`, `UPDATE` y consultas Sqlite, aislando estas primitivas rudimentarias para dotar al resto del programa de contratos limpios de acceso. Todo Save de DB emite Events en cascada.

### RepositoryEventBus
La plaza pÃºblica del Pub/Sub en Threshold. Las vibraciones de Inserciones y Eliminaciones logradas resuenan allÃ­ para despertar re-enriquecimientos incrementales en Zustand minimizando costosas recargas totales.

### Require Cycle
AntipatrÃ³n y Warning. (A.ts llama B.ts, y B.ts sin darse cuenta, requerÃ­a funcionalidades del padre A.ts). El JS Runtime colapsarÃ¡ si esto sucede antes de resolver el Graph de instancias. Se pule en Threshold desglosando la dependencia e invirtiendo la carga.

### REST API
Arquitectura que abraza peticiones semÃ¡nticas uniformes basÃ¡ndose en HTTP. (MÃ©todos, Headers, URLs y Verbos).

### RESTORE (Sync)
Estado paradÃ³jico virtual en Sincronizaciones Offline extremas. Dos impulsos seguidos por el mismo UUID (`DELETE` y de repente un violento `CREATE`). El Reducer cancela su aniquilaciÃ³n invocando una redenciÃ³n de registro.

### Retrievability
CÃ¡lculo en vivo y directo desde las arterias de FSRS. Porcentaje matemÃ¡tico que traduce si el alumno se asoma al abismo cognitivo del olvido (`Retrievability %`) ahora mismo. Threshold purga otras mÃ©tricas defectuosas y usa a la retrievabilidad como estandarte del Knowledge.

---

## S

### Safe Area
MÃ¡rgenes e islotes geomÃ©tricos fÃ­sicos que roban espacio a los displays mÃ³viles (El Notch, La Isla DinÃ¡mica, Barra del Gestual inferior de iOS/Android). `react-native-safe-area-context` y modales las respetan evadiendo recortes anti-estÃ©ticos.

### Salt (bcrypt)
Condimento aleatorio (caracteres basuras extra) concatenados a una Password antes de quemarla y hashearla para evadir colisiones y los ataques Rainbow Tables.

### Semantic Cache
Espectacular optimizaciÃ³n que empareja heurÃ­sticamente la estructura y los vectores de un query textual a IA y busca similitudes latentes pasadas. Threshold mitiga abusos de cuotas a API evitando procesar dos consultas lÃ³gicamente iguales.

### SequenceFactory
MÃ¡quina despachadora y multiplicadora para los Recordatorios. Una siembra Ãºnica (Ej. 1 Parcial el SÃ¡bado a las 8am) es clonada topogrÃ¡ficamente para engendrar cascadas de alertas (`1 Semana antes`, `2 DÃ­as`, `1 hora`, `15 mins`).

### SerializaciÃ³n / DeserializaciÃ³n
El proceso de aplastar y congelar el estado crudo de memoria (Instancias complejas) reduciÃ©ndolos a Strings transportables (JSON) y viceversa. Vital en Threshold para que los Arrays de mutaciones del LWW sobrevivan a la persistencia en `sync_queue`.

### SF Symbols
Sistema glÃ­fico nativo masivo y elegante diseÃ±ado por Cupertino (Apple). Las UI de Threshold lucen iconos refinados y escalables a travÃ©s del bridge `expo-symbols`.

### Singleton
PatrÃ³n y Ley ineludible en el Ã¡mbito global del Software: "De esta clase sÃ³lo nacerÃ¡ una copia para servir durante la sesiÃ³n". Imprescindible para el `EventBus` que no puede bifurcar emisiones en instancias separadas.

### Skia
Motor todoterreno grÃ¡fico (El mismo V8 2D de Google Chrome). Potencia los radares, canvas y florituras que superan las limitantes impuestas del componente primario `<View>`.

### SM-2 (SuperMemo 2)
Ancestro y algoritmo matemÃ¡tico de repeticiÃ³n espaciada obsoleto. Mantenido unicamente como compatibilidad pre-migratoria en Backend y destronado globalmente en las operaciones lÃ³gicas de Threshold por **FSRS**.

### Smoke Test (Prueba de Humo)
InspecciÃ³n superficial relÃ¡mpago e inicial ejecutada antes de derramar recursos masivos. Confirma que la estufa o el bloque no explota (literalmente "hace humo") evaluando flujos mÃ­nimos. Threshold los usa en su Stress Suite.

### Soft Delete
"Borrados fantasma". La fila o tabla no desaparece atÃ³micamente destruida del disco de SQLite, sÃ³lo se la apaga insertÃ¡ndole una estampa mortal temporal (`deleted_at` timestamp). Resurrecciones y Sincronizaciones dependen de conservar dicha informaciÃ³n en las auditorÃ­as.

### Source of Truth (Fuente de Verdad)
Cualquier almacÃ©n que el sistema acepte como la voz innegable sobre un estado. Threshold decreta a SQLite como Fuente de Verdad Operativa en el celular; y entrona matemÃ¡ticamente al bloque FSRS como la **Ãšnica** Fuente de Verdad Cognitiva del estudiante (Prohibiendo derivar lÃ³gicas de promedios simples).

### SQLite
Emperador local e implacable del Threshold de producciÃ³n Offline. Archivo embebido relacional de DB veloz y maduro que gobierna la estructura local sin recaer sobre latencias web.

### Standard Entity Pattern
Modelo que designa entidades que fluyen limpiamente y con peso pluma sobre la red. Toda su biografÃ­a es texto/JSON. Ej. Subjects.

### State Machine (MÃ¡quina de Estados)
PatrÃ³n determinista implementado (LRO, Reducer) que fuerza un control lineal rÃ­gido en procesos variables, impidiendo el anarquismo. (Un status no puede saltar ilÃ³gicamente de "Preparando" a "Aplastado" ignorando pasos transitorios y validaciones).

### Store (Zustand)
CubÃ­culos en memoria RAM rÃ¡pida que centralizan dictÃ¡menes (Player Status, Connection, Modals, Flashcards Loaded).

### Strategy Pattern (PatrÃ³n Estrategia)
DiseÃ±o pragmÃ¡tico que acoraza el "QuÃ© hacer" del "CÃ³mo hacerlo". Intercambia motores silenciosamente (En Threshold, el `NotificationProvider` subcontrata la estrategia a Notifee pero en Tests muta al Mock-Provider transparente).

### Stress Suite
Infierno simulado a propÃ³sito y baterÃ­a de asedio alojado en `tests/stress`. Invoca simuladores para destripar al motor enviando paquetes perdidos, resucitando telÃ©fonos en Sync simultÃ¡neo para comprobar que los Conflicts se reparen ilesos.

### Subject
Reyes funcionales de Threshold y Aggregate Roots. Los pilares que rigen, conectan y dictan si el Curso, Examen, Tarjeta y Modos IA subsisten.

### SubjectKnowledge
Sub-categorÃ­a de los agregados en `KnowledgeSnapshot`, reaccionando a quÃ© nivel acadÃ©mico pulsa una materia.

### Supadata.ai
Motor SaaS de IA en la web invocado por el Backend en los Controllers para drenar Transcripciones crudas desde Links mudos de YouTube.

### Sync Debugger
Forensia interna. MÃ³dulo rastreador que impone y emite el pasaporte (`X-Trace-Id`) por cada embudo para inspeccionar cuellos de botella mediante timings temporales (15 etapas) hasta grabarlos en Logs.

### Sync Deletions
Cementerio contable (`sync_deletions`). Tabla puente para registrar el pasaporte y versiÃ³n final a los caÃ­dos. Permite a otros clientes preguntar "Â¿QuiÃ©n ha muerto desde la iteraciÃ³n 1050?" e ignorar a los vivos.

### Sync Entity Contract
Reglas draconianas para que un tabla acceda al Club Sincronizable de 1ra Clase del Engine (Debe ostentar UserId, SyncVersions, participar del Pull y Deltas, figurar en Stress Suites).

### Sync Journal
Archivador crudo introducido en v20. Auxilia y audita sobre los registros transaccionales muertos a la par del SyncQueue.

### Sync Manager
Cerebro mÃ¡ximo (Orquestador global) del Sync Engine.

### Sync Protocol v1.0
Estatuto inviolable en piedra y documento sagrado en MarkDown (`SYNC_PROTOCOL.md`) validado tras ardua normalizaciÃ³n. NingÃºn desarrollador estÃ¡ autorizado a quebrar idempotencias ni manipular sus arquitecturas de Conflictos si altera el Sync.

### Sync Queue
Tolva de abordaje (Cola persistida en `sync_queue` Local SQLite). Las modificaciones y baches nacidos sin WiFI acampan aquÃ­ intentando zarpar, reintentando un mÃ¡ximo de 5 empujones (`retries`) si hay bloqueos hostiles 500xx.

### SyncQueueReducer
Aplastador y filtro algorÃ­tmico mÃ¡gico. Extrae miles de rebotes incoherentes y cacofÃ³nicos desde la Tolva (Cola) y amasa/comprime sus vectores garantizando ahorros masivos HTTP.

### sync_version (Global)
El segundero del mundo y Dios universal del Backend. Tickea y muta incondicionalmente a +1 con toda Escritura confirmada.

### sync_version (Per-row)
Marca de agua local embutida por tabla, respondiendo "Este row particular fue refrescado bajo quÃ© Tick-Global". Armas la consulta rÃ¡pida `WHERE sync_version > MiCelularConoce...` para destapar la magia de Deltas.

---

## T

### Template Resolver
Aglutinador semÃ¡ntico (`TemplateResolver.ts`). Encargado en tiempo de compilaciÃ³n y aviso de prender los moldes con las variables (`$NOMBRE_EXAMEN`) y escupir lenganzas procesados (EspaÃ±ol o InglÃ©s).

### Test Suite
Racimos densos de pruebas estÃ¡ticas e interrelacionadas (`.test.ts`) codificadas y afirmadas rigurosamente en Jest para corroborar si el motor lÃ³gico sigue sano tras un huracÃ¡n de modificaciones o un refactor.

### Threshold (app)
Personal Knowledge Platform local-first e offline-first pensada obsesivamente contra la fricciÃ³n cognoscitiva en Universitarios y devoradores de conocimiento denso.

### Throttling (Notificaciones)
Bypass controlador. Frena el entusiasmo algorÃ­tmico del EventBus en los LROs y escupe Notificaciones de UI apaciguadas para no asfixiar brutalmente a la barra Android o colgar visualmente el iPhone. (Frecuencia Top: 1 cada 250ms).

### Topological Sort
OrdenaciÃ³n rÃ­gida (Ã�rboles matemÃ¡ticos). El "Course" siempre va bajo del "Subject", la "Tarjeta" trascienden del "Mazo". En el Reducer dictamina la prioridad al vuelo.

### Transaction (TransacciÃ³n DB)
Mecanismo SQLite indivisible (`BEGIN TRANSACTION -> COMMIT`). Protege al sistema garantizando que o la OperaciÃ³n A con Cascadas masivas entra perfecta e inmaculada al disco, o el lote entero choca, colapsa y devuelve su estructura pasada (`Rollback`) resguardando a Threshold de corrupciones parciales letales.

### TTL (Time To Live)
Temporizador cruel implementado para los CachÃ©s HTTP del sistema (AsynStorage). Marca cuÃ¡ntos minutos pasaran antes de que la data aÃ±eja merezca un reemplazo total desde la Nube. (Usual: 10 mins).

### TypeScript
Superpoder del Stack. Abrazado de extremo a extremo en RN mobile aportando estricto tipado (`types, generics`), evadiendo explosiones o falacias semÃ¡nticas letales para compiladores de Node.

---

## U

### UI Thread
El hilo privilegiado del Smartphone (`Native iOS/Android`). Todo el bloque visual estÃ¡ subordinado a sus 60/120 Hz de empujes. Los Worklets con Reanimated explotan esta trinchera.

### UploadThing
Bodega remota, Cloud Storage masivo que aloja los Assets del mundo fÃ­sico de Threshold sin saturar el Backend base (Render).

### UPSERT
*Update o Insert*. Maniobra quirÃºrgica central, apoyada en el condicional de Conflicto. Funde las peticiones previniendo falsos negativos sobre existencias.

### UUID (Universally Unique Identifier)
Clave inquebrantable estandarizada al azar (v4, v7). Todo ente, Subject, Flashcard en Threshold se ampara a ellos sin preguntar al Backend por ID's, desvinculando la dependencia conectiva original (Offline creation de raÃ­z).

---

## V

### Validation Rules
Capa perimetral final implementada en el `SyncQueueReducer`. Comprueba al vuelo fallos de coherencia (`Si el Padre de un Mazo es HuÃ©rfano en SQL -> aborta`).

### Value Object
Axioma sagrado. Bloques matemÃ¡ticos y atÃ³micos (`KnowledgeSnapshot`). No posee identidad. Se clona entero si es alterado. EstÃ¡ sellado por `Object.freeze()` previniendo mutaciones piratas por desarrolladores confundidos en ramas remotas.

### version_number
Sello incremental local de 1 en 1 que acoraza a Threshold en Disputas y Conflictos LWW, previniendo choques lÃ³gicos per-entity en la BD. Nunca toca o define el SyncVersion global.

---

## W

### WAL (Write-Ahead Log)
Mecanismo de SQLite crÃ­tico para Threshold. Las modificaciones a las tablas son apiladas secuencialmente primero sobre el bit-log y posteriormente vaciadas a la base consolidando rendimientos multi-lecturas vertiginosos que salvan de los temidos *Locks*.

### Whisper
Arquitectura IA sonora y masiva de Inteligencia Abierta entrenada por OpenAI para deglutir audio bruto y producir texto (TranscripciÃ³n Offline). En Threshold se ampara vÃ­a `whisper.rn`.

### Worklets
PequeÃ±as cajas negras JS en Reanimated 3 con poderes transfronterizos. Ejecutables directos en el "UI Thread" puro en forma supersÃ³nica evadiendo a toda costa el peso letal del "JS Thread" ahogado.

---

## Z

### Zod
Centinela del Backend. EvalÃºa rÃ­gidamente esquemas validando payloads engaÃ±osos, inyecciones e incoherencias de TypeScript contra el REST devolviendo un `400 Bad Request` antes de que toquen base en Express.

### Zustand
Framework Zen de reactividad. Un minÃºsculo oso (Bear) que controla docenas de re-renderizaciones anidadas de las Store principales, desmarcando el monstruoso *Boilerplate* tradicional exigido por Redux en el pasado.

### Zyren
Alma IA de la Arquitectura Threshold. Contextual y omnipotente (LPU Groq y Llama On-device). Orbe con vida visual y Lottie Animations. Extrae, Genera y dialoga en multiesferas del conocimiento.

### Zyren Ingestion
Flujo de ingesta tri-partita donde la IA vampiriza contenidos (Lecturas, Pdfs, Videos YT) reventÃ¡ndolas, digiriÃ©ndolas y ensamblÃ¡ndolas a mazos FSRS listos y empaquetados.

---

## Stack TecnolÃ³gico

AgrupaciÃ³n de las principales herramientas, lenguajes y librerÃ­as que conforman la arquitectura y el entorno de desarrollo de Threshold. (Para definiciones detalladas, consulta el Ã­ndice alfabÃ©tico).

### Frontend & Mobile App
- **React Native (0.81)**: Framework base para compilaciÃ³n cruzada iOS/Android.
- **Expo & Expo Router**: SDK de herramientas nativas y sistema de routing basado en archivos.
- **Hermes**: Motor de JavaScript optimizado (AOT) por defecto en React Native.
- **Metro Bundler**: Empaquetador de JavaScript oficial de Meta.
- **React Compiler**: Herramienta de vanguardia para memoizaciÃ³n automÃ¡tica.
- **TypeScript**: Lenguaje fuertemente tipado transversal a todo el cÃ³digo.
- **Zustand**: Gestor de estado global ligero sin boilerplate.
- **SQLite (expo-sqlite)**: Motor de base de datos relacional local (fuente de verdad).
- **MMKV**: Almacenamiento key-value en C++ para cachÃ©s y banderas ultra-rÃ¡pidas.
- **expo-secure-store**: BÃ³veda criptogrÃ¡fica (Keychain/Keystore) para secretos y JWTs.
- **Reanimated (v3) & Skia**: Motores grÃ¡ficos y de animaciÃ³n a 60fps usando Worklets y JSI.
- **FlashList**: Renderizador de listas masivas optimizado (Shopify).
- **Lottie**: Renderizador de animaciones vectoriales JSON.
- **Notifee**: Gestor avanzado de notificaciones push y canales locales.
- **i18next / react-i18next**: LibrerÃ­as de internacionalizaciÃ³n (i18n).
- **expo-haptics**: Interfaces para retroalimentaciÃ³n tÃ¡ctil nativa.
- **expo-symbols**: Puente para renderizar Ã­conos SF Symbols nativos de Apple.

### Backend & API
- **Node.js**: Runtime de JavaScript en servidor.
- **Express**: Framework minimalista para la REST API.
- **Zod**: Validador de esquemas e inferencia de tipos para payloads.
- **PostgreSQL**: Base de datos relacional del lado del servidor.
- **Multer**: Middleware para parseo de subidas binarias (*multipart/form-data*).
- **Morgan & Helmet**: Middlewares para logging HTTP y cabeceras de seguridad.
- **bcrypt**: LibrerÃ­a criptogrÃ¡fica para hashing de contraseÃ±as.
- **jsonwebtoken (JWT)**: Generador y validador de tokens de identidad.
- **Swagger / OpenAPI**: Ecosistema para documentar y probar la API interactiva.
- **dotenv**: Cargador de variables de entorno para protecciÃ³n de credenciales.

### Inteligencia Artificial
- **llama.rn & whisper.rn**: Bindings nativos para ejecutar modelos GGUF LLM y transcripciÃ³n offline.
- **Google ML Kit**: Motor OCR on-device nativo.
- **Groq**: Proveedor cloud de inferencia ultrarrÃ¡pida (LPU) para modelos grandes.
- **Supadata.ai**: Servicio cloud para extracciÃ³n de transcripciones de YouTube.

### Infraestructura & DevOps
- **Render**: Platform as a Service (PaaS) que aloja el Backend y la BD PostgreSQL.
- **UploadThing**: CDN y storage en la nube optimizado para los assets de los usuarios.
- **EAS (Expo Application Services)**: Nube de integraciÃ³n para compilar (EAS Build) y publicar (EAS Submit) nativamente.
- **GitHub Actions**: Pipeline de CI/CD para ejecutar el Reminder Regression Suite y Stress Suite.
- **Jest**: Framework de testing en TypeScript, pilar de las Regression y Stress Suites.
- **Docusaurus**: Motor estÃ¡tico para la web de documentaciÃ³n oficial.
- **Git**: Sistema de control de versiones distribuido que hospeda el monorepo.

---

## ApÃ©ndice â€” AcrÃ³nimos RÃ¡pidos

| AcrÃ³nimo | Significado |
|----------|-------------|
| ADR | Architecture Decision Record |
| API | Application Programming Interface |
| CDN | Content Delivery Network |
| CI/CD | Continuous Integration / Continuous Delivery |
| CORS | Cross-Origin Resource Sharing |
| CRUD | Create, Read, Update, Delete |
| CSP | Content Security Policy |
| DDD | Domain-Driven Design |
| DI  | Dependency Injection |
| DTO | Data Transfer Object |
| EAS | Expo Application Services |
| E2E | End-to-End |
| FK | Foreign Key |
| FIFO | First In, First Out |
| FSRS | Free Spaced Repetition Scheduler |
| GGUF | GPT-Generated Unified Format |
| HSL | Hue, Saturation, Lightness |
| HSTS | HTTP Strict Transport Security |
| IDOR | Insecure Direct Object Reference |
| JSI | JavaScript Interface |
| JWT | JSON Web Token |
| LMS | Learning Management System |
| LRO | Long Running Operation |
| LRU | Least Recently Used |
| LWW | Last Write Wins |
| MMKV | Mobile Memory Key-Value |
| OCR | Optical Character Recognition |
| PaaS | Platform as a Service |
| PK | Primary Key |
| REST | Representational State Transfer |
| SM-2 | SuperMemo 2 |
| TTL | Time To Live |
| UUID | Universally Unique Identifier |
| WAL | Write-Ahead Log |

---

**Tags:** #glossary #reference


## Terminología IA (Añadido en AI Domain v2.0)

### AIInteractionCoordinator
Pieza de infraestructura responsable de recibir las directivas generadas por el LLM y orquestar su ejecución a través del DirectiveHandlerRegistry. Desacopla la lógica de negocio de la interpretación de la respuesta de IA.

### AIDirective
Una instrucción estructurada devuelta por un modelo de lenguaje en lugar de texto libre (ej. create_deck, schedule_review). Son el pilar del Threshold Directive Protocol.

### DirectiveHandlerRegistry
Registro donde se asocian las distintas directivas del modelo con sus Handlers de ejecución. Protege el crecimiento de las operaciones sin modificar el coordinador central.

### FlashcardDomainService
Domain Service responsable de la persistencia centralizada de mazos generados por IA (o cualquier flujo complejo de tarjetas). Garantiza que la UI o los Handlers no necesiten instanciar agregados o IDs directamente, unificando la lógica transaccional de los repositorios.

### TDP (Threshold Directive Protocol)
Protocolo estándar que define el contrato inmutable mediante el cual los LLM emiten intenciones/directivas estructuradas (AIResponse + AIDirective) y cómo la plataforma las interpreta. Solo se usa para interacciones abiertas (conversacionales) donde el LLM debe decidir la siguiente acción.


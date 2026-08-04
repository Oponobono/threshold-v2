# 📖 Threshold — Diccionario Técnico

> Glosario exhaustivo de todos los términos, jerga, patrones y conceptos que aparecen en el desarrollo de Threshold.
> Cubre: arquitectura, sincronización, base de datos, UI/UX, IA, dominio de conocimiento, infraestructura, DevOps y patrones generales de Ingeniería de Software aplicados en la app.
> Última actualización: Agosto 2026.

---

## Índice

- [A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [H](#h) · [I](#i) · [J](#j) · [K](#k) · [L](#l) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [Q](#q) · [R](#r) · [S](#s) · [T](#t) · [U](#u) · [V](#v) · [W](#w) · [Z](#z) · [Acrónimos](#apéndice--acrónimos-rápidos)

---

## A

### AbortController
API nativa del runtime que permite cancelar operaciones asíncronas en curso (fetch, timers). En Threshold se usa en `findAvailableBackendParallel()` para abortar los checks de backend perdedores una vez que el primero responde con 200.

### Active Recall (Recuerdo Activo)
Práctica cognitiva de forzar al cerebro a recuperar información de la memoria sin pistas externas (ej. voltear una flashcard de Threshold). Es el pilar del sistema de aprendizaje junto a la repetición espaciada.

### ADR (Architecture Decision Record)
Documento formal que registra una decisión arquitectónica importante: el contexto, las opciones consideradas y la decisión tomada. Ejemplo: `ADR-012-DashboardBootPipeline.md`. Sirven como memoria histórica del "por qué" de cada decisión.

### Aggregate / Aggregate Root
Concepto de Domain-Driven Design (DDD). Un agregado es un clúster de entidades y *Value Objects* tratados como una unidad con sus propias invariantes. El *Aggregate Root* es la entidad principal a través de la cual interactúan agentes externos. En Threshold, `Subject` actúa casi como un Aggregate Root para un curso entero.

### AI Capability
Abstracción dentro del `AIOrchestrator` que encapsula una capacidad de IA específica. Hay 5 en Threshold: **Chat**, **Flashcard** (generación), **OCR**, **PDF** (extracción) y **Transcription** (audio). Cada Capability conoce sus proveedores disponibles y cómo invocarlos.

### AI Execution Policy
Conjunto de reglas que determinan cómo se ejecuta una operación de IA. Tiene 6 modos: `local-only`, `cloud-only`, `local-preferred`, `cloud-preferred`, `fastest`, `cheapest`. La política se configura según el Device Tier y la conectividad.

### AI Orchestrator
Módulo central (`AIOrchestrator.ts`) que coordina todas las capacidades de IA. Decide qué proveedor usar (local vs. cloud) según la `AIExecutionPolicy`. Los consumidores solo conocen el Orchestrator, nunca a Groq, Gemini ni llama directamente.

### ALTER TABLE
Comando SQL que modifica la estructura de una tabla existente (agrega columnas, cambia tipos). Las migraciones de Threshold usan `ALTER TABLE ... ADD COLUMN`. Se verifica con `PRAGMA table_info` antes para evitar errores de columna duplicada.

### Ancla Cognitiva
Término acuñado en Threshold para referirse a un tipo especial de flashcard o elemento de diseño destinado a diferenciar, contrastar y desambiguar términos confusos o muy similares dentro de un mazo. Actúa anclando la diferencia específica en la memoria del estudiante.

### Arquitectura Limpia (Clean Architecture)
Paradigma de diseño donde las reglas de negocio (Dominio) están en el centro absoluto, aisladas rigurosamente de los detalles de implementación como la UI, la red o la base de datos, lo que permite cambiar herramientas sin reescribir el negocio.

### Assessment (Evaluación)
Entidad del dominio que representa un examen, parcial, entrega universitaria o hito. Genera notificaciones automáticas y se vincula fuertemente al Reminder Engine para proyectar alertas regresivas.

### AsyncStorage
Librería de React Native para almacenamiento clave-valor asíncrono. En Threshold se usa como **caché HTTP con TTL de 10 minutos** para respuestas GET. Más lento que MMKV (basado en JS). Considerado **legacy** frente a MMKV.

### Asset
Archivo binario que pertenece a un usuario: foto, grabación de audio, documento escaneado. A diferencia de los metadatos (JSON), los assets siguen el **Asset Pipeline** en lugar del Sync Protocol estándar.

### Asset Entity Pattern
Patrón de sincronización para entidades que contienen un binario. La entidad se divide en: (1) **Metadata** → Sync Protocol como JSON, (2) **Binario (blob)** → Asset Pipeline. La `cloud_url` sí se sincroniza; la `local_uri` nunca.

### Asset Locality Invariant
Invariante arquitectónico: ningún dato específico del dispositivo puede sincronizarse. `local_uri`, rutas absolutas, cachés locales y permisos del SO quedan excluidos del Sync Protocol.

### Asset Pipeline
Infraestructura de sincronización para archivos binarios. Orquestada por `AssetSyncEngine`. Incluye: `AssetUploadManager` (2 concurrentes, retry exponencial), `AssetDownloadManager` (3 concurrentes, prioridades, resume), `PersistentLocalAssetStore` (LRU 3GB) y `AssetValidator` (checksum post-descarga).

### AssetDownloadManager
Gestiona las descargas de binarios desde la nube. Admite 3 descargas concurrentes, verifica checksums, asigna prioridades y puede reanudar descargas interrumpidas.

### AssetSyncEngine
Orquestador del Asset Pipeline (`AssetSyncEngine.ts`). Coordina uploads y downloads de binarios de forma separada al sync JSON. Se integra como fase paralela dentro del `SyncManager`.

### AssetUploadManager
Gestiona las subidas de binarios a la nube. Admite 2 uploads concurrentes con retry exponencial ante fallos de red.

### AssetValidator
Verifica la integridad de los assets descargados calculando y comparando checksums. Detecta archivos corruptos post-descarga.

### At-least-once Delivery
Garantía del Sync Protocol: toda operación en la cola se reintentará hasta 5 veces antes de descartarse. Puede causar que el servidor reciba la misma operación más de una vez, lo que se maneja con idempotencia.

### Atomic Card Generator
Utilitario backend (`atomicCardGenerator.js`) que fragmenta automáticamente flashcards con demasiado contenido en tarjetas más pequeñas y atómicas, optimizadas para la retención cognitiva.

### AudioSynchronizer
Implementación de `EntitySynchronizer` para grabaciones de audio. Extiende el Asset Entity Pattern aplicado a `audio_recordings`.

---

## B

### Backend
Servidor API REST construido en **Node.js + Express** (JavaScript CommonJS). No es la fuente de verdad: es un mecanismo de sincronización, respaldo y continuidad entre dispositivos. La lógica de dominio vive en el móvil.

### Barrel File (`index.ts`)
Archivo que consolida y re-exporta múltiples módulos de un directorio. En Threshold, se debe tener especial cuidado al usarlos porque pueden causar *Require Cycles* indeseados.

### BaseRepository
Clase base (`BaseRepository.ts`) que implementa operaciones CRUD sobre SQLite para todos los repositorios. Proporciona: `insert()`, `update()` (con auto-incremento de `version_number`), `delete()`, `findById()`, `findAll()`. Siempre emite eventos al `RepositoryEventBus` tras cada mutación.

### bcrypt
Algoritmo de hashing para contraseñas. El backend usa `bcrypt` con salt rounds configurables. Nunca se almacenan contraseñas en texto plano.

### Blueprint
Plano o diseño arquitectónico fundamental. En Threshold, los "Blueprints" son los documentos fundacionales (como `SYNC_PROTOCOL.md` o `NOTIFICATION_ARCHITECTURE.md`) que definen inexorablemente cómo deben estructurarse los motores lógicos o componentes antes de que una sola línea de código sea escrita.

### Boilerplate
Secciones de código repetitivo y rígidamente estructurado que se requiere incluir en múltiples lugares. Threshold usa Zustand y custom React Hooks para minimizar el boilerplate comparado con alternativas como Redux.

### Bootstrap
Proceso de arranque de la aplicación orquestado por `BootstrapManager.ts`. Fases: **DB** (SQLite + migraciones) → **MMKV** (hydration) → **READY** (loadAllData) → **NETWORK** (fire-and-forget) → **SYNC** (fire-and-forget). La red **nunca bloquea** el arranque.

### BootstrapManager
Módulo (`BootstrapManager.ts`) que orquesta las fases del bootstrap. Garantiza que la UI esté lista antes de que la red responda. Emite el estado `READY` cuando SQLite y MMKV están disponibles.

### Bottom Sheet
Componente UI modal que emerge desde la base de la pantalla. Es el patrón visual primario en Threshold para presentar menús contextuales, selectores rápidos y pequeños formularios (`BottomSheetModal`).

### Bridge (React Native)
Sistema legacy de React Native donde JS y los módulos nativos se comunican asíncronamente mediante mensajes serializados en JSON. En Threshold, está siendo reemplazado por JSI vía la New Architecture.

### Bundle ID
Identificador único de la app en los stores. En Threshold: `com.oponobono.threshold`.

### Bytecode
Representación intermedia de código JavaScript compilada por **Hermes** antes de ejecutarse. Reduce radicalmente el tiempo de startup.

---

## C

### Cache Policy Manager
`CachePolicyManager.ts` — módulo que determina cuánto tiempo viven los datos en caché según el tipo de entidad y el estado de conectividad.

### Card Log
Registro histórico de cada sesión de repaso de una flashcard (`card_logs`). **No es una entidad sincronizable** — es auditoría pura. No tiene `sync_version` ni `deleted_at`. Se conserva indefinidamente incluso si el card padre es borrado. Fuente de verdad para analytics y métricas FSRS históricas.

### Cascade (Delete)
Propagación de un borrado desde una entidad padre a todas sus entidades hijas. Ejemplo: borrar un `subject` también borra sus `courses`, `flashcard_decks`, `assessments`, `ai_chats`, `audio_recordings`, `scanned_documents` y `youtube_transcripts`. Cada hijo también se registra en `sync_deletions`.

### CDN (Content Delivery Network)
Red de servidores distribuidos que sirven archivos estáticos con baja latencia. En Threshold, **UploadThing** actúa como CDN para fotos, documentos y audios.

### Checksum
Valor hash calculado sobre el contenido de un archivo para verificar su integridad. El `AssetValidator` calcula y compara checksums post-descarga para descartar corrupción.

### CI/CD (Continuous Integration / Continuous Delivery)
Flujo automatizado de integración y despliegue. En Threshold: **GitHub Actions** ejecuta la Reminder Regression Suite (275 tests) en cada push. **EAS Build** automatiza los builds nativos.

### CommonJS
Sistema de módulos de Node.js. El backend usa `"type": "commonjs"` — los archivos usan `require()` y `module.exports` en lugar del `import/export` de los ES Modules.

### Componente (Component)
Bloque de construcción fundamental en React Native (archivos `.tsx`). En contraste con un *Módulo*, un Componente UI se enfoca estrictamente en la capa de presentación (renderizado visual, inputs del usuario) y jamás debe procesar lógica de dominio pesada ni orquestar a la base de datos.

### Concurrency (Concurrencia)
Ejecución simultánea o intercalada de múltiples tareas. Threshold maneja concurrencia controlada en la descarga de assets (vía `AssetDownloadManager`), limitando los hilos simultáneos para no ahogar la red ni agotar la memoria.

### ConflictResolver
Módulo (`ConflictResolver.ts`) que resuelve conflictos de sincronización entre la versión local y la del servidor. Implementa 4 estrategias: `LAST_WRITE_WINS`, `SERVER_WINS`, `CLIENT_WINS` y `MERGE`.

### Confidence Score
Métrica del dominio de conocimiento que representa qué tan seguro es el sistema sobre el nivel de dominio del usuario en un tema. Se calcula a partir de datos FSRS y se expone a través del `KnowledgeSnapshot`.

### ConsistencyReport
Herramienta (`ConsistencyReport.ts`) que verifica la convergencia del Sync Engine comparando el conteo de filas por tabla entre el backend y todos los dispositivos simulados.

### Contrato (Contract)
Conjunto inquebrantable de reglas y firmas que define cómo se comunican dos piezas de software (ej. entre un Módulo y el Dominio, o entre Cliente y API). En Threshold, los "Contratos Arquitectónicos" (ej. `Sync Entity Contract`, `KnowledgeProvider`) gobiernan el diseño de los motores, prohíben el acoplamiento sucio y dictan qué métodos y payloads son aceptables.

### Convergence Score
Métrica que mide qué tan alineados están los datos entre dispositivos tras una sincronización. Un score de 100% indica convergencia total.

### CORS (Cross-Origin Resource Sharing)
Mecanismo HTTP que controla qué dominios pueden hacer requests al backend. El backend usa el paquete `cors` configurado para permitir solo orígenes autorizados.

### Course
Entidad del dominio que representa una materia/asignatura universitaria asociada a un semestre o periodo académico. Es hija de `subject`. Entidad sincronizable.

### Course Hub
Funcionalidad que agrupa las materias en un acordeón visual (`CourseAccordion`, `CourseSubjectCard`), calcula el `aggregatedMomentumScore` y aplica `momentum decay`.

### CRUD
Acrónimo para las 4 operaciones básicas sobre persistencia: **C**reate, **R**ead, **U**pdate, **D**elete. Cada entidad sincronizable tiene CRUD completo tanto local (SQLite) como remoto (API REST).

### Curva del Olvido (Forgetting Curve)
Modelo matemático de Ebbinghaus que describe cómo decae y se esfuma la retención de memoria con el tiempo si no hay repaso. FSRS en Threshold se basa íntegramente en aplanar y domar esta curva para cada flashcard.

---

## D

### Data Loader
`DataLoader.ts` — módulo que carga todos los datos necesarios durante el bootstrap desde SQLite hacia los stores Zustand. Se ejecuta en la fase READY.

### DataStore
Capa de abstracción de datos que agrupa Repositories y Queries. La UI siempre consume datos a través de DataStore, Repositories o Queries — **nunca directamente desde `services/api`**.

### Debouncing
Técnica que agrupa una ráfaga de eventos rápidos (ej. inputs de teclado veloces) en uno solo que se ejecuta después de que transcurra un tiempo *sin* nuevos eventos. Previene operaciones costosas redundantes.

### Deep Linking
Mecanismo que permite abrir una pantalla específica de la app desde una URL externa o desde otra app usando un schema (ej. `threshold://`).

### Deletion Version (`deletion_version`)
Número de versión asignado a cada entrada en `sync_deletions`. Es el criterio principal para que otros dispositivos descubran qué fue borrado. `deleted_at` es solo metadata de auditoría — **toda decisión de sync usa `deletion_version`**.

### Delta Sync
Sincronización incremental: solo descarga las entidades cuyo `sync_version` es mayor al último conocido por el cliente. Endpoint: `GET /api/sync/delta?version=N`.

### Dependency Injection (DI)
Patrón de diseño donde un objeto recibe pasivamente aquellos objetos de los que depende en lugar de crearlos él mismo. Ejemplo: FSRS recibe la fecha actual en lugar de ejecutar `new Date()` interno, garantizando su determinismo.

### Dependency Resolver
Módulo (`DependencyResolver.ts`) del `SyncQueueReducer` que ordena topológicamente las operaciones reducidas para respetar el orden causal: subject se debe crear antes que su course, y course antes que su flashcard-deck.

### Design Token
Variable del sistema de diseño que representa un valor semántico (color, tipografía, espaciado). Se definen en `src/styles/theme.ts`. Los componentes usan tokens, no valores hardcodeados para garantizar consistencia.

### Device Tier
Clasificación del dispositivo según su RAM **total** en: `low`, `medium` o `high`. Determina la `AIExecutionPolicy` activa. 

### Docusaurus
Framework de generación de sitios estáticos basado en React, mantenido por Meta. Se utiliza en Threshold para construir, estructurar y publicar la documentación técnica, arquitectónica y de producto (incluyendo este diccionario).

### Domain (Dominio)
Esfera de conocimiento, reglas, procesos e invariantes alrededor de la cual gira la lógica de la aplicación (ej. Learning Domain, Reminder Domain). En Threshold, operar sobre el dominio significa ir más allá de un simple CRUD, integrando reglas de negocio rigurosas.

### Domain-Driven Design (DDD)
Enfoque de arquitectura de software aplicado fuertemente en Threshold. Separa las responsabilidades en dominios aislados, enfocándose en modelar la lógica profunda del negocio y desacoplando estrictamente la capa de infraestructura (red, BD) y la capa de presentación (UI).

### Domain Service
Clase que orquesta la lógica de negocio profunda de una entidad. `FlashcardDomainService` es el único autorizado para modificar los metadatos FSRS. Los Domain Services no conocen la capa de red ni la UI.

### dotenv
Librería que carga variables de entorno desde un archivo `.env`. El backend la usa para mantener credenciales de manera segura.

### DTO (Data Transfer Object)
Objeto "tonto" utilizado para empaquetar datos y enviarlos de un subsistema a otro (ej. de Backend a Móvil). Los DTOs no tienen comportamiento, métodos ni lógica interna; son puramente valijas de transporte estructurado.

### Dual Write
Técnica de migración donde el backend escribe datos en dos formatos simultáneamente para garantizar compatibilidad hacia atrás durante una transición crítica.

---

## E

### EAS (Expo Application Services)
Plataforma cloud de Expo para builds y publicaciones. **EAS Build** compila el APK/IPA en la nube; **EAS Submit** lo publica en Google Play o App Store.

### End-to-End (E2E) Testing
Pruebas que validan un sistema entero de principio a fin, simulando el flujo completo de un usuario en un entorno muy cercano a la producción.

### Engine (Motor)
En la nomenclatura de Threshold, un Engine es un sistema lógico autónomo responsable de una tarea sistémica masiva, de alta complejidad computacional o de orquestación en background. Sus ramificaciones tocan toda la app. Ej: `Reminder Engine`, `Sync Engine`, `Grading Engine`.

### Entity (Entidad)
Concepto de DDD: Un objeto que tiene una identidad constante a través del tiempo y que puede modificarse (mutar sus propiedades), a diferencia de un *Value Object* que es inmutable.

### Entity Synchronizer
Interfaz abstracta (`EntitySynchronizer.ts`) que define el contrato para sincronizar un tipo específico de entidad. Las implementaciones concretas son `PhotoSynchronizer`, `AudioSynchronizer`, `DocumentSynchronizer`.

### Event Bus
Sistema de comunicación pub/sub que desacopla emisores de consumidores. En Threshold: `RepositoryEventBus` (mutaciones de BD → stores Zustand) y `OperationProgressEmitter` (progreso de LROs → UI + notificaciones).

### Expo
SDK y ecosistema de herramientas que simplifica el desarrollo React Native. Provee módulos nativos precompilados, el sistema de build EAS y el Router basado en archivos.

### Expo Router
Sistema de routing basado en archivos para React Native (similar a Next.js). Las rutas se definen por la estructura de carpetas en `/app`. Soporta typed routes y deep linking automático.

### expo-secure-store
Módulo de Expo que guarda datos sensibles en el **Keychain** (iOS) o **Keystore** (Android). Almacena los JWT tokens. Es el único lugar donde se guardan secretos en texto plano.

### expo-sqlite
Módulo de Expo que expone SQLite nativo en Android e iOS. Es la fuente de verdad local de Threshold para todos los datos estructurados del dominio.

---

## F

### Fabric (Renderer)
Nuevo sistema de renderizado de React Native (New Architecture). Reemplaza al renderizador JavaScript-based por uno que se comunica directamente con el hilo UI nativo a través de JSI.

### Feature Flag / Feature Toggle
Técnica de ingeniería que permite encender o apagar bloques funcionales enteros de la aplicación (ej. una nueva vista IA) dinámicamente sin necesidad de compilar o desplegar un binario nuevo en las tiendas.

### Feature Matrix
Documento (`FEATURE_MATRIX.md`) que mapea cada entidad del sistema a sus capacidades: lifecycle, estado, relaciones, capacidades IA y soporte offline. Toda entidad nueva debe completarla antes de implementarse.

### FIFO (First In, First Out)
Política de cola donde el primer elemento en entrar es el primero en salir. La `sync_queue` local funciona como una cola FIFO para operaciones pendientes.

### File-based Routing
Paradigma de Expo Router donde la estructura de carpetas en `/app` define automáticamente las rutas, reduciendo el boilerplate de configuración.

### Fire-and-forget
Patrón donde se inicia una operación asíncrona pero la aplicación no se detiene a esperar su resultado. En el bootstrap, la detección de la red (`NETWORK`) y el sync (`SYNC`) son fire-and-forget.

### Flashcard
Tarjeta de estudio con frente y reverso. Son entidades sincronizables atadas rigurosamente a metadatos FSRS (`fsrs_stability`, `fsrs_difficulty`, `next_review_date`).

### Flashcard Deck (Mazo)
Entidad lógica (`flashcard_decks`) que agrupa colecciones de flashcards bajo el paraguas de un `Subject`. Sirve como el contenedor primario de estudio secuencial y aloja tanto *Anclas Cognitivas* como tarjetas atómicas.

### FlashcardDomainService
Domain Service que es la **única autoridad** para modificar los metadatos FSRS de una flashcard. Calcula el nuevo estado, persiste en SQLite, emite eventos y encola la operación en el Sync Engine.

### FlashList
Componente de lista de ultra-alto rendimiento desarrollado por Shopify. En Threshold, reemplaza a `FlatList` para renderizar colecciones masivas (ej. flashcards o subjects), reutilizando vistas en memoria para no dropear frames a 60 fps.

### Foreign Key (FK)
Restricción de base de datos que referencia la clave primaria de otra tabla impidiendo orphan data. En SQLite se deben activar explícitamente encendiendo `PRAGMA foreign_keys = ON`.

### FSRS (Free Spaced Repetition Scheduler)
Algoritmo de repetición espaciada v4.5. Calcula cuándo mostrar una flashcard basándose en `stability` (durabilidad de la memoria) y `difficulty` (dificultad de recordar). Es la **única fuente de verdad del conocimiento** en Threshold.

### FSRS Difficulty
Parámetro FSRS (`fsrs_difficulty`) que representa qué tan difícil le resulta al usuario recordar un concepto. Oscila matemáticamente, y mayor dificultad → intervalos más cortos.

### FSRS Repetitions
Contador de repasos realizados sobre una flashcard (`fsrs_repetitions`). Usado por FSRS para la proyección del intervalo subsecuente.

### FSRS Stability
Parámetro FSRS (`fsrs_stability`) que representa qué tan estable o longeva es la memoria del usuario sobre un concepto. Mayor estabilidad → intervalos más largos.

---

## G

### GGUF
Formato de archivo binario y serializado para modelos de lenguaje cuantizados. Los modelos de Zyren en modo offline (Llama, Phi, Mistral) se cargan en este formato ultraligero a través de `llama.rn`.

### Ghost Deletion (borrado fantasma)
Bug que ocurre cuando un dispositivo hace DELETE + CREATE de la misma entidad de manera rápida pero el registro en `sync_deletions` no se limpia. Al sincronizar, otros dispositivos aplican el DELETE ciegamente y eliminan la entidad recién creada. Se previene llamando `removeDeletion()` tras un RESTORE.

### Glassmorphism
Estética de diseño UI que simula vidrio esmerilado: fondos con blur, transparencia y bordes sutiles con luz direccional. Usado en overlays y modales de Threshold para aportar un feel orgánico y premium.

### Grading Engine
Servicio backend (`gradingEngine.js`) que traduce y normaliza calificaciones entre diferentes sistemas (0-5, 0-10, 0-100, letras de USA), operando como motor de conversión académica.

### Groq
Proveedor cloud de inferencia LLM ultra-rápida (LPU). El backend usa la API REST de Groq con modelos `llama-3.3-70b-versatile` (principal) y `llama-3.1-8b-instant` (fallback).

---

## H

### Haptic Feedback
Retroalimentación táctil del dispositivo (vibraciones del motor háptico). Threshold lo emplea sutilmente en transiciones críticas para confirmar interacciones físicas (`expo-haptics`).

### Helmet
Middleware de Express en el backend que configura headers HTTP de seguridad: CSP, HSTS, X-Frame-Options, previniendo vectores comunes como clickjacking o XSS.

### Hermes
Motor de JavaScript optimizado para React Native por Meta. Compila JS a bytecode (AOT) durante el build, reduciendo la penalidad inicial del startup de la app. Activo obligatoriamente en RN 0.81.

### Hook (React)
Función de React que inyecta estado y side-effects en componentes funcionales. Threshold posee docenas de hooks personalizados en `src/hooks/` aislando la complejidad.

### Hook de Dominio
Un React Hook específico (ej. `useKnowledgeInsights`) que trasciende al manejo simple de estado UI. Encapsula la suscripción profunda al EventBus y efectúa llamadas directas a un Contrato (KnowledgeProvider), entregando información de negocio pre-masticada a las pantallas.

### HSL (Hue, Saturation, Lightness)
Modelo de color preferible a RGB/HEX porque permite ajustar paramétricamente el brillo o saturación garantizando paletas armoniosas sin requerir diseño ad-hoc.

### HSTS (HTTP Strict Transport Security)
Header HTTP emitido por el backend que obliga a los navegadores o clientes API a comunicarse vía HTTPS exclusivamente, denegando el downgrade HTTP.

### HTTP Cache
Caché de nivel de transporte para reducir ancho de banda. Threshold la implementa mediante AsyncStorage para respuestas GET idénticas (TTL: 10 mins).

### Hydration
Proceso crudo de extraer datos del almacenamiento persistente físico (MMKV, SQLite) y volcarlos hacia la RAM en los stores (Zustand) al arrancar. Fase vital para operar Offline-First al instante.

---

## I

### i18n (Internationalization)
Proceso de adaptación de software para tolerar y mutar según múltiples lenguajes y regiones. En Threshold se implementa vía `i18next` + `react-i18next` abarcando español, inglés y portugués.

### IDOR (Insecure Direct Object Reference)
Vulnerabilidad explotable donde un usuario manipula IDs de la API para intervenir datos de otro usuario. Threshold la previene mediante el middleware `validateOwner.js`.

### Idempotencia
Propiedad matemática/computacional donde aplicar una operación repetidas veces produce invariablemente el mismo resultado que aplicarla una sola vez. En Sync, un CREATE fallido reintentado 5 veces no crea 5 registros gracias a las operaciones `UPSERT`.

### Initial Sync
Primera gran operación de sincronización. Descarga en un único dump el estado del mundo (`user_id`). Se detona si la app detecta que el `lastSyncVersion === 0`.

### INSERT ... ON CONFLICT DO UPDATE
También llamado **UPSERT**. Intenta insertar una nueva fila SQL; si colisiona con un ID primario existente, aplica un UPDATE condicional. Base absoluta de la idempotencia en Threshold.

### Interfaz (Interface)
Declaración formal de un Contrato en TypeScript. Oculta la implementación interna sucia de un Módulo y expone y documenta únicamente los métodos públicos permitidos (ej. `NotificationProvider`).

### InterruptionPolicy
Módulo del motor de recordatorios (`InterruptionPolicy.ts`) que intercepta una notificación inminente y autoriza o deniega su disparo en función del contexto (No Molestar, Silencio, en Llamada, etc).

### Invariante (Invariant)
Regla de negocio, dogma o axioma arquitectónico absoluto que nunca debe romperse bajo ninguna circunstancia. Ejemplo en Threshold: "La red nunca bloquea el Bootstrap", o "El Snapshot cognitivo es cien por ciento inmutable".

---

## J

### JS Thread
El hilo principal de ejecución lógico en React Native donde corre todo el runtime de JavaScript. Su principal debilidad es que si se bloquea computacionalmente, la UI entera dropea frames (se congela).

### JSI (JavaScript Interface)
Capa fundamental de la New Architecture de React Native que destruye el antiguo puente asíncrono, permitiendo comunicación en memoria sincrónica (C++) entre JavaScript y módulos nativos pesados (Skia, MMKV, Nitro).

### JSON (JavaScript Object Notation)
Formato texto ubicuo de serialización. En Threshold se persisten en JSON tanto las configuraciones como los payloads completos dentro del SQLite local (`sync_queue`).

### JWT (JSON Web Token)
Estándar criptográfico para transferir identidad. El backend emite tokens; el app los refugia en `expo-secure-store` y los incluye en cabeceras de API bajo el scheme `Bearer`.

---

## K

### Keychain (iOS) / Keystore (Android)
El bóveda hardware/software cifrada y segura a nivel de sistema operativo para refugiar credenciales sensibles. Expuesta a React Native a través de `expo-secure-store`.

### Knowledge Domain
Universo de dominio, interfaces y abstracciones matemáticas que rige cómo calcula, proyecta y expone Threshold el estado cognitivo del usuario (su cerebro virtual en la app).

### KnowledgeHealthCard
Componente visual del Dashboard que dibuja el pulso cognitivo del aprendizaje de un usuario. Es puro (sólo renderiza lo provisto por `KnowledgeSnapshot`) sin saber qué motor ni base de datos hay detrás.

### KnowledgeProjection
El maestro de orquesta del Learning Domain. Succiona los datos crudos FSRS desde SQLite vía `KnowledgeQuery`, se los alimenta al Builder, y entrega finalmente el `KnowledgeSnapshot` a la UI.

### KnowledgeProvider
Fachada o interfaz pública estricta. Todo elemento fuera del dominio (Dashboards, IA, Calendar) está obligado a usar al Provider para solicitar información cognitiva, manteniéndolos agnósticos a las matemáticas internas.

### KnowledgeSnapshot
**Value Object** cien por ciento inmutable que congela el estado de conocimiento del usuario en un nanosegundo de tiempo. Al instanciarse se sella con `Object.freeze()`. Nadie lo muta: requiere crear uno nuevo.

### KnowledgeSnapshotBuilder
Implementación pura del patrón Builder que procesa FSRS y escupe un `KnowledgeSnapshot`. Totalmente aislado y carente de I/O directo.

---

## L

### Last Write Wins (LWW)
Estrategia de resolución de conflictos pragmática. Ante dos modificaciones en pugna, gana la versión cuyo timestamp `updated_at` sea matemáticamente más reciente en tiempo absoluto. Estrategia reina del `ConflictResolver`.

### lastSyncVersion
Puntero guardado localmente (MMKV) por cada cliente. Actúa como marcador de libro (bookmark): indica el último estado de la historia remota (`sync_version` global) del cual este dispositivo tiene conocimiento.

### Lazy Loading (Carga Diferida)
Patrón de optimización esencial. Ciertos módulos pesados, vistas Lottie o dependencias no se cargan en la RAM al arranque inicial de Threshold, sino que se inyectan dinámicamente solo en el milisegundo exacto en que el usuario los solicita.

### Learning Health
Categoría dentro del `KnowledgeSnapshot` que destila las matemáticas y dice, en términos legibles (Tarjetas Críticas, Salud %, Buen estado), cómo le está yendo al estudiante.

### llama.rn
Bindings eficientes puenteando `llama.cpp` a React Native, capacitando a dispositivos de gama media y alta a levantar inferencia LLM en RAM propia. (Cerebro offline de Zyren).

### LMS (Learning Management System)
Software institucional de las universidades (Moodle, Blackboard, Canvas). Threshold los integra vía conectores `lms_accounts` en un esfuerzo de ingestión de información sin fricción (ETL).

### Local-First
Principio de diseño radical. El SQLite embebido en el teléfono celular es tratado soberanamente como la Fuente de Verdad Inmediata, de cara a la UI. El Backend es relegado a rol de replicador secundario o nube de respaldo.

### Local URI
Ruta del disco local físico (`file://...`) apuntando a un archivo. En Threshold, **Nunca** abandona el dispositivo ni viaja en un Sync (Violaría el Asset Locality Invariant) porque perdería sentido en otro celular.

### Lock / Deadlock (Database is locked)
Escenario catastrófico transitorio en SQLite. Múltiples promesas/threads forcejean para alterar registros y el motor levanta escudos cerrando los archivos de DB. Threshold usa WAL mode y triggers manuales de Checkpoints para suavizar la pugna concurrente.

### Lottie
Formato de gráficos vectoriales animados con código puro (JSON), 100x más eficientes que un video. Threshold los explota para construir las visualizaciones inmersivas y orgánicas como la esfera interactiva de Zyren.

### LRO (Long Running Operation)
Abstracción de Threshold para controlar UX en operaciones que excedan la fricción (2+ segundos). Obliga terminantemente a fluir su estado usando el `OperationProgressEmitter`, prohibiendo que el autor de la operación invoque notificaciones manuales o alertillas sueltas, delegándoselo todo al framework.

### LRU (Least Recently Used)
Algoritmo de expulsión (eviction) para vaciar espacio. Si la App excede 3GB llenándose de PDFs, el `PersistentLocalAssetStore` buscará y barrerá silenciosamente aquellos activos no tocados durante mayor tiempo.

---

## M

### Memoization
Táctica drástica de performance. Consiste en guardar el resultado derivado de una función o componente costoso en memoria caché, escupiendo este remanente en lugar de recalcular al toparse de nuevo con el mismo Input. (`useMemo`, `useCallback`, `React.memo`).

### Memory Level
El escaño conceptual donde descansa la asimilación del usuario de una Flashcard (`new`, `learning`, `review`, `mature`), calculado estrictamente derivando la curva de retención de FSRS.

### Metro Bundler
El empaquetador oficial de Meta para React Native. Su trabajo es ingerir las dependencias de node_modules y el código TS, transformarlo velozmente en un mega-paquete consumible por Hermes para montar el bundle on-the-fly y durante HMR.

### Middleware
Capa de software interceptora. En el Backend (Express), son funciones encadenadas que examinan el Request entrante antes de dejarlo pasar al Controlador definitivo, escudando a Threshold procesando validaciones (Zod), Autenticaciones (JWT) o cabeceras CORS.

### Migration (Base de Datos)
Guión inmutable que instruye cómo mutar el esquema SQL de un estado `n` al estado `n+1`. Corren estricta y cronológicamente sólo una vez por dispositivo. En Threshold se ha refinado el `Migration Runner` para que evadan crashes usando flags `PRAGMA table_info` si la mutación ya existía sorpresivamente en el disco.

### MMKV
El motor de Key-Value Storage ultrarrápido creado por WeChat (Tencent), codificado en C++. En Threshold releva los flags, configuraciones y variables de Bootstrap. **Prohibido** usarlo como fuente de verdad para el negocio (Ese es el reino de SQLite).

### Mock
Maniquí de código. Implementación falsa de un módulo inyectada durante testings automáticos que obedece dictados e intercepta llamadas de manera controlada. Ej: `NotificationSchedulerMock` garantiza correr pruebas unitarias sobre Recordatorios sin gatillar alertas reales a los desarrolladores.

### Módulo (Module)
Pieza de arquitectura lógica, encapsulada y altamente cohesionada que agrupa Repositorios, Servicios, Validaciones y Contratos para cumplir una misión sistémica. (Ej. Módulo de Recordatorios, Módulo de Sincronización). Un Módulo reside en las entrañas del motor, a diferencia de los Componentes que viven en la presentación (UI).

### Momentum Score
Formula implementada en el Hub de Cursos. Evalúa el peso y la masa activa del estudiante. Decae fríamente si no se ejerce actividad (Momentum Decay). Recompensa al usuario cuando mantiene tracción sostenida.

### Monorepo
Práctica Dev-Ops: Guardar el backend, el app frontend y hasta las documentaciones en un mega-repositorio de Git interconectado. Ayuda a preservar la consistencia sincrónica si se introduce un cambio en un contrato compartido (Payload API).

### Morgan
Software de bitácora (Logging middleware) inyectado al servidor Node.js que escupe trazas de toda petición recibida a la consola, facilitando la depuración visual.

### Multer
Modulo Node.js que se encarga exclusivamente de destripar los envíos en ráfaga (Multipart Form Data) recibiendo el byte-stream del teléfono celular para estacionar binarios o assets temporalmente.

### Mutation Matrix
Cuadro estratégico de auditoría (Documento `MUTATION_MATRIX.md`). Inventaría las acciones de UX y verifica si sus ondas expansivas tocan (y limpian) cascadas, dependencias o registros de sincronización según lo dictado por la arquitectura.

---

## N

### NetInfo
Librería que interpela a los radios del teléfono reportando (mediante triggers event-based) si el dispositivo navega en WIFI, LTE o si ha naufragado al modo sin conexión. Orquestador base para decidir si el LRO aborta, pausa, o confía en la cola de Background Sync.

### New Architecture (React Native)
Revolución estructural por defecto desde React Native 0.81 (y 0.68+ como bandera experimental). Dinamita el Bridge histórico abrazando JSI, TurboModules nativos y el Fabric Renderer para lograr interoperabilidad con C++ saltando penalidades en el paso de variables (serializaciones en JSON).

### Nitro Modules
Sistema agnóstico que explota las bondades de JSI, agilizando escandalosamente la creación de TurboModules para integrarlos a RN con 0% impacto en el Event Loop.

### Node.js
Motor que extirpa el runtime V8 fuera del navegador y lo usa en servidores de propósito general. Es el andamiaje donde ruge el backend de Threshold (Node >= 18).

### no-op
*No-Operation*. Expresión para designar un estado nulo de acción. Si el Sync Reducer lee en la cola que un Card se creó en un instante y 2 segundos después el usuario la borró furiosamente (`CREATE` + `DELETE`), la condensa y neutraliza como `no-op`, aligerando la carga de red.

### Notifee
Library suprema (y paga comercialmente alguna vez) de Push Notifications y recordatorios que maneja las peculiaridades crueles y disímiles entre Android e iOS. En Threshold está arrinconada tras un interfaz (`NotifeeOperationProvider`) para nunca permear a los servicios core del negocio.

### NotificationProvider
Contrato TypeScript de hierro. Define a qué deben atenerse las alarmas sin comprometer qué tecnología emite los sonidos.

### NotificationReconciler
Sistema autónomo que confronta agresivamente dos realidades paralelas de Threshold: "Lo que el motor de BD local dice que debes recordarme" Vs "Lo que el Sistema Operativo del Teléfono dice que tiene programado despertar". Si no coinciden, purga y resetea (Healing).

### NotifeeOperationProvider
Estrategia en código concreta y servil a `NotificationProvider`. Su tarea aburrida es invocar flags del Sistema Operativo como (Canal Ongoing, AutoCancel) a través de Notifee.

---

## O

### Observer Pattern
Mecanismo de diseño donde una matriz ("Sujeto") colecciona instancias pasivas de observadores, para radiarles instantáneamente alertas cuando sufra mutaciones. Base fundacional del EventBus y la reacción en cadena de los componentes Zustand hacia la UI de Threshold.

### OCR (Optical Character Recognition)
Algoritmos que "ven" un .JPG o PDF rastrillándolo para extraer párrafos ASCII entendibles. En Threshold se usa intensamente Google ML Kit (Offline) y Modelos Vision 11B (Cloud) para extraer jugos de los escaneos documentales.

### Offline-First
Axioma de experiencia de usuario de Threshold: Cero *Spinners* congelantes. Al abrir la App el usuario no es mendigo del ancho de banda. Puede crear materias enteras desconectado del planeta. La red no dicta sus rutinas de estudio, las complementa asíncronamente en el background.

### ON CONFLICT
Instrucción de SQLite fundamental. Protege el estado determinista y conjura las debilidades HTTP dictaminando cómo proceder cuando una llave choca. Threshold usa compulsivamente `ON CONFLICT(id) DO UPDATE SET...` forjando Upserts anti-balas.

### OpenAPI / Swagger
Especificación universal e interactiva que documenta la superficie y el vientre de la API. En Threshold, permite usar UI en Swagger `/api-docs` para jugar o entender qué rutas viven en Node.

### OperationProgressEmitter
Bus de Eventos especializado (Singleton) que trafica reportes fríos (progreso, finalización, fallecimiento, aborto) emanados de las LRO en las sombras de los servicios y entregados cordialmente a la UI.

### OperationReducer
Motor lógico empotrado en la infraestructura del SyncQueue. Reduce las operaciones atómicas apiladas a un estado comprimido usando reglas puras.

### Orphan Data
*Datos Huérfanos*. Basura estancada o registros que pierden su Padre debido a borrados negligentes que omitieron arrastrar cascadas. Vulnerabilidad purgada históricamente mediante revisiones exhaustivas sobre la `Ownership Matrix`.

### Ownership Matrix
Mapeo de jerarquías: Padre -> Hijo que sella dependencias (Eje: Subject -> Course -> FlashcardDeck -> Flashcard). Documento vital que blinda el código ante el riesgo de Orphan Data.

---

## P

### PaaS (Platform as a Service)
La infraestructura en la nube moderna donde no configuramos servidores Ubuntu crudos. **Render** aloja el código de Threshold y gestiona la RAM, Puertos y CPU sin burocracia de DevOps.

### Payload
La carga valiosa que viaja dentro de la cabina (Body) de un Request de API. También es el furgón que transporta información del estado mutado dentro de la Cola Local `sync_queue`. En contexto de Cifrado (JWT) son los secretos o IDs incrustados.

### PDF Extractor Module
Surgió por carencias severas de React Native para deglutir textos pesados Offline. Es un módulo nativo customizado a medida (`threshold-pdf-extractor`) codificado en Kotlin/Swift.

### PersistentLocalAssetStore
Bóveda inteligente (File Manager) que administra los miles de PDF e imágenes del sistema operando el FileSystem y desalojando con (LRU de 3GB) si detecta que la salud de la ROM del dispositivo padece escasez.

### Pipeline
Arquitectura en cadena de ensamblaje industrial donde la salida (output) de un módulo es inyectada intacta como la entrada (input) del siguiente bloque. Threshold posee **Asset Pipelines** y **Reducer Pipelines** donde el dato viaja transformándose por etapas controladas.

### Policy Engine
Juez supremo de `AIOrchestrator` que evalúa contextos variables: RAM (`Device Tier`), Status Red (NetInfo), Bandera Preferencial y dictamina en fracciones de segundo si Groq debe ser invocado o la Llama on-device debe despertar.

### PostgreSQL
Motor Open Source legendario. Si bien el local-first domina en los móviles (SQLite), el Backend fue hibridado para tolerar PostgreSQL.

### PRAGMA
Órdenes y secretos crípticos del motor SQLite para activar comportamientos (Ej. `PRAGMA foreign_keys = ON`, `PRAGMA table_info`). Las Migraciones de Threshold dependen dramáticamente de ellos.

### Presentation Layer
Capa frágil de Threshold. Los componentes funcionales `.tsx`. Regla de Hierro arquitectónica: JAMAS tocan una red, API o BD; Sólo rinden los destilados inyectados por los Hooks / Zustand.

### Publisher-Subscriber (Pub/Sub)
Diseño de comunicación donde la voz parlante no tiene ni idea de quién o cuántos la están oyendo, y los oyentes están pasivos esperando el anuncio para transitar estados (Total desacoplamiento UI vs Logic).

### Pull (Sync)
Momento del ciclo de sincro donde Threshold clama y exige traccionar diferencias (Deltas) desde el Backend.

### Pure Function (Función Pura)
Concepto matemático infalible. Se garantiza que f(x)=y en el 100% de las trillones de corridas si X es la misma invariante. Cero estados globales, cero llamadas I/O por debajo de cuerda. Todo `calculateFSRS` y el `ReductionPipeline` de Threshold deben honrar este axioma.

### Push (Sync)
Momento de desahogo de sincro donde el Móvil empuja frenéticamente la cola reducida e idempotente para reescribir la base del Backend.

---

## Q

### Query (Dominio)
Concepto que engloba a módulos estrictos de consulta en BD `(read-only)`. Ajenos a side-effects (escrituras, locks). `KnowledgeQuery` arranca y ensambla vistas transaccionales.

---

## R

### Race Condition
Anomalía brutal concurrente de Software. (Ejemplo corregido de los Subjects: Un SELECT que verificaba la existencia y tardaba nanosegundos adicionales en el INSERT, permitiendo a otro Thread re-insertar rompiendo Unique Keys). Todo arreglado con UPSERT transaccionales.

### Rate Limiting
Muralla defensiva (`express-rate-limit`) que asfixia Requests malintencionados en el Backend que buscan colapsar a punta de metralleta el Login o la API de Threshold.

### React Compiler
*(Aka. React Forget)*. Avance revolucionario en experimentación que erradica la escritura manual asfixiante de hooks de *Memoization* (Muerte a los `useMemo`), pre-calculando el árbol virtual. Threshold lo activa como optimización agresiva de Vanguardia.

### React Native
Ecosistema robusto de Facebook. Abstracción que permite usar JSX + Lógica JS (o TS) generando comandos interpretables para los views nativos del Sistema Operativo de Apple y Google.

### Reanimated
Biblioteca salvadora frente al cuello de botella del viejo "Bridge". Traslada y ejerce la gimnasia computacional de animaciones vectoriales delegándolas agresivamente al "UI Thread" aislado mediante *Worklets*. Los `60 Frames Per Second` de Threshold viven o mueren por ella.

### ReductionReport
Reporte estructurado con estadísticas escupido rutinariamente luego que un proceso del Pipeline SyncReducer mutila una cola pesada para resumirla. (Incluyendo los muertos: `merged`, `noop`, `restored`).

### Refactoring (Refactorización)
Alteración profunda de entrañas arquitectónicas o estéticas del bloque de código. Regla: Ningún Refactor agresivo debe desfigurar las aserciones públicas finales; un test bien parametrizado deberá seguir validándolo en luz verde (A menos que exista un cambio sustancial del Dominio).

### Regression Testing
Batallón de Tests Automatizados inquebrantables e inflexibles que se disparan post-integración, destinados a re-certificar que el desarrollador no ha roto funcionalidades viejas en nombre del código nuevo. El *Reminder Regression Suite* es el orgullo de la CI.

### Render (PaaS)
Hogar definitivo del Backend y base de datos relacional Cloud de Threshold.

### Reminder Engine
Masa encefálica del ecosistema LRO y Agenda de Threshold. Triturador lógico `(ReminderEngine.ts)` que mastica calendarios, husos horarios, y dictados de dominancia, emitiendo veredictos a NotificationScheduler sin contaminar su proceso con Notifee.

### ReminderCoordinator
Guardián esclavo del EventBus. Su trabajo silencioso es atestiguar y espiar las ráfagas de alteraciones de base de datos en torno a Exámenes o Citas y alertar vigorosamente al `ReminderEngine` para recambios de notificación.

### Reminder System
Sistema mastodóntico y maduro del Domain de Recordatorios, forjado para aguantar transiciones horarias (`mobile/src/services/reminders/`). Probado y blindado contra fuego con 23 suites y aprox. 300 checks de CI.

### Repetición Espaciada (Spaced Repetition)
Técnica madre de aprendizaje cognitivo. Consiste en incrementar paulatinamente los intervalos de tiempo en blanco entre repasos de un material previamente entendido. Threshold la lleva a su máximo exponente implementando el algoritmo **FSRS** para esculpir el Knowledge Domain.

### Repository
Capa intermedia. Encapsula y entierra los `SELECT`, `UPDATE` y consultas Sqlite, aislando estas primitivas rudimentarias para dotar al resto del programa de contratos limpios de acceso. Todo Save de DB emite Events en cascada.

### RepositoryEventBus
La plaza pública del Pub/Sub en Threshold. Las vibraciones de Inserciones y Eliminaciones logradas resuenan allí para despertar re-enriquecimientos incrementales en Zustand minimizando costosas recargas totales.

### Require Cycle
Antipatrón y Warning. (A.ts llama B.ts, y B.ts sin darse cuenta, requería funcionalidades del padre A.ts). El JS Runtime colapsará si esto sucede antes de resolver el Graph de instancias. Se pule en Threshold desglosando la dependencia e invirtiendo la carga.

### REST API
Arquitectura que abraza peticiones semánticas uniformes basándose en HTTP. (Métodos, Headers, URLs y Verbos).

### RESTORE (Sync)
Estado paradójico virtual en Sincronizaciones Offline extremas. Dos impulsos seguidos por el mismo UUID (`DELETE` y de repente un violento `CREATE`). El Reducer cancela su aniquilación invocando una redención de registro.

### Retrievability
Cálculo en vivo y directo desde las arterias de FSRS. Porcentaje matemático que traduce si el alumno se asoma al abismo cognitivo del olvido (`Retrievability %`) ahora mismo. Threshold purga otras métricas defectuosas y usa a la retrievabilidad como estandarte del Knowledge.

---

## S

### Safe Area
Márgenes e islotes geométricos físicos que roban espacio a los displays móviles (El Notch, La Isla Dinámica, Barra del Gestual inferior de iOS/Android). `react-native-safe-area-context` y modales las respetan evadiendo recortes anti-estéticos.

### Salt (bcrypt)
Condimento aleatorio (caracteres basuras extra) concatenados a una Password antes de quemarla y hashearla para evadir colisiones y los ataques Rainbow Tables.

### Semantic Cache
Espectacular optimización que empareja heurísticamente la estructura y los vectores de un query textual a IA y busca similitudes latentes pasadas. Threshold mitiga abusos de cuotas a API evitando procesar dos consultas lógicamente iguales.

### SequenceFactory
Máquina despachadora y multiplicadora para los Recordatorios. Una siembra única (Ej. 1 Parcial el Sábado a las 8am) es clonada topográficamente para engendrar cascadas de alertas (`1 Semana antes`, `2 Días`, `1 hora`, `15 mins`).

### Serialización / Deserialización
El proceso de aplastar y congelar el estado crudo de memoria (Instancias complejas) reduciéndolos a Strings transportables (JSON) y viceversa. Vital en Threshold para que los Arrays de mutaciones del LWW sobrevivan a la persistencia en `sync_queue`.

### SF Symbols
Sistema glífico nativo masivo y elegante diseñado por Cupertino (Apple). Las UI de Threshold lucen iconos refinados y escalables a través del bridge `expo-symbols`.

### Singleton
Patrón y Ley ineludible en el ámbito global del Software: "De esta clase sólo nacerá una copia para servir durante la sesión". Imprescindible para el `EventBus` que no puede bifurcar emisiones en instancias separadas.

### Skia
Motor todoterreno gráfico (El mismo V8 2D de Google Chrome). Potencia los radares, canvas y florituras que superan las limitantes impuestas del componente primario `<View>`.

### SM-2 (SuperMemo 2)
Ancestro y algoritmo matemático de repetición espaciada obsoleto. Mantenido unicamente como compatibilidad pre-migratoria en Backend y destronado globalmente en las operaciones lógicas de Threshold por **FSRS**.

### Smoke Test (Prueba de Humo)
Inspección superficial relámpago e inicial ejecutada antes de derramar recursos masivos. Confirma que la estufa o el bloque no explota (literalmente "hace humo") evaluando flujos mínimos. Threshold los usa en su Stress Suite.

### Soft Delete
"Borrados fantasma". La fila o tabla no desaparece atómicamente destruida del disco de SQLite, sólo se la apaga insertándole una estampa mortal temporal (`deleted_at` timestamp). Resurrecciones y Sincronizaciones dependen de conservar dicha información en las auditorías.

### Source of Truth (Fuente de Verdad)
Cualquier almacén que el sistema acepte como la voz innegable sobre un estado. Threshold decreta a SQLite como Fuente de Verdad Operativa en el celular; y entrona matemáticamente al bloque FSRS como la **Única** Fuente de Verdad Cognitiva del estudiante (Prohibiendo derivar lógicas de promedios simples).

### SQLite
Emperador local e implacable del Threshold de producción Offline. Archivo embebido relacional de DB veloz y maduro que gobierna la estructura local sin recaer sobre latencias web.

### Standard Entity Pattern
Modelo que designa entidades que fluyen limpiamente y con peso pluma sobre la red. Toda su biografía es texto/JSON. Ej. Subjects.

### State Machine (Máquina de Estados)
Patrón determinista implementado (LRO, Reducer) que fuerza un control lineal rígido en procesos variables, impidiendo el anarquismo. (Un status no puede saltar ilógicamente de "Preparando" a "Aplastado" ignorando pasos transitorios y validaciones).

### Store (Zustand)
Cubículos en memoria RAM rápida que centralizan dictámenes (Player Status, Connection, Modals, Flashcards Loaded).

### Strategy Pattern (Patrón Estrategia)
Diseño pragmático que acoraza el "Qué hacer" del "Cómo hacerlo". Intercambia motores silenciosamente (En Threshold, el `NotificationProvider` subcontrata la estrategia a Notifee pero en Tests muta al Mock-Provider transparente).

### Stress Suite
Infierno simulado a propósito y batería de asedio alojado en `tests/stress`. Invoca simuladores para destripar al motor enviando paquetes perdidos, resucitando teléfonos en Sync simultáneo para comprobar que los Conflicts se reparen ilesos.

### Subject
Reyes funcionales de Threshold y Aggregate Roots. Los pilares que rigen, conectan y dictan si el Curso, Examen, Tarjeta y Modos IA subsisten.

### SubjectKnowledge
Sub-categoría de los agregados en `KnowledgeSnapshot`, reaccionando a qué nivel académico pulsa una materia.

### Supadata.ai
Motor SaaS de IA en la web invocado por el Backend en los Controllers para drenar Transcripciones crudas desde Links mudos de YouTube.

### Sync Debugger
Forensia interna. Módulo rastreador que impone y emite el pasaporte (`X-Trace-Id`) por cada embudo para inspeccionar cuellos de botella mediante timings temporales (15 etapas) hasta grabarlos en Logs.

### Sync Deletions
Cementerio contable (`sync_deletions`). Tabla puente para registrar el pasaporte y versión final a los caídos. Permite a otros clientes preguntar "¿Quién ha muerto desde la iteración 1050?" e ignorar a los vivos.

### Sync Entity Contract
Reglas draconianas para que un tabla acceda al Club Sincronizable de 1ra Clase del Engine (Debe ostentar UserId, SyncVersions, participar del Pull y Deltas, figurar en Stress Suites).

### Sync Journal
Archivador crudo introducido en v20. Auxilia y audita sobre los registros transaccionales muertos a la par del SyncQueue.

### Sync Manager
Cerebro máximo (Orquestador global) del Sync Engine.

### Sync Protocol v1.0
Estatuto inviolable en piedra y documento sagrado en MarkDown (`SYNC_PROTOCOL.md`) validado tras ardua normalización. Ningún desarrollador está autorizado a quebrar idempotencias ni manipular sus arquitecturas de Conflictos si altera el Sync.

### Sync Queue
Tolva de abordaje (Cola persistida en `sync_queue` Local SQLite). Las modificaciones y baches nacidos sin WiFI acampan aquí intentando zarpar, reintentando un máximo de 5 empujones (`retries`) si hay bloqueos hostiles 500xx.

### SyncQueueReducer
Aplastador y filtro algorítmico mágico. Extrae miles de rebotes incoherentes y cacofónicos desde la Tolva (Cola) y amasa/comprime sus vectores garantizando ahorros masivos HTTP.

### sync_version (Global)
El segundero del mundo y Dios universal del Backend. Tickea y muta incondicionalmente a +1 con toda Escritura confirmada.

### sync_version (Per-row)
Marca de agua local embutida por tabla, respondiendo "Este row particular fue refrescado bajo qué Tick-Global". Armas la consulta rápida `WHERE sync_version > MiCelularConoce...` para destapar la magia de Deltas.

---

## T

### Template Resolver
Aglutinador semántico (`TemplateResolver.ts`). Encargado en tiempo de compilación y aviso de prender los moldes con las variables (`$NOMBRE_EXAMEN`) y escupir lenganzas procesados (Español o Inglés).

### Test Suite
Racimos densos de pruebas estáticas e interrelacionadas (`.test.ts`) codificadas y afirmadas rigurosamente en Jest para corroborar si el motor lógico sigue sano tras un huracán de modificaciones o un refactor.

### Threshold (app)
Personal Knowledge Platform local-first e offline-first pensada obsesivamente contra la fricción cognoscitiva en Universitarios y devoradores de conocimiento denso.

### Throttling (Notificaciones)
Bypass controlador. Frena el entusiasmo algorítmico del EventBus en los LROs y escupe Notificaciones de UI apaciguadas para no asfixiar brutalmente a la barra Android o colgar visualmente el iPhone. (Frecuencia Top: 1 cada 250ms).

### Topological Sort
Ordenación rígida (Árboles matemáticos). El "Course" siempre va bajo del "Subject", la "Tarjeta" trascienden del "Mazo". En el Reducer dictamina la prioridad al vuelo.

### Transaction (Transacción DB)
Mecanismo SQLite indivisible (`BEGIN TRANSACTION -> COMMIT`). Protege al sistema garantizando que o la Operación A con Cascadas masivas entra perfecta e inmaculada al disco, o el lote entero choca, colapsa y devuelve su estructura pasada (`Rollback`) resguardando a Threshold de corrupciones parciales letales.

### TTL (Time To Live)
Temporizador cruel implementado para los Cachés HTTP del sistema (AsynStorage). Marca cuántos minutos pasaran antes de que la data añeja merezca un reemplazo total desde la Nube. (Usual: 10 mins).

### TypeScript
Superpoder del Stack. Abrazado de extremo a extremo en RN mobile aportando estricto tipado (`types, generics`), evadiendo explosiones o falacias semánticas letales para compiladores de Node.

---

## U

### UI Thread
El hilo privilegiado del Smartphone (`Native iOS/Android`). Todo el bloque visual está subordinado a sus 60/120 Hz de empujes. Los Worklets con Reanimated explotan esta trinchera.

### UploadThing
Bodega remota, Cloud Storage masivo que aloja los Assets del mundo físico de Threshold sin saturar el Backend base (Render).

### UPSERT
*Update o Insert*. Maniobra quirúrgica central, apoyada en el condicional de Conflicto. Funde las peticiones previniendo falsos negativos sobre existencias.

### UUID (Universally Unique Identifier)
Clave inquebrantable estandarizada al azar (v4, v7). Todo ente, Subject, Flashcard en Threshold se ampara a ellos sin preguntar al Backend por ID's, desvinculando la dependencia conectiva original (Offline creation de raíz).

---

## V

### Validation Rules
Capa perimetral final implementada en el `SyncQueueReducer`. Comprueba al vuelo fallos de coherencia (`Si el Padre de un Mazo es Huérfano en SQL -> aborta`).

### Value Object
Axioma sagrado. Bloques matemáticos y atómicos (`KnowledgeSnapshot`). No posee identidad. Se clona entero si es alterado. Está sellado por `Object.freeze()` previniendo mutaciones piratas por desarrolladores confundidos en ramas remotas.

### version_number
Sello incremental local de 1 en 1 que acoraza a Threshold en Disputas y Conflictos LWW, previniendo choques lógicos per-entity en la BD. Nunca toca o define el SyncVersion global.

---

## W

### WAL (Write-Ahead Log)
Mecanismo de SQLite crítico para Threshold. Las modificaciones a las tablas son apiladas secuencialmente primero sobre el bit-log y posteriormente vaciadas a la base consolidando rendimientos multi-lecturas vertiginosos que salvan de los temidos *Locks*.

### Whisper
Arquitectura IA sonora y masiva de Inteligencia Abierta entrenada por OpenAI para deglutir audio bruto y producir texto (Transcripción Offline). En Threshold se ampara vía `whisper.rn`.

### Worklets
Pequeñas cajas negras JS en Reanimated 3 con poderes transfronterizos. Ejecutables directos en el "UI Thread" puro en forma supersónica evadiendo a toda costa el peso letal del "JS Thread" ahogado.

---

## Z

### Zod
Centinela del Backend. Evalúa rígidamente esquemas validando payloads engañosos, inyecciones e incoherencias de TypeScript contra el REST devolviendo un `400 Bad Request` antes de que toquen base en Express.

### Zustand
Framework Zen de reactividad. Un minúsculo oso (Bear) que controla docenas de re-renderizaciones anidadas de las Store principales, desmarcando el monstruoso *Boilerplate* tradicional exigido por Redux en el pasado.

### Zyren
Alma IA de la Arquitectura Threshold. Contextual y omnipotente (LPU Groq y Llama On-device). Orbe con vida visual y Lottie Animations. Extrae, Genera y dialoga en multiesferas del conocimiento.

### Zyren Ingestion
Flujo de ingesta tri-partita donde la IA vampiriza contenidos (Lecturas, Pdfs, Videos YT) reventándolas, digiriéndolas y ensamblándolas a mazos FSRS listos y empaquetados.

---

## Stack Tecnológico

Agrupación de las principales herramientas, lenguajes y librerías que conforman la arquitectura y el entorno de desarrollo de Threshold. (Para definiciones detalladas, consulta el índice alfabético).

### Frontend & Mobile App
- **React Native (0.81)**: Framework base para compilación cruzada iOS/Android.
- **Expo & Expo Router**: SDK de herramientas nativas y sistema de routing basado en archivos.
- **Hermes**: Motor de JavaScript optimizado (AOT) por defecto en React Native.
- **Metro Bundler**: Empaquetador de JavaScript oficial de Meta.
- **React Compiler**: Herramienta de vanguardia para memoización automática.
- **TypeScript**: Lenguaje fuertemente tipado transversal a todo el código.
- **Zustand**: Gestor de estado global ligero sin boilerplate.
- **SQLite (expo-sqlite)**: Motor de base de datos relacional local (fuente de verdad).
- **MMKV**: Almacenamiento key-value en C++ para cachés y banderas ultra-rápidas.
- **expo-secure-store**: Bóveda criptográfica (Keychain/Keystore) para secretos y JWTs.
- **Reanimated (v3) & Skia**: Motores gráficos y de animación a 60fps usando Worklets y JSI.
- **FlashList**: Renderizador de listas masivas optimizado (Shopify).
- **Lottie**: Renderizador de animaciones vectoriales JSON.
- **Notifee**: Gestor avanzado de notificaciones push y canales locales.
- **i18next / react-i18next**: Librerías de internacionalización (i18n).
- **expo-haptics**: Interfaces para retroalimentación táctil nativa.
- **expo-symbols**: Puente para renderizar íconos SF Symbols nativos de Apple.

### Backend & API
- **Node.js**: Runtime de JavaScript en servidor.
- **Express**: Framework minimalista para la REST API.
- **Zod**: Validador de esquemas e inferencia de tipos para payloads.
- **PostgreSQL**: Base de datos relacional del lado del servidor.
- **Multer**: Middleware para parseo de subidas binarias (*multipart/form-data*).
- **Morgan & Helmet**: Middlewares para logging HTTP y cabeceras de seguridad.
- **bcrypt**: Librería criptográfica para hashing de contraseñas.
- **jsonwebtoken (JWT)**: Generador y validador de tokens de identidad.
- **Swagger / OpenAPI**: Ecosistema para documentar y probar la API interactiva.
- **dotenv**: Cargador de variables de entorno para protección de credenciales.

### Inteligencia Artificial
- **llama.rn & whisper.rn**: Bindings nativos para ejecutar modelos GGUF LLM y transcripción offline.
- **Google ML Kit**: Motor OCR on-device nativo.
- **Groq**: Proveedor cloud de inferencia ultrarrápida (LPU) para modelos grandes.
- **Supadata.ai**: Servicio cloud para extracción de transcripciones de YouTube.

### Infraestructura & DevOps
- **Render**: Platform as a Service (PaaS) que aloja el Backend y la BD PostgreSQL.
- **UploadThing**: CDN y storage en la nube optimizado para los assets de los usuarios.
- **EAS (Expo Application Services)**: Nube de integración para compilar (EAS Build) y publicar (EAS Submit) nativamente.
- **GitHub Actions**: Pipeline de CI/CD para ejecutar el Reminder Regression Suite y Stress Suite.
- **Jest**: Framework de testing en TypeScript, pilar de las Regression y Stress Suites.
- **Docusaurus**: Motor estático para la web de documentación oficial.
- **Git**: Sistema de control de versiones distribuido que hospeda el monorepo.

---

## Apéndice — Acrónimos Rápidos

| Acrónimo | Significado |
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

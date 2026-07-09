# Arquitectura de Seguridad - Threshold

Este documento detalla las múltiples capas de seguridad implementadas en la aplicación Threshold para proteger tanto el backend ([[API_DOCUMENTATION|API]]) como el frontend (aplicación móvil) y las integraciones con Inteligencia Artificial.

---

## 1. Seguridad en la Capa de Transporte y Red
- **Protección contra DDoS y Rate Limiting:** Se implementó `express-rate-limit` en todas las rutas de la API para prevenir ataques de denegación de servicio (DDoS) y ataques de fuerza bruta.
- **Protección de Cabeceras HTTP (Helmet):** Se utiliza `helmet` para configurar de manera segura las cabeceras HTTP en el backend, previniendo ataques comunes como Cross-Site Scripting (XSS), clickjacking y sniffers de MIME-types.

## 2. Autenticación y Autorización
- **JSON Web Tokens (JWT):** Todas las rutas protegidas requieren un token JWT válido. Los tokens aseguran que los usuarios solo puedan acceder y modificar sus propios datos académicos (materias, notas, documentos).
- **Control de Acceso basado en ID:** El backend valida consistentemente que el `userId` en la solicitud coincida con los recursos solicitados, previniendo escalada de privilegios horizontales (acceder a datos de otro estudiante).

## 3. Gestión Segura de Secretos y Estado Móvil
- **Almacenamiento Seguro (Mobile):** Se migró el almacenamiento local en la aplicación móvil de `AsyncStorage` (texto plano) a `Expo SecureStore`. Esto garantiza que los tokens JWT de sesión se almacenen de manera encriptada a nivel de sistema operativo (Keychain en iOS, Keystore en Android).
- **Módulo de Configuración Fail-Fast (Backend):** Todas las variables de entorno (claves de API de Gemini, secretos JWT, puertos) están centralizadas en un módulo de configuración que aplica validación estricta al arrancar. Si falta una clave crítica, el servidor falla inmediatamente ("fail-fast"), evitando arranques en estados vulnerables o impredecibles.

## 4. Validación de Entradas y Protección contra Archivos Maliciosos
- **Filtro de "Magic Numbers":** Para la subida de documentos (PDF, DOCX, imágenes), no confiamos únicamente en la extensión del archivo (`.pdf`). Se implementó una validación a nivel de bytes leyendo las firmas del archivo ("Magic Numbers") para garantizar que el archivo sea verdaderamente el tipo de documento que dice ser, previniendo la subida de ejecutables camuflados.
- **Limpieza de Inputs:** Sanitización de datos provenientes del cliente antes de ser insertados en la [[DATABASE_DOCUMENTATION|base de datos]] (SQLite) para prevenir SQL Injection.

## 5. Seguridad en Inteligencia Artificial ([[ZYREN_BORN|Zyren]] AI)
- **Escudo de Prompt Injection v2 (System-Level Shield):** Las instrucciones del sistema de la IA tutora (Zyren) están protegidas en el backend con directivas explícitas de "Prompt Shielding". Esto evita que los usuarios manipulen el comportamiento del asistente para revelar configuraciones internas, saltarse filtros éticos o ejecutar comportamientos maliciosos a través del chat o de documentos escaneados con contenido inyectado.
- **Pre-filtro de Jailbreak (detectJailbreak):** Se implementó un sistema de detección de 25+ patrones de jailbreak en el módulo `promptShield.js` que analiza los mensajes del usuario antes de enviarlos al modelo de IA. Detecta intentos de: cambio de personalidad (DAN, Developer Mode), extracción de system prompt, token smuggling (base64), inyección de XML, simulación de diálogos, y referencias a override de seguridad. Se aplica tanto en el chat académico (`aiChat`) como en los endpoints de procesamiento de documentos.
- **Post-filtro de fugas (detectSystemPromptLeak):** Analiza la respuesta de la IA después de generarse para detectar si el modelo reveló sus instrucciones internas (system prompt). Si detecta una fuga, reemplaza la respuesta con un mensaje académico seguro.
- **Instrucciones de seguridad en System Message:** Las reglas de seguridad se envían como parte del mensaje de sistema (`system` role) en lugar de envolver el input del usuario. Esto las hace más efectivas contra jailbreaks. Incluye una cláusula explícita que protege la generación automática de [[FLASHCARDS_COMPLETE_DOCUMENTATION|mazos]] (`%%DECK_ACTION%%`) como funcionalidad académica legítima.
- **Eliminado encabezado peligroso:** Se removió `[SYSTEM_SECURITY_OVERRIDE_ENABLED]` del wrapper de prompts, ya que podía ser interpretado literalmente por el modelo como una autorización para ignorar restricciones.

## 6. Seguridad en Importación de Mazos JSON

### 6.1 Validación de Esquema por Tipo de Tarjeta
Cada tarjeta importada es validada estructuralmente según su tipo antes de insertarse en la base de datos:

| Tipo | Validaciones |
|------|-------------|
| **flashcard** | `front` y `back` deben ser strings no vacíos (máx. 2000 caracteres c/u) |
| **multiple_choice** | `question` (string), `options` (array de 2 a 6 strings), `correctIndex` (entero dentro del rango de options) |
| **boolean** | `question` (string), `correctAnswer` (boolean, no string) |

La validación se aplica tanto en el frontend (previo al envío) como en el backend (antes de insertar en SQLite), asegurando defensa en profundidad.

### 6.2 Sanitización contra Prototype Pollution
Se implementó la función `sanitizeJSON()` que elimina recursivamente las claves `__proto__`, `constructor` y `prototype` de cualquier objeto JSON importado. Se aplica tanto en el cliente (`FlashcardImportModal.tsx`) después de `JSON.parse`, como en el backend (`flashcardsController.js`) antes de procesar cada tarjeta.

### 6.3 Límites de Tamaño y Cantidad
- **Máximo 20 tarjetas por mazo:** Validado en frontend y backend. Un mazo con más de 20 tarjetas es rechazado con un mensaje claro.
- **Máximo 50KB por tarjeta:** El campo `content_json` de cada tarjeta no puede exceder 50KB. Se verifica en ambos lados.
- **Máximo 10MB por archivo JSON:** Validado por el cliente antes de leer el archivo.

### 6.4 Control de Propiedad (Ownership)
- La creación de mazos (`createFlashcardDeck`) ahora utiliza `req.user.id` del JWT en lugar de confiar en el `user_id` enviado por el cliente. Se eliminó el envío de `user_id` desde el frontend.
- La creación de tarjetas (`createEvaluationItem`) verifica que el mazo asociado pertenezca al usuario autenticado antes de insertar, consultando la tabla `flashcard_decks` con el `deckId` y comparando contra `req.user.id`.

### 6.5 Plantilla JSON Sanitizada
La guía descargable (`plantilla_mazo_threshold.json`) fue sanitizada:
- Se eliminó el campo `subject_id` del ejemplo para no sugerir asignación arbitraria de materias.
- Se eliminó el campo `_INSTRUCCIONES_` (convención de guión bajo atípica).
- Los ejemplos ahora son autocontenidos con texto descriptivo en cada campo que funciona como instrucción de formato.
- Se incluyen ejemplos de los 3 tipos de tarjeta: `flashcard`, `multiple_choice` (con `correctIndex: 0` en base cero), `boolean` (con `correctAnswer: true/false`), y `flashcard` con código markdown.

---
*Este documento se mantendrá actualizado conforme la arquitectura de seguridad evolucione o se añadan nuevos vectores de protección.*

---
**Tags:** #audits

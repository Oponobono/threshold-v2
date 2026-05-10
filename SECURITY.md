# Arquitectura de Seguridad - Threshold

Este documento detalla las múltiples capas de seguridad implementadas en la aplicación Threshold para proteger tanto el backend (API) como el frontend (aplicación móvil) y las integraciones con Inteligencia Artificial.

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
- **Limpieza de Inputs:** Sanitización de datos provenientes del cliente antes de ser insertados en la base de datos (SQLite) para prevenir SQL Injection.

## 5. Seguridad en Inteligencia Artificial (Zyren AI)
- **Escudo de Prompt Injection (System-Level Shield):** Las instrucciones del sistema de la IA tutora (Zyren) están protegidas en el backend con directivas explícitas de "Prompt Shielding". Esto evita que los usuarios manipulen el comportamiento del asistente para revelar configuraciones internas, saltarse filtros éticos o ejecutar comportamientos maliciosos a través del chat o de documentos escaneados con contenido inyectado.

---
*Este documento se mantendrá actualizado conforme la arquitectura de seguridad evolucione o se añadan nuevos vectores de protección.*

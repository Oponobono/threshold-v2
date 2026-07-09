# 📚 Documentación Completa de API - Threshold

**Versión:** 3.0 | **Fecha:** 2026-05-22 | **Endpoints:** 100+ | **Status Codes:** Documentados

---

## 📋 Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Autenticación](#2-autenticación)
3. [Usuarios](#3-usuarios)
4. [Materias Académicas](#4-materias-académicas)
5. [Evaluaciones y Calificaciones](#5-evaluaciones-y-calificaciones)
6. [[[FLASHCARDS_COMPLETE_DOCUMENTATION|Flashcards]] y Repaso Espaciado](#6-flashcards-y-repaso-espaciado)
7. [Multimedia](#7-multimedia)
8. [IA y Tutor [[ZYREN_BORN|Zyren]]](#8-ia-y-tutor-zyren)
9. [Learning Analytics](#9-learning-analytics)
10. [Backup y Sincronización](#10-backup-y-sincronización)
11. [Códigos de Estado](#11-códigos-de-estado)

---

## 1. Arquitectura General

### 1.1 Estructura Base

```
BASE_URL: http://localhost:3000/api  (desarrollo)
BASE_URL: https://threshold.onrender.com/api  (producción)
```

### 1.2 Autenticación Global

**Todas las rutas excepto `/register` y `/login` requieren:**
```
Authorization: Bearer <JWT_TOKEN>
```

### 1.3 Rate Limiting

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| `/register`, `/login` | 5 intentos | 15 min |
| `/ai/*` | 10 requests | 1 min |
| Otros | 100 requests | 15 min |

### 1.4 Documentación Interactiva

**Swagger/OpenAPI disponible en:**
```
http://localhost:3000/api-docs
```

---

## 2. Autenticación

### 2.1 Registro de Usuario

**Endpoint:**
```http
POST /register
```

**Body:**
```json
{
  "email": "estudiante@ejemplo.com",
  "password": "MiContraseña123!",
  "name": "Juan",
  "lastname": "García",
  "username": "jgarcia",
  "university": "Universidad Nacional",
  "major": "Ingeniería Informática",
  "semester": "2025-2",
  "grading_scale": "5.0",
  "approval_threshold": 3.0
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "email": "estudiante@ejemplo.com",
  "username": "jgarcia",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "status": "active",
  "created_at": "2026-05-22T10:30:00Z"
}
```

**Errores:**
- `400`: Email o campos faltantes
- `409`: Email ya registrado
- `500`: Error interno

### 2.2 Login

**Endpoint:**
```http
POST /login
```

**Body:**
```json
{
  "email": "estudiante@ejemplo.com",
  "password": "MiContraseña123!"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "email": "estudiante@ejemplo.com",
  "username": "jgarcia",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "display_name": "Juan García"
}
```

**Errores:**
- `400`: Campos faltantes
- `401`: Credenciales inválidas o cuenta eliminada
- `429`: Too many attempts (rate limited)

### 2.3 Login Biométrico

**Endpoint:**
```http
POST /biometric-login
```

**Headers:**
```
Authorization: NOT REQUIRED
```

**Body:**
```json
{
  "biometric_token": "hash_de_biometria_del_dispositivo"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "estudiante@ejemplo.com"
}
```

---

## 3. Usuarios

### 3.1 Obtener Perfil

**Endpoint:**
```http
GET /users/:userId
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "email": "estudiante@ejemplo.com",
  "name": "Juan",
  "lastname": "García",
  "username": "jgarcia",
  "university": "Universidad Nacional",
  "major": "Ingeniería Informática",
  "semester": "2025-2",
  "study_goal": "pass",
  "reference_language": "es",
  "display_name": "Juan García",
  "profile_image": "https://...",
  "created_at": "2026-05-22T10:30:00Z",
  "last_login": "2026-05-22T14:15:00Z"
}
```

### 3.2 Actualizar Perfil

**Endpoint:**
```http
PUT /users/:userId
```

**Body:**
```json
{
  "name": "Juan",
  "lastname": "García López",
  "university": "Universidad Autónoma",
  "semester": "2025-3",
  "study_goal": "excel",
  "reference_language": "pt",
  "display_name": "Juan G."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Perfil actualizado exitosamente"
}
```

### 3.3 Cambiar Contraseña

**Endpoint:**
```http
PUT /users/:userId/password
```

**Body:**
```json
{
  "currentPassword": "MiContraseña123!",
  "newPassword": "NuevaContraseña456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Contraseña actualizada"
}
```

**Errores:**
- `400`: Contraseña actual incorrecta
- `401`: No autorizado

### 3.4 Solicitar Eliminación de Cuenta

**Endpoint:**
```http
DELETE /users/:userId
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Cuenta marcada para eliminación. Tienes 14 días para cancelar.",
  "deletion_date": "2026-06-05T10:30:00Z"
}
```

---

## 4. Materias Académicas

### 4.1 Obtener Todas las Materias

**Endpoint:**
```http
GET /subjects/:userId
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "code": "MAT-101",
    "name": "Cálculo I",
    "credits": 4,
    "professor": "Dr. López",
    "color": "#FF6B6B",
    "icon": "calculator",
    "target_grade": 4.5,
    "normalized_avg_score": 0.86,
    "completion_percent": 65
  }
]
```

### 4.2 Crear Materia

**Endpoint:**
```http
POST /subjects
```

**Body:**
```json
{
  "user_id": 1,
  "name": "Cálculo I",
  "code": "MAT-101",
  "credits": 4,
  "professor": "Dr. López",
  "color": "#FF6B6B",
  "icon": "calculator",
  "target_grade": 4.5
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Cálculo I",
  "code": "MAT-101",
  "created_at": "2026-05-22T10:30:00Z"
}
```

### 4.3 Actualizar Materia

**Endpoint:**
```http
PUT /subjects/:subjectId
```

**Body:** (todos los campos opcionales)
```json
{
  "name": "Cálculo I - Avanzado",
  "professor": "Dra. López García",
  "target_grade": 4.8
}
```

### 4.4 Eliminar Materia

**Endpoint:**
```http
DELETE /subjects/:subjectId
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Materia eliminada (cascada: 45 flashcards, 12 documentos también eliminados)"
}
```

---

## 5. Evaluaciones y Calificaciones

### 5.1 Obtener Evaluaciones de una Materia

**Endpoint:**
```http
GET /assessments/subject/:subjectId
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "subject_id": 1,
    "name": "Parcial 1",
    "type": "exam",
    "date": "2026-06-15",
    "weight": "20%",
    "grade_value": 4.2,
    "normalized_value": 0.84,
    "is_completed": true,
    "out_of": 100
  }
]
```

### 5.2 Crear Evaluación

**Endpoint:**
```http
POST /assessments
```

**Body:**
```json
{
  "subject_id": 1,
  "name": "Parcial 1",
  "type": "exam",
  "date": "2026-06-15",
  "weight": "20%",
  "out_of": 100
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "subject_id": 1,
  "name": "Parcial 1",
  "created_at": "2026-05-22T10:30:00Z"
}
```

### 5.3 Actualizar Calificación

**Endpoint:**
```http
PUT /assessments/:assessmentId
```

**Body:**
```json
{
  "score": 85,
  "percentage": 0.85,
  "grade_value": 4.25
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "grade_value": 4.25,
  "normalized_value": 0.85,
  "updated_at": "2026-05-22T14:00:00Z"
}
```

### 5.4 Proyección de Notas (Grading Engine)

**Endpoint:**
```http
GET /assessments/analytics/subject/:subjectId/projection
```

**Response (200 OK):**
```json
{
  "subjectId": 1,
  "currentAverage": 3.78,
  "currentEMA": 4.0,
  "projectedGrade": 3.89,
  "delta": 0.11,
  "evaluatedWeight": 0.5,
  "remainingWeight": 0.5,
  "assessmentCount": 5
}
```

---

## 6. Flashcards y Repaso Espaciado

### 6.1 Obtener Mazos del Usuario

**Endpoint:**
```http
GET /flashcard-decks
```

**Query Parameters:**
```
?user_id=1
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "subject_id": 1,
    "title": "Capítulo 1: Derivadas",
    "description": "Reglas de derivación",
    "card_count": 25,
    "review_count": 10,
    "learning_count": 5,
    "new_count": 10,
    "due_count": 3,
    "deck_mastery": 65,
    "created_at": "2026-05-20T10:30:00Z"
  }
]
```

### 6.2 Obtener Mazos Priorizados por Urgencia

**Endpoint:**
```http
GET /flashcard-decks/with-metrics
```

**Query Parameters:**
```
?user_id=1
```

**Response:** Misma estructura que 6.1 pero ordenada por:
1. `due_count DESC` (más tarjetas vencidas primero)
2. `learning_count DESC`
3. `deck_mastery ASC` (menos dominio primero)

### 6.3 Crear Mazo

**Endpoint:**
```http
POST /flashcard-decks
```

**Body:**
```json
{
  "user_id": 1,
  "subject_id": 1,
  "title": "Capítulo 1: Derivadas",
  "description": "Reglas de derivación"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "user_id": 1,
  "subject_id": 1,
  "title": "Capítulo 1: Derivadas",
  "card_count": 0
}
```

### 6.4 Obtener Tarjetas Priorizadas ([[spaced_repetition_logic|FSRS]])

**Endpoint:**
```http
GET /flashcard-decks/:deckId/cards/prioritized
```

**Query Parameters:**
```
?userId=1
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "deck_id": 1,
    "front": "¿Cuál es la derivada de x²?",
    "back": "2x",
    "item_type": "flashcard",
    "status": "learning",
    "next_review_date": "2026-05-22T14:00:00Z",
    "sm2_ease_factor": 2.5,
    "fsrs_stability": 1.2,
    "fsrs_difficulty": 0.6,
    "failure_rate": 0.2
  }
]
```

### 6.5 Registrar Revisión de Tarjeta (FSRS)

**Endpoint:**
```http
POST /flashcards/:cardId/review
```

**Body:**
```json
{
  "userId": 1,
  "result": "correct",
  "responseTimeMs": 3500
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "cardId": 1,
  "quality": 4,
  "nextReviewDate": "2026-05-29T14:00:00Z",
  "newStability": 2.1,
  "newDifficulty": 0.5,
  "newRepetitions": 3,
  "retention": 0.92
}
```

### 6.6 Generar Flashcards desde Texto (IA)

**Endpoint:**
```http
POST /flashcard-decks/generate-from-text
```

**Body:**
```json
{
  "user_id": 1,
  "subject_id": 1,
  "title": "Integrales Básicas",
  "text": "La integral indefinida de x² es x³/3 + C...",
  "count": 10
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "deckId": 5,
  "cardCount": 10,
  "cards": [
    {
      "id": 101,
      "front": "¿Cuál es la integral indefinida de x²?",
      "back": "x³/3 + C"
    }
  ]
}
```

### 6.7 Generar Flashcards desde Imagen (OCR + IA)

**Endpoint:**
```http
POST /flashcard-decks/generate-from-image
```

**Body:**
```json
{
  "user_id": 1,
  "subject_id": 1,
  "title": "Notas de la Clase",
  "image_base64": "data:image/png;base64,iVBORw0KGgo...",
  "count": 5
}
```

---

## 7. Multimedia

### 7.1 Subir Documento (OCR)

**Endpoint:**
```http
POST /scanned_documents
```

**Body:**
```json
{
  "user_id": 1,
  "subject_id": 1,
  "name": "Capítulo 1 - Introducción",
  "local_uri": "file:///documents/cap1.pdf"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "user_id": 1,
  "subject_id": 1,
  "name": "Capítulo 1 - Introducción",
  "ocr_text": "Texto extraído...",
  "is_backed_up": 0
}
```

### 7.2 OCR desde Imagen Base64

**Endpoint:**
```http
POST /ocr
```

**Body:**
```json
{
  "base64Image": "iVBORw0KGgo..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "text": "Texto extraído de la imagen..."
}
```

### 7.3 Obtener Transcripción de Audio

**Endpoint:**
```http
GET /audio/:audioId/transcript
```

**Response (200 OK):**
```json
{
  "id": 1,
  "recording_id": 1,
  "transcript_text": "Contenido de la clase...",
  "summary_text": "Resumen: Hoy vimos...",
  "duration": 3600
}
```

---

## 8. IA y Tutor Zyren

### 8.1 Chat con Zyren

**Endpoint:**
```http
POST /ai/chat
```

**Body:**
```json
{
  "session_id": 1,
  "context_text": "Material de referencia...",
  "messages": [
    {
      "role": "user",
      "content": "¿Cómo se calcula una derivada?"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "response": "Una derivada se calcula mediante el límite...",
  "model": "groq_llama2",
  "tokens_used": {
    "input": 150,
    "output": 320
  }
}
```

### 8.2 Generar Flashcards desde Documento

**Endpoint:**
```http
POST /ai/generate-flashcards-from-document
```

**Body:**
```json
{
  "documentPath": "/uploads/capitulo.pdf",
  "count": 15
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "flashcards": [
    {
      "question": "¿Cuál es...",
      "answer": "..."
    }
  ]
}
```

### 8.3 Procesar Documento Completo

**Endpoint:**
```http
POST /ai/process-document-upload
```

**Content-Type:** `multipart/form-data`

**Fields:**
- `file`: archivo PDF/Word/TXT
- `prompt`: instrucción para la IA

**Response (200 OK):**
```json
{
  "success": true,
  "result": "Resultado del procesamiento..."
}
```

### 8.4 Información de Modelos

**Endpoint:**
```http
GET /ai/model-info
```

**Response (200 OK):**
```json
{
  "models": {
    "groq_llama2": {
      "name": "LLaMA 2",
      "rateLimit": "10 req/min",
      "contextWindow": "4096 tokens",
      "used_for": ["chat", "flashcard generation"]
    },
    "gemini": {
      "name": "Gemini Pro",
      "rateLimit": "unlimited",
      "contextWindow": "1M tokens",
      "used_for": ["document processing", "vision"]
    }
  }
}
```

---

## 9. Learning Analytics

### 9.1 Obtener [[PREDICTIONS_ANALYSIS|Predicciones]] de Repaso

**Endpoint:**
```http
GET /analytics/predictions/:userId
```

**Response (200 OK):**
```json
{
  "dueCount": 12,
  "deckCount": 3,
  "cards": [
    {
      "cardId": 1,
      "question": "¿Cuál es...",
      "deckId": 1,
      "deckTitle": "Capítulo 1",
      "subjectId": 1,
      "mastery": 45,
      "urgency": "HIGH",
      "failureRate": 35
    }
  ]
}
```

### 9.2 Obtener Dominio por Materia

**Endpoint:**
```http
GET /analytics/mastery/:userId/:subjectId
```

**Query Parameters:**
```
?subjectId=all  // o ID específico
```

**Response (200 OK):**
```json
{
  "subjects": [
    {
      "subject_id": 1,
      "subject_name": "Cálculo I",
      "mastery_percentage": 78,
      "total_cards": 120,
      "total_reviews": 450,
      "correct_reviews": 351,
      "success_rate": 0.78
    }
  ]
}
```

### 9.3 Registrar Sesión de Estudio

**Endpoint:**
```http
POST /learning/sessions
```

**Body:**
```json
{
  "user_id": 1,
  "subject_id": 1,
  "session_type": "flashcard",
  "config_value": 25,
  "duration_seconds": 1800,
  "performance_rating": 4
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "user_id": 1,
  "session_type": "flashcard",
  "duration_seconds": 1800,
  "created_at": "2026-05-22T14:00:00Z"
}
```

### 9.4 Obtener GPA Global (Agregado)

**Endpoint:**
```http
GET /analytics/global/gpa/:userId
```

**Description:**
Calcula el GPA global agregado del usuario considerando TODAS las evaluaciones sin importar la materia. El promedio se pondera según el porcentaje de evaluaciones por materia para obtener una vista holística del desempeño académico del estudiante.

**Parameters:**
- `userId`: ID del usuario (extraído del JWT, validado para permisos cruzados)

**Response (200 OK):**
```json
{
  "currentAverage": 4.2,
  "projectedGrade": 4.35,
  "delta": 0.15,
  "evaluatedWeight": 65,
  "remainingWeight": 35,
  "assessmentCount": 42,
  "subjectCount": 5
}
```

**Response Fields:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `currentAverage` | float | Promedio ponderado actual (0-5) |
| `projectedGrade` | float | Proyección del GPA final estimado |
| `delta` | float | Diferencia entre proyectado y actual (tendencia) |
| `evaluatedWeight` | float | Porcentaje de evaluaciones completadas |
| `remainingWeight` | float | Porcentaje de evaluaciones pendientes |
| `assessmentCount` | int | Total de evaluaciones realizadas |
| `subjectCount` | int | Número de materias con evaluaciones |

**Calculation Logic:**
- Agrupa todas las evaluaciones del usuario independientemente de materia
- Normaliza cada nota a escala 0-5 usando: `grade = (normalized / maxScale) * 5`
- Calcula promedio ponderado: `average = sum(grade * weight) / sum(weight)`
- Proyección: aplica motor de evaluación (SM-2) para estimar rendimiento futuro
- Delta: diferencia proyectada - actual, indica tendencia

**Error Handling:**
```json
{
  "error": "No assessments found for this user",
  "status": 404
}
```

**Example Integration (React Native):**
```typescript
const fetchGlobalGPA = async (userId: number) => {
  const response = await fetch(`/analytics/global/gpa/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data;
};
```

---

## 10. Backup y Sincronización

### 10.1 Estadísticas de Backup

**Endpoint:**
```http
GET /backup/stats
```

**Response (200 OK):**
```json
{
  "photos": {
    "total": 45,
    "backed_up": 38
  },
  "audio": {
    "total": 12,
    "backed_up": 10
  },
  "documents": {
    "total": 25,
    "backed_up": 20
  },
  "backup_percentage": 84
}
```

### 10.2 Obtener Ítems Pendientes

**Endpoint:**
```http
GET /backup/pending
```

**Response (200 OK):**
```json
{
  "pending": [
    {
      "type": "photo",
      "id": 1,
      "name": "Foto clase 1",
      "local_uri": "file:///...",
      "created_at": "2026-05-22T10:00:00Z"
    }
  ]
}
```

### 10.3 Marcar como Respaldado

**Endpoint:**
```http
POST /backup/mark
```

**Body:**
```json
{
  "type": "photo",
  "id": 1,
  "cloud_url": "https://uploadthing.com/f/xyz123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Ítem marcado como respaldado"
}
```

---

## 11. Códigos de Estado

| Código | Significado | Ejemplo |
|--------|------------|---------|
| **200** | OK | Lectura exitosa |
| **201** | Created | Recurso creado |
| **204** | No Content | Eliminación exitosa |
| **400** | Bad Request | Parámetros inválidos |
| **401** | Unauthorized | Token faltante/inválido |
| **403** | Forbidden | No tienes permisos |
| **404** | Not Found | Recurso no existe |
| **409** | Conflict | Email ya registrado |
| **413** | Payload Too Large | Archivo muy grande |
| **429** | Too Many Requests | Rate limit excedido |
| **500** | Server Error | Error interno |

---

## Conclusión

Esta API proporciona acceso completo a todos los sistemas de Threshold:
✅ **100+ endpoints** documentados
✅ **Autenticación JWT** segura
✅ **Rate limiting** para protección DDoS
✅ **Manejo de errores** consistente
✅ **Integración IA** (Groq + Gemini)
✅ **Spaced Repetition** (SM-2 + FSRS)
✅ **Learning Analytics** completas

Para más detalles sobre cálculos académicos ver [LEARNING_ENGINEERING_DOCUMENTATION.md](LEARNING_ENGINEERING_DOCUMENTATION.md).
Para detalles de la BD ver [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md).

---
*Todos los endpoints (salvo el grupo de Auth) están protegidos mediante el middleware JWT y validador de `userId` cruzado con el token.*

---
**Tags:** #architecture

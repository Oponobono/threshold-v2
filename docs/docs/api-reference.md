# Referencia de la API REST

:::info Documentación interactiva

Esta página es un resumen general. La documentación **completa e interactiva** de la API está en Swagger UI:

- **Local**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Producción**: [https://threshold.onrender.com/api-docs](https://threshold.onrender.com/api-docs)

*Swagger UI permite probar los endpoints directamente desde el navegador con autenticación JWT.*
:::

## Autenticación

Todas las rutas excepto `/register` y `/login` requieren:

```
Authorization: Bearer <JWT_TOKEN>
```

### Rate Limiting

| Endpoint | Límite | Ventana |
|---|---|---|
| `/register`, `/login` | 5 intentos | 15 min |
| `/ai/*` | 10 requests | 1 min |
| Otros | 100 requests | 15 min |

## Estructura de Rutas

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/register` | Registrar usuario |
| POST | `/api/login` | Iniciar sesión |
| POST | `/api/biometric-login` | Login biométrico |

### Users
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/users/:userId` | Obtener perfil |
| PUT | `/api/users/:userId` | Actualizar perfil |
| PUT | `/api/users/:userId/password` | Cambiar contraseña |
| DELETE | `/api/users/:userId` | Solicitar eliminación |

### Subjects
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/subjects/:userId` | Listar materias |
| POST | `/api/subjects` | Crear materia |
| PUT | `/api/subjects/:id` | Actualizar materia |
| DELETE | `/api/subjects/:id` | Eliminar materia (cascade) |

### Assessments
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/assessments/subject/:subjectId` | Listar evaluaciones |
| POST | `/api/assessments` | Crear evaluación |
| PUT | `/api/assessments/:id` | Actualizar calificación |
| GET | `/api/assessments/analytics/subject/:id/projection` | Proyección de notas |

### Flashcards
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/flashcard-decks` | Listar mazos |
| GET | `/api/flashcard-decks/with-metrics` | Mazos priorizados |
| POST | `/api/flashcard-decks` | Crear mazo |
| POST | `/api/flashcard-decks/generate-from-text` | Generar desde texto (IA) |
| POST | `/api/flashcard-decks/generate-from-image` | Generar desde imagen (IA) |
| GET | `/api/flashcard-decks/:deckId/cards/prioritized` | Tarjetas priorizadas (FSRS) |
| POST | `/api/flashcards/:cardId/review` | Registrar revisión |

### Multimedia
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/scanned_documents` | Subir documento (OCR) |
| POST | `/api/ocr` | OCR desde imagen base64 |
| GET | `/api/audio/:audioId/transcript` | Obtener transcripción |

### AI / Zyren
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/ai/chat` | Chat con Zyren |
| POST | `/api/ai/generate-flashcards-from-document` | Generar flashcards desde documento |
| POST | `/api/ai/process-document-upload` | Procesar documento completo |
| GET | `/api/ai/model-info` | Información de modelos |

### Analytics
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/analytics/predictions/:userId` | Predicciones de repaso |
| GET | `/api/analytics/mastery/:userId/:subjectId` | Dominio por materia |
| GET | `/api/analytics/global/gpa/:userId` | GPA global |
| POST | `/api/learning/sessions` | Registrar sesión de estudio |

### Sync
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/sync/initial` | Initial sync (10 categorías) |
| GET | `/api/sync/delta?version=N` | Delta sync (15 tablas + deletions) |

### Backup
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/backup/stats` | Estadísticas de backup |
| GET | `/api/backup/pending` | Ítems pendientes |
| POST | `/api/backup/mark` | Marcar como respaldado |

### Schedules, Calendar, Settings
| Método | Ruta | Descripción |
|---|---|---|
| CRUD | `/api/schedules` | Horarios de clase |
| CRUD | `/api/calendar/events` | Eventos de calendario |
| CRUD | `/api/grading-periods` | Períodos académicos |

### Gallery, Audio, YouTube
| Método | Ruta | Descripción |
|---|---|---|
| CRUD | `/api/gallery` | Fotos (gallery) |
| CRUD | `/api/audio` | Grabaciones de audio |
| CRUD | `/api/youtube-videos` | Videos de YouTube |

## Códigos de Estado

| Código | Significado |
|---|---|
| **200** | OK |
| **201** | Created |
| **204** | No Content |
| **400** | Bad Request |
| **401** | Unauthorized |
| **404** | Not Found |
| **409** | Conflict (stale sync_version) |
| **429** | Too Many Requests |
| **500** | Server Error |

## Códigos de Error del Sync Protocol

| Código | Significado | Acción del Cliente |
|---|---|---|
| **409** | Stale client (sync_version behind) | Reintentar, re-sync opcional |
| **400** | Malformed request | Descartar permanentemente |
| **404** | Entity not found | Descartar permanentemente |
| **429** | Rate limited | Retry con backoff |
| **500** | Server error | Retry hasta 5 veces |

# 📄 Guía: Procesamiento de Documentos con Gemini Files API

## ✨ Características

- ✅ **PDF completo** - Sin truncado de contexto, procesa todos los capítulos
- ✅ **Documentos Word** - .docx y .doc completamente soportados
- ✅ **Auto-detección** - MIME type detectado automáticamente por extensión
- ✅ **Sin OCR necesario** - Procesa texto extraído directamente
- ✅ **Flashcards automáticas** - Genera sets de estudio desde cualquier documento
- ✅ **Retención 48 horas** - Google elimina archivos automáticamente

---

## 📋 Formatos Soportados

```
✅ .pdf              (PDF)
✅ .docx             (Word 2007+)
✅ .doc              (Word Legado)
✅ .txt              (Texto plano)
✅ .html / .htm      (HTML)
✅ .md               (Markdown)
```

**Máximo por archivo**: 100 MB

---

## 🔧 Endpoints

### 1️⃣ Procesar Documento Completo

**Endpoint**: `POST /api/ai/process-document`

Procesa un documento completo y retorna análisis, resumen, respuestas a preguntas, etc.

**Ejemplo - Procesar PDF:**
```bash
curl -X POST http://localhost:3000/api/ai/process-document \
  -H "Content-Type: application/json" \
  -d '{
    "documentPath": "/uploads/libro-fisica.pdf",
    "prompt": "Resume los 5 conceptos más importantes de este libro"
  }'
```

**Ejemplo - Procesar Word:**
```bash
curl -X POST http://localhost:3000/api/ai/process-document \
  -H "Content-Type: application/json" \
  -d '{
    "documentPath": "/uploads/tesis-investigacion.docx",
    "prompt": "Extrae las conclusiones y recomendaciones principales"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "provider": "gemini",
  "model": "gemini-3-flash",
  "result": "Resumen detallado del documento...",
  "features": [
    "Sin truncado de contexto",
    "Procesa documentos completos",
    "Soporta: PDF, Word, TXT, HTML, Markdown"
  ]
}
```

---

### 2️⃣ Generar Flashcards desde Documento

**Endpoint**: `POST /api/ai/generate-flashcards-from-document`

Crea automáticamente un set de flashcards para estudio activo.

**Ejemplo - Flashcards desde PDF:**
```bash
curl -X POST http://localhost:3000/api/ai/generate-flashcards-from-document \
  -H "Content-Type: application/json" \
  -d '{
    "documentPath": "/uploads/capitulo-biologia.pdf",
    "count": 15
  }'
```

**Ejemplo - Flashcards desde Word (con count específico):**
```bash
curl -X POST http://localhost:3000/api/ai/generate-flashcards-from-document \
  -H "Content-Type: application/json" \
  -d '{
    "documentPath": "/uploads/notas-historia.docx",
    "count": 20
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "provider": "gemini",
  "model": "gemini-3-flash",
  "flashcards": [
    {
      "question": "¿Cuál es la teoría de la evolución?",
      "answer": "Teoría propuesta por Charles Darwin que explica..."
    },
    {
      "question": "¿Qué es la selección natural?",
      "answer": "Mecanismo mediante el cual los organismos..."
    }
  ],
  "count": 20,
  "note": "Flashcards generadas automáticamente desde documento completo"
}
```

---

### 3️⃣ Obtener Información de Modelos

**Endpoint**: `GET /api/ai/model-info`

Información sobre los modelos disponibles y sus límites.

```bash
curl http://localhost:3000/api/ai/model-info
```

**Respuesta:**
```json
{
  "providers": [
    {
      "provider": "groq",
      "model": "llama-3.1-8b-instant",
      "contextLimit": "12 KB",
      "speed": "Ultra rápido (~50ms)"
    },
    {
      "provider": "gemini",
      "model": "gemini-3-flash",
      "contextLimit": "1,000,000 tokens (~50KB+)",
      "speed": "Rápido (~200-500ms)",
      "filesAPI": "Soportado - Ideal para archivos >1MB"
    }
  ]
}
```

---

## 💡 Casos de Uso

### Caso 1: Extraer Información de PDF

```javascript
const response = await fetch('http://localhost:3000/api/ai/process-document', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentPath: '/uploads/paper-cientifico.pdf',
    prompt: `Extrae en formato JSON:
      - Objetivo del estudio
      - Metodología
      - Hallazgos principales
      - Conclusiones`
  })
});
```

### Caso 2: Convertir Libro a Flashcards

```javascript
// Cargar PDF del libro
const response = await fetch('http://localhost:3000/api/ai/generate-flashcards-from-document', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentPath: '/uploads/libro-completo.pdf',
    count: 50  // 50 flashcards para todo el libro
  })
});

const data = await response.json();
console.log(`Generadas ${data.count} flashcards`);
// Guardar en base de datos para el alumno...
```

### Caso 3: Procesar Notas de Clase en Word

```javascript
const response = await fetch('http://localhost:3000/api/ai/process-document', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentPath: '/uploads/notas-clase-2024.docx',
    prompt: 'Organiza estos apuntes en estructura lógica: Conceptos clave > Explicación > Ejemplos > Casos de uso'
  })
});
```

---

## ⚙️ Parámetros Detallados

### `processDocumentWithGemini`

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|------------|
| `documentPath` | string | ✅ | Ruta local del archivo (ej: `/uploads/doc.pdf`) |
| `prompt` | string | ✅ | Instrucción para procesar (ej: "Resume en 100 palabras") |
| `mimeType` | string | ❌ | MIME type (auto-detectado si se omite) |

### `generateFlashcardsFromDocument`

| Parámetro | Tipo | Requerido | Rango | Descripción |
|-----------|------|-----------|-------|------------|
| `documentPath` | string | ✅ | - | Ruta local del archivo |
| `count` | integer | ❌ | 1-100 | Número de flashcards (default: 10) |
| `mimeType` | string | ❌ | - | MIME type (auto-detectado) |

---

## 🚀 Rendimiento Esperado

| Tipo de Tarea | Tamaño | Tiempo |
|---------------|--------|--------|
| Procesar PDF pequeño | 1-5 MB | 2-3 seg |
| Procesar PDF mediano | 5-50 MB | 5-10 seg |
| Procesar Word | <20 MB | 2-5 seg |
| Generar 10 flashcards | Cualquiera | 3-5 seg |
| Generar 50 flashcards | Cualquiera | 5-8 seg |

---

## ⚡ Diferencias: Groq vs Gemini

| Característica | Groq ⚡ | Gemini 🧠 |
|----------------|--------|----------|
| **Velocidad** | 50ms | 200-500ms |
| **Contexto** | 12 KB | 1M tokens (~50KB+) |
| **PDF completo** | ❌ Truncado | ✅ Completo |
| **Flashcards** | ❌ Limitado | ✅ Óptimo |
| **Documentos grandes** | ❌ No | ✅ Sí |
| **Caso ideal** | Chat en tiempo real | Análisis profundo |

---

## 🔐 Seguridad

- ✅ API keys manejadas en backend (nunca expuestas)
- ✅ Validación de extensión y tamaño
- ✅ Google elimina archivos después de 48 horas
- ✅ Usar HTTPS en producción

---

## 📚 Ejemplos de Prompts Efectivos

```
// Resumen ejecutivo
"Dame un resumen ejecutivo de máximo 300 palabras"

// Extracción estructurada
"Extrae en formato JSON: {titulo, autor, fecha, conceptos_clave[], conclusion}"

// Preguntas frecuentes
"Crea 5 preguntas frecuentes con respuestas basadas en este documento"

// Análisis comparativo
"Compara los puntos de vista presentados en este documento"

// Adaptación para nivel educativo
"Explica este contenido como si fuera para un estudiante de secundaria"
```

---

## 🆘 Solución de Problemas

**Error: "Archivo no encontrado"**
- Verifica que la ruta es correcta (relativa o absoluta)
- Asegúrate que el archivo existe en el servidor

**Error: "Formato no soportado"**
- Usa solo: .pdf, .docx, .doc, .txt, .html, .md
- Verifica la extensión del archivo

**Error: "Archivo demasiado grande"**
- Máximo 100 MB por archivo
- Divide archivos grandes en partes

**Respuesta vacía o incompleta**
- El prompt puede ser muy ambiguo
- Intenta con prompts más específicos
- Verifica que el documento tiene contenido procesable

---

## 📝 Notas Importantes

1. **Sin OCR**: El sistema procesa texto extraído, no escanea imágenes
2. **Retención**: Google elimina archivos automáticamente después de 48 horas
3. **Escalabilidad**: Sistema diseñado para miles de documentos diarios
4. **Precisión**: Mejor con documentos bien formateados (no escaneos)
5. **Costo**: Gemini Files API es extremadamente eficiente ($0.075 por 1M tokens)

---

## 🎯 Próximas Características (Roadmap)

- [ ] Upload de archivos desde frontend
- [ ] Procesamiento en batch (múltiples documentos)
- [ ] Caché de documentos procesados
- [ ] Export flashcards a Anki/Quizlet
- [ ] Análisis de sentimiento
- [ ] Extracción automática de tablas


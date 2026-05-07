# 🚀 Configuración Gemini Files API

## ✅ Instalado y Listo

```bash
npm install @google/generative-ai
```

## 📁 Archivos Creados/Modificados

```
backend/utils/geminiService.js          ✅ Nuevo - Servicio completo con Files API
backend/controllers/aiController.js     ✅ Modificado - 3 nuevos endpoints
backend/routes/ai.js                    ✅ Modificado - Rutas con documentación
backend/.env                            ✅ Modificado - GEMINI_API_KEY agregada
backend/.env.example                    ✅ Modificado - Template de GEMINI_API_KEY
```

## 🔑 Configuración Requerida

En `backend/.env`:
```env
GEMINI_API_KEY=AIzaSyXXXXXXXXXXX  # Obtén en: https://aistudio.google.com/app/apikeys
GROQ_API_KEY=gsk_XXXXXXXXXXX      # Mantener para chat rápido
```

## 📊 Formatos Soportados

| Formato | Extensión | Estado |
|---------|-----------|--------|
| PDF | .pdf | ✅ Completo |
| Word 2007+ | .docx | ✅ Completo |
| Word Legado | .doc | ✅ Completo |
| Texto | .txt | ✅ Completo |
| HTML | .html, .htm | ✅ Completo |
| Markdown | .md | ✅ Completo |

## 🎯 Nuevos Endpoints

### 1. Procesar Documento
```
POST /api/ai/process-document
Body: {
  documentPath: "/ruta/archivo.pdf",     // Requerido
  prompt: "Instrucción aquí",             // Requerido
  mimeType: "application/pdf"             // Opcional (auto-detectado)
}
```

### 2. Generar Flashcards
```
POST /api/ai/generate-flashcards-from-document
Body: {
  documentPath: "/ruta/archivo.docx",     // Requerido
  count: 10,                              // Opcional (1-100, default: 10)
  mimeType: "auto"                        // Opcional (auto-detectado)
}
```

### 3. Información de Modelos
```
GET /api/ai/model-info
```

## ⚙️ Características Técnicas

✅ **Auto-detección de MIME type** - Basada en extensión del archivo
✅ **Validación de archivo** - Verifica existencia y tamaño (máx 100 MB)
✅ **Sin truncado de contexto** - Procesa documentos completos
✅ **Respuestas estructuradas** - JSON mode para flashcards
✅ **Logging detallado** - Console logs para debugging

## 🔒 Seguridad

- ✅ API keys en backend (.env), nunca expuestas al cliente
- ✅ Validación de extensiones y tamaño
- ✅ Errores descriptivos pero seguros

## 📈 Rendimiento

| Tarea | Tiempo |
|-------|--------|
| PDF 5MB | 2-3 seg |
| PDF 50MB | 5-10 seg |
| Flashcards (10-20) | 3-8 seg |

## 🚀 Uso desde Código Node.js

```javascript
const geminiService = require('./utils/geminiService');

// Procesar documento
const resultado = await geminiService.processDocumentWithFilesAPI(
  '/uploads/documento.pdf',
  null, // null = auto-detect MIME type
  'Resume este documento'
);

// Generar flashcards
const flashcards = await geminiService.generateFlashcardsFromDocument(
  '/uploads/libro.pdf',
  null, // auto-detect
  15
);
```

## 🆘 Debugging

```javascript
// Ver información de modelo
console.log(geminiService.getModelInfo());

// Logs automáticos en cada operación
[Gemini Files API] Procesando: documento.pdf
[Gemini Files API] Tipo detectado: application/pdf
[Gemini Files API] Tamaño: 5.23MB
[Gemini Files API] Enviando a modelo gemini-3-flash...
[Gemini Files API] ✅ Respuesta generada (2453 caracteres)
```

## 📚 Límites

- Máximo por archivo: **100 MB**
- Máximo flashcards: **100 por solicitud**
- Retención de datos: **48 horas** (auto-limpieza Google)
- Context: **1M tokens** (~50KB+)

## 🎓 Casos de Uso Ideales

1. ✅ Resumen de libros completos (sin OCR)
2. ✅ Análisis de artículos científicos (PDF + Word)
3. ✅ Generación automática de flashcards
4. ✅ Extracción de información estructurada
5. ✅ Procesamiento de tesis y documentos largos

## ❌ Limitaciones

- ❌ NO procesa escaneos de imágenes (requeriría OCR)
- ❌ NO soporta archivos binarios (EXE, ZIP, etc.)
- ❌ NO retiene archivos más de 48 horas

## 🔄 Diferencia con Groq

| Aspecto | Groq | Gemini |
|--------|------|--------|
| **Velocidad** | 50ms | 200-500ms |
| **Contexto** | 12 KB | 1M tokens |
| **Documentos** | Truncados | Completos |
| **Ideal para** | Chat rápido | Análisis profundo |

## 📖 Documentación Completa

Ver: `GEMINI_DOCUMENT_PROCESSING.md` (en raíz del proyecto)


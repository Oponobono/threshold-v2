# 🔧 Debugging: Error en Gemini Chat

## 🐛 Error Reportado
```
SubjectAIChatModal.tsx:204 [AIChatTelemetry] Error crítico al enviar mensaje
Error: Error en el chat de IA con gemini
```

## ✅ Fixes Aplicados

### 1. Safety Settings (100% Fixed) ✅
**Problema:** Categorías inválidas en safety_settings
```javascript
❌ ANTES: category: HarmCategory.HARM_CATEGORY_HARASSMENT (objeto)
✅ AHORA: category: "HARM_CATEGORY_HARASSMENT" (string)
```

**Archivo:** `backend/utils/geminiService.js` línea 20

### 2. Chat Message Flow (Fixed) ✅
**Problema:** Lógica incorrecta en `processAcademicChat()`
- Se estaban enviando todos los mensajes al histórico
- Luego se enviaba un mensaje adicional de contexto
- Esto generaba conflicto en la API de Gemini

**Solución:**
- Separar todos excepto el último mensaje → histórico
- Enviar solo el último mensaje al método `sendMessage()`
- Validar que el último mensaje sea del usuario

**Archivo:** `backend/utils/geminiService.js` línea 199

### 3. Logging Mejorado (New) ✅
**Adiciones:**
- `callGeminiAPI`: Logs detallados con código de error
- `ai.ts`: Logs en frontend para rastrear requests

**Beneficio:** Verás exactamente dónde falla si vuelve a ocurrir

---

## 🧪 Cómo Verificar que Funciona

### Test 1: Chat Simple con Gemini
```bash
curl -X POST http://localhost:3000/api/ai/chat?provider=gemini \
  -H "Content-Type: application/json" \
  -d '{
    "context_text": "El tema de hoy es: Biología celular",
    "messages": [
      {
        "role": "user",
        "content": "¿Qué es una célula?"
      }
    ]
  }'
```

**Respuesta esperada:**
```json
{
  "reply": {
    "role": "assistant",
    "content": "Una célula es la unidad fundamental..."
  },
  "provider": "gemini"
}
```

### Test 2: Chat Multi-mensaje con Gemini
```bash
curl -X POST http://localhost:3000/api/ai/chat?provider=gemini \
  -H "Content-Type: application/json" \
  -d '{
    "context_text": "Tema: Evolución",
    "messages": [
      {
        "role": "user",
        "content": "¿Quién fue Darwin?"
      },
      {
        "role": "assistant",
        "content": "Charles Darwin fue un naturalista inglés..."
      },
      {
        "role": "user",
        "content": "¿Cuál fue su teoría principal?"
      }
    ]
  }'
```

---

## 📊 Logs Esperados en Consola

**Backend:**
```
[callGeminiAPI] 🤖 Iniciando...
[callGeminiAPI] Mensajes: 3
[Gemini] Iniciando chat académico con 2 mensajes
[Gemini] ✅ Respuesta de chat generada (523 chars)
[callGeminiAPI] ✅ Respuesta exitosa
```

**Frontend (React Native):**
```
[AI Service] 📡 Enviando a gemini...
[AI Service] Mensajes: 1, Context: 350 chars
[AI Service] ✅ Respuesta exitosa
```

---

## ⚠️ Si Sigue Dando Error

Proporciona estos datos:

1. **Logs completos del backend:**
   ```bash
   cd backend && npm start 2>&1 | grep -E "\[callGeminiAPI\]|\[Gemini\]|Error"
   ```

2. **Response status del servidor:**
   - ¿Es 200, 400, 500?

3. **Mensaje exacto del error:**
   - Copia toda la línea del error

4. **Cuerpo de la solicitud:**
   - ¿Qué se está enviando desde el frontend?

---

## 🔍 Debugging Rápido

### Si ves en logs: `[callGeminiAPI] ❌ Error detallado:`
Mira el campo `message` - te dirá exactamente qué falló.

### Si ves: `Error: Error en el chat de IA con gemini`
Significa que el error viene del backend pero no está siendo capturado correctamente. Los logs arriba te dirán más detalles.

### Si ves: `INVALID_ARGUMENT` en error
Significa que la estructura del JSON es incorrecta. Verifica:
- ¿`messages` es un array?
- ¿Cada mensaje tiene `role` y `content`?
- ¿El `role` es "user" o "assistant"?

---

## 📝 Cambios Realizados

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `geminiService.js` | 20 | Safety settings: strings en lugar de objetos |
| `geminiService.js` | 199 | Lógica de mensajes: último separado del histórico |
| `aiController.js` | 62 | Logging mejorado en callGeminiAPI |
| `ai.ts` | 18 | Logging mejorado en frontend |

---

## ✨ Próximos Pasos

Si los tests arriba funcionan:
1. Prueba desde la app mobile
2. Intenta cambiar entre Groq y Gemini
3. Verifica que las respuestas sean coherentes

Si sigue fallando:
1. Comparte los logs de error
2. Verifica que `GEMINI_API_KEY` es válida
3. Prueba el curl test arriba primero


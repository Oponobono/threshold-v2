# 🔄 Guía: Switch Groq ↔ Gemini en Zyren

## ¿Qué cambió?

Ahora tienes **dos opciones** para alimentar a Zyren, tu asistente de IA:

| Proveedor | Velocidad | Capacidad | Mejor para |
|-----------|-----------|-----------|-----------|
| ⚡ **Groq** | ⭐⭐⭐⭐⭐ Ultra rápido | Limitado | Respuestas rápidas, contexto moderado |
| 🧠 **Gemini** | ⭐⭐⭐ Rápido | ⭐⭐⭐⭐⭐ Muy alta | Documentos largos, análisis profundo |

## Cómo Usar

### 1. En el Chat con Zyren
Abre el modal de chat de cualquier materia y verás **dos botones** en la esquina superior:

```
┌─────────────────────────────────┐
│ Zyren | Biología  [⚡][🧠] [...] │
├─────────────────────────────────┤
│                                 │
│  ¿Qué quieres saber?           │
│                                 │
```

- **⚡** = Groq (velocidad)
- **🧠** = Gemini (capacidad)

Toca el que quieras usar. **El cambio es inmediato** para ese chat.

### 2. Preferencia Persistente
Tu última elección se guarda automáticamente. La próxima vez que abras un chat:
- Se usará el proveedor que elegiste la última vez
- Puedes cambiar en cualquier momento

## Configuración del Backend

Si eres administrador, agrega las API keys en `.env`:

```bash
# Archivo: .env (backend)

# Groq - Velocidad máxima
GROQ_API_KEY=gsk_XXXXXXXXXXX

# Google Gemini - Máxima capacidad
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXX
```

**Obtener keys:**
- 🔗 Groq: https://console.groq.com/keys
- 🔗 Gemini: https://aistudio.google.com/app/apikeys

## Casos de Uso

### Usa ⚡ Groq cuando:
- ✅ Necesitas respuestas al instante
- ✅ Tu contexto es pequeño (<10 páginas)
- ✅ Prefieres economía
- ✅ Conexión lenta

### Usa 🧠 Gemini cuando:
- ✅ Tienes documentos muy largos (>50 páginas)
- ✅ Necesitas análisis profundo
- ✅ La velocidad no es crítica
- ✅ Quieres máxima precisión

## Limitaciones Actuales

**Groq:**
- Max 6,000 tokens por minuto (TPM)
- Context: 12 KB aprox (≈3-4 hojas A4)
- Modelo: llama-3.1-8b-instant

**Gemini:**
- Context: 50 KB aprox (≈15 hojas A4)
- Rate limit: Según tu plan de Google
- Modelo: gemini-1.5-flash

## FAQ

### ❓ ¿Cambia el historial si cambio de proveedor?
No. El historial del chat es independiente del proveedor. Puedes cambiar de Groq a Gemini sin perder conversación.

### ❓ ¿Qué pasa si no tengo API key configurada?
Si no está configurado, verás error indicando cuál falta. El backend lo bloqueará.

### ❓ ¿Puedo usar ambos simultáneamente?
Sí, pero en **chats diferentes**:
- Chat de Biología: Groq ⚡
- Chat de Historia: Gemini 🧠

En el **mismo chat**, solo una está activa a la vez.

### ❓ ¿Cuál es más barato?
Groq tiene plan gratuito generoso. Gemini depende de tu plan Google Cloud. Evalúa según uso.

## Troubleshooting

### El botón Gemini no funciona
→ Verifica que `GEMINI_API_KEY` esté en `.env` del backend
→ Reinicia el servidor backend

### Groq es más lento de lo esperado
→ Puede estar saturado. Intenta Gemini
→ Verifica el historial (mensajes muy antiguos ralentizan)

### Vuelve a Groq automáticamente
→ Error de API de Gemini. Mira los logs del backend:
```bash
# En backend/
cat gemini_debug.log
```

## Desarrollo Futuro

Planeado:
- 🔜 Comparar respuestas lado a lado
- 🔜 Estadísticas de uso (cuál usas más)
- 🔜 Auto-selección basada en tamaño de contexto
- 🔜 Otros modelos (Claude, OpenAI, etc.)

---

**¿Preguntas?** Revisa los logs en:
- Frontend: Chrome DevTools Console
- Backend: `backend/groq_debug.log` o `backend/gemini_debug.log`

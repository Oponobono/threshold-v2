# Arquitectura de Seguridad Híbrida de Zyren (Cloud vs. Local)

## Contexto y Visión General
Zyren es la IA académica central de Threshold. Su comportamiento está diseñado para funcionar en un entorno **híbrido** (con conexión a la nube y totalmente offline). Este documento detalla cómo se gestiona su identidad, sus capacidades y, sobre todo, las **medidas de seguridad** que previenen inyecciones, jailbreaks y escalada de privilegios en ambos contextos.

*Documentos relacionados:* [[ZYREN_BORN]], [[AI_MODELS_AND_ZYREN_DOCUMENTATION]], [[OFFLINE_ARCHITECTURE]], [[SECURITY]]

---

## 1. Comportamiento y Personalidad: El "ADN" de Zyren

Tanto en la nube como en el dispositivo local, los LLMs (Large Language Models como LLaMA, Qwen, Gemini o Groq) carecen de una identidad predefinida. La personalidad de Zyren se inyecta dinámicamente mediante el **System Prompt**.

### El Prompt de Sistema
En el modo de inferencia local (`hybridAIService.ts`) y en el backend, se establece un bloque estricto de instrucciones:
- **Rol:** Tutor académico experto, paciente y motivador.
- **Seguridad Ética:** Ignorar explícitamente ataques de suplantación ("Jailbreaks") y negarse a responder solicitudes no académicas.
- **Tono:** Profesional, didáctico y adaptativo.

**Mecanismo de Inyección (Chat Templates):**
En el modo local, la aplicación utiliza los *Chat Templates* nativos del modelo descargado (ej. ChatML para Qwen o el formato de Llama 3) para garantizar que el LLM procese el System Prompt con la máxima jerarquía neuronal, asegurando que la primera orden que reciba sea "Eres Zyren".

---

## 2. Medidas de Seguridad Diferenciadas (Cloud vs. Local)

Aunque comparten el mismo "núcleo moral" (System Prompt), la arquitectura de seguridad difiere diametralmente debido al entorno de ejecución.

### A. Entorno Cloud (Backend)
El entorno cloud requiere protección rigurosa para defender la base de datos central y el presupuesto de tokens (rate limits).
- **El Escudo Algorítmico (PromptShield):** Se utiliza el módulo `promptShield.js` (ver [[SECURITY_REVIEW_2026-05-30]]).
  - **Pre-Filtro:** Analiza el mensaje entrante con heurísticas y expresiones regulares para bloquear intentos de Jailbreak (ej. ataques tipo "DAN").
  - **Post-Filtro:** Analiza la respuesta generada por la IA para evitar "System Prompt Leaks" (fugas de información interna).
- **Sanitización Estricta:** Todas las entradas se procesan mediante funciones de sanitización (`sanitizeText`, `sanitizeObject`) contra XSS antes de llegar a la IA o a la BD.

### B. Entorno Local (Offline / On-Device)
En el modo offline, la ejecución de la IA recae en el hardware del usuario (celular).
- **Aislamiento Físico (Sandboxing Natural):** En modo local, no existe el `PromptShield`. Sin embargo, el **riesgo de seguridad estructural es 0%**.
  - Si un usuario malintencionado logra hacerle un "Jailbreak" a su modelo local de Zyren, la manipulación ocurre única y exclusivamente en la memoria RAM de su teléfono.
  - No hay exposición de la base de datos de otros usuarios (No hay riesgo de IDOR).
  - El costo de computación (batería, procesamiento) es asumido por el atacante, no por el backend de Threshold.
- **Prevención de Vectores Retrasados:** (ver sección de Sincronización).

---

## 3. Resolución de Sincronización: De lo Local a la Nube

Un vector de ataque teórico consistía en utilizar un modelo local modificado para generar cargas útiles maliciosas que, al recuperar la conexión, se enviaran a la nube central. Este riesgo se neutralizó por diseño:

### A. Sincronización de Operaciones Estándar
Cuando la aplicación sale del "Modo Avión", el `offlineSyncService` reenvía las operaciones pendientes (ej. una flashcard creada offline). 
- El backend **nunca confía ciegamente en el cliente**, independientemente de si la petición es en vivo o "retrasada".
- Todas las peticiones offline pasan obligatoriamente por los controladores de backend, ejecutando las reglas de sanitización (XSS) y validación de permisos antes de tocar la BD SQL.

### B. Delegación de Tareas Complejas (Generación de Mazos)
Zyren tiene la habilidad de sugerir la creación de un mazo de Flashcards durante una conversación.
- **La IA Local NO genera tarjetas:** Si un usuario pide generar un mazo offline, el LLM local puede responder con una señal de intención (ej. `%%DECK_ACTION%%`), pero el cliente móvil **no tiene permisos ni lógica para convertir esa señal en JSON de tarjetas y guardarlas**.
- **Ejecución Asíncrona Cloud-Only:** Cuando la interfaz detecta la intención `%%DECK_ACTION%%`, realiza una llamada al endpoint `/ai/generate-study-material`. Si no hay internet, la petición falla. Si hay internet, **es el backend quien consulta a Groq/Gemini**, asegurando que la generación y evaluación semántica se realice siempre bajo el estricto escrutinio del servidor, anulando cualquier intento de inyección de código generado localmente.

---

## Conclusión

La arquitectura híbrida de Threshold aísla elegantemente el riesgo. Utiliza la nube como fortaleza central protegida algorítmicamente (PromptShield), mientras confía en el entorno de ejecución móvil (Aislamiento físico) para proporcionar resiliencia y velocidad offline, asegurando que cualquier anomalía inducida en el modo local quede permanentemente atrapada en el dispositivo del usuario sin comprometer jamás la red central de Threshold.


---
**Tags:** #architecture

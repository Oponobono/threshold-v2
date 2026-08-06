# Threshold Directive Protocol (TDP)

## Visión General
El **Threshold Directive Protocol** es el protocolo de interacción estándar entre cualquier modelo de Inteligencia Artificial (LLM) y la plataforma Threshold. Su propósito es garantizar la filosofía **Local-First / Offline-First** al desacoplar por completo la inferencia de la ejecución de efectos secundarios.

Bajo este protocolo, ningún modelo (ni su controlador) modifica el estado del sistema directamente. En su lugar, el LLM emite **Directivas** incrustadas en texto, las cuales son interpretadas, validadas y ejecutadas por la Plataforma Consumidora (ej. cliente móvil).

## Invariantes (Reglas 11, 12 y 13 del AI Domain)
1. **Sin efectos secundarios:** Los modelos de IA nunca ejecutan mutaciones ni acciones. Solo emiten directivas estructuradas.
2. **Ejecución delegada:** La responsabilidad de ejecutar la acción recae de manera exclusiva en los Coordinators (ej. `AIInteractionCoordinator`) y las Capabilities del dominio consumidor.
3. **Estabilidad y versionado:** La incorporación de nuevas capacidades se realiza mediante nuevas directivas o versiones, nunca alterando el comportamiento de las existentes. El protocolo es estrictamente retrocompatible.

---

## Especificación del Protocolo

### 1. Formato de Emisión
El LLM debe incluir un bloque delimitado por `%%DIRECTIVE%%` y `%%END%%` en cualquier parte de su respuesta (idealmente al final).
Dentro de ese bloque, debe haber un único objeto JSON válido.

**Ejemplo de emisión:**
```json
Claro, aquí tienes tu material de estudio.

%%DIRECTIVE%%
{
  "version": 1,
  "type": "create_deck",
  "mode": "mixed",
  "count": 10
}
%%END%%
```

### 2. Estructura de la Directiva (`AIDirective`)
Toda directiva extraída debe cumplir con un contrato base, independientemente de su tipo:

- `version` (Number): La versión del contrato de la directiva, permitiendo evolucionar su semántica (ej. de `1` a `2`).
- `type` (String): El identificador único del comando que se desea ejecutar (ej. `create_deck`, `schedule_review`, `create_anchor`).

*Nota: Los intérpretes de bajo nivel (ej. `ResponseInterpreter`) no validan esta estructura, simplemente parsean el JSON. La validación estructural le pertenece al `DirectiveHandler` responsable de la directiva.*

### 3. Pipeline de Interacción

1. **Inferencia (Provider):** El sistema (`CloudProvider` o `LocalProvider`) solicita una completitud al LLM.
2. **Interpretación (ResponseInterpreter):** Inmediatamente después de recibir la respuesta, el parser extrae todos los bloques `%%DIRECTIVE%%...%%END%%`.
   - Si el JSON está malformado, se registra un warning y la directiva se ignora (no se bloquea la respuesta de texto).
   - El texto que queda tras remover los bloques es el `cleanContent` que consume la UI.
3. **Orquestación (AIInteractionCoordinator):** El coordinador del lado de la aplicación recibe la matriz de directivas extraídas y delega su procesamiento al `DirectiveHandlerRegistry`.
4. **Ejecución (DirectiveHandler):** El `Registry` localiza el `DirectiveHandler` adecuado (basado en `type` y `version`). Este handler valida el payload, invoca la Capability de dominio apropiada (ej. `FlashcardCapability`) y orquesta cualquier persistencia o efecto secundario usando repositorios.

### 4. Transportabilidad
Las directivas son estructuras de datos puras (POJOs) sin acoplamiento a librerías, IDs internos efímeros de base de datos o lógica de interfaz (como stores de Zustand). Esto permite que una directiva viaje a través de una API HTTP, WebSocket o se guarde en disco para su ejecución en diferido, manteniendo idéntico significado en clientes Web, iOS, Android y CLI.

---

## Cuándo usar el TDP (y cuándo no)

### Regla de decisión

> **¿Quién tomó la decisión de qué operación ejecutar?**
> - Si la tomó el **usuario** (un botón, un formulario, una importación) → invocar la **Capability directamente**.
> - Si la tomó el **modelo** (respuesta abierta de lenguaje natural que puede contener directivas) → usar el **TDP**.

El TDP no reemplaza al Capability Pattern. Lo *precede* cuando existe una interacción conversacional o abierta con un LLM.

### Camino A — Determinístico (sin TDP)

```
UI / Usuario
    ↓
Capability
    ↓
Engine / Pipeline
    ↓
Repository
```

Aplica cuando: importar CSV, botón "Generar flashcards", pipeline OCR imagen → texto → flashcards, FlashcardImportModal.

### Camino B — Conversacional (con TDP)

```
UI / Usuario
    ↓
LLM (CloudProvider / LocalProvider)
    ↓
ResponseInterpreter → AIResponse { content, directives }
    ↓
AIInteractionCoordinator
    ↓
DirectiveHandlerRegistry
    ↓
Handler → Capability → Repository
```

Aplica cuando: chat con Zyren, tutor, planner, OCR *asistido* (el LLM interpreta el resultado), cualquier flujo donde el modelo propone la operación.

### Anti-patrón a evitar

Introducir el TDP en flujos determinísticos añade complejidad sin desacoplamiento real. El protocolo es valioso precisamente porque está enfocado. Usarlo para todo lo relacionado con IA lo convierte en una capa obligatoria sin propósito claro.

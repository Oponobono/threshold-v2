# Estructura JSON para Importación de [[FLASHCARDS_COMPLETE_DOCUMENTATION|Mazos]] de Flashcards

## Estructura General

```json
{
  "title": "Nombre del Mazo",
  "description": "Descripción opcional del mazo",
  "cards": [
    // Array de tarjetas...
  ]
}
```

## Tipos de Tarjetas Soportados

### 1. **Flashcard** (Frente/Reverso Clásico)

```json
{
  "item_type": "flashcard",
  "content_json": {
    "front": "Pregunta o concepto",
    "back": "Respuesta o explicación"
  },
  "hint": "Pista opcional para el estudiante",
  "explanation": "Explicación detallada de por qué es correcta"
}
```

**Campos requeridos:**
- `item_type`: `"flashcard"`
- `content_json.front`: string
- `content_json.back`: string
- `hint`: string (opcional)
- `explanation`: string (opcional)

---

### 2. **Multiple Choice** (Opción Múltiple / ECAES)

```json
{
  "item_type": "multiple_choice",
  "content_json": {
    "question": "¿Cuál es la respuesta correcta?",
    "options": [
      "Opción A",
      "Opción B",
      "Opción C",
      "Opción D"
    ],
    "correctIndex": 2
  },
  "hint": "Pista opcional",
  "explanation": "Por qué la opción 2 (índice 2) es correcta"
}
```

**Campos requeridos:**
- `item_type`: `"multiple_choice"`
- `content_json.question`: string
- `content_json.options`: array de strings (mínimo 2)
- `content_json.correctIndex`: number (índice de 0 a N)
- `hint`: string (opcional)
- `explanation`: string (opcional)

**Notas:**
- `correctIndex` es 0-based (el primer elemento tiene índice 0)
- Se soportan 2 o más opciones

---

### 3. **Verdadero/Falso** (Boolean)

```json
{
  "item_type": "boolean",
  "content_json": {
    "question": "Afirmación verdadera o falsa",
    "correctAnswer": true
  },
  "hint": "Pista opcional",
  "explanation": "Explicación de por qué es verdadero o falso"
}
```

**Campos requeridos:**
- `item_type`: `"boolean"`
- `content_json.question`: string
- `content_json.correctAnswer`: boolean (true o false)
- `hint`: string (opcional)
- `explanation`: string (opcional)

---

## 📝 Incluir Código en Preguntas y Respuestas

### ⚠️ **IMPORTANTE: Las fences (```) son OBLIGATORIAS para bloques de código**

Cuando incluyas código en cualquier campo (`front`, `back`, `question`, `options`, etc.), **DEBES** envolverlo en bloques de código markdown con triple backtick (```). Sin las fences, el código será tratado como texto plano sin resaltado de sintaxis.

### Sintaxis de Bloques de Código

```
```LENGUAJE
código aquí
```
```

**Estructura:**
- **Apertura**: Triple backtick seguido del nombre del lenguaje: ` ```bash `
- **Contenido**: Código en el medio
- **Cierre**: Triple backtick: ` ``` `

### Especificar el Lenguaje (Altamente Recomendado)

El lenguaje se especifica inmediatamente después de la apertura de los tres backticks:

| Lenguaje | Sintaxis | Ejemplo |
|----------|----------|---------|
| **Bash/Shell/Git** | ` ```bash ` | `git push origin main` |
| **Python** | ` ```python ` | `print("Hola")` |
| **JavaScript** | ` ```javascript ` o ` ```js ` | `console.log("Hola")` |
| **SQL** | ` ```sql ` | `SELECT * FROM users;` |
| **JSON** | ` ```json ` | `{"key": "value"}` |
| **HTML** | ` ```html ` | `<div>Contenido</div>` |
| **CSS** | ` ```css ` | `.clase { color: red; }` |
| **Java** | ` ```java ` | `System.out.println("Hola");` |
| **TypeScript** | ` ```typescript ` | `const x: number = 5;` |
| **Auto-detectar** | ` ``` ` (sin lenguaje) | El sistema intenta deducir el lenguaje |

**🎯 Recomendación:** Es **muy preferible especificar el lenguaje** para garantizar resaltado de sintaxis correcto. Usar ` ``` ` sin lenguaje requiere que el sistema intente auto-detectar, lo cual puede no ser siempre preciso.

### Ejemplos Correctos vs Incorrectos

#### ❌ INCORRECTO - Sin fences (se muestra como texto plano)
```json
{
  "item_type": "flashcard",
  "content_json": {
    "front": "¿Cuál es el comando para subir cambios en Git?",
    "back": "El comando es: git push origin main"
  }
}
```
**Problema:** Sin fences, el código `git push origin main` no tendrá resaltado de sintaxis.

---

#### ✅ CORRECTO - Con fences y lenguaje especificado
```json
{
  "item_type": "flashcard",
  "content_json": {
    "front": "¿Cuál es el comando para subir cambios en Git?",
    "back": "El comando es:\n\n```bash\ngit push origin main\n```"
  }
}
```
**Ventaja:** Con ` ```bash `, el código se renderiza con colores de sintaxis de bash/git.

---

#### ✅ CORRECTO - Múltiples bloques de código en una tarjeta
```json
{
  "item_type": "flashcard",
  "content_json": {
    "front": "Completa el comando para subir los cambios al repositorio remoto en Git:\n\n```bash\ngit ___ origin main\n```",
    "back": "El comando correcto es `push`.\n\n```bash\ngit push origin main\n```"
  },
  "hint": "Empuja los cambios hacia arriba",
  "explanation": "`git push` actualiza las referencias remotas usando las referencias locales, enviando los objetos necesarios."
}
```

---

#### ✅ CORRECTO - Código en preguntas de múltiple opción
```json
{
  "item_type": "multiple_choice",
  "content_json": {
    "question": "¿Cuál es la salida de este código Python?\n\n```python\nprint(2 + 2 * 3)\n```",
    "options": [
      "8",
      "12",
      "Ninguno de los anteriores"
    ],
    "correctIndex": 0
  },
  "explanation": "Según el orden de operaciones (PEMDAS), primero se realiza la multiplicación (2 * 3 = 6), luego la suma (2 + 6 = 8)."
}
```

---

#### ✅ CORRECTO - Código en opciones
```json
{
  "item_type": "multiple_choice",
  "content_json": {
    "question": "¿Cuál es la forma correcta de declarar una variable en JavaScript?",
    "options": [
      "```javascript\nvar x = 5;\n```",
      "```javascript\nlet x = 5;\n```",
      "```javascript\nconst x = 5;\n```",
      "```javascript\nx = 5;\n```"
    ],
    "correctIndex": 2
  },
  "explanation": "`const` es la forma moderna y recomendada para variables que no cambiarán."
}
```

---

### 🔧 Cómo Incluir Fences en Campos de Texto JSON

En un archivo JSON, los saltos de línea en strings se representan con `\n`:

```json
"back": "Primera línea\n\n```bash\ntu código aquí\n```\n\nÚltima línea"
```

Esto renderiza como:
```
Primera línea

```bash
tu código aquí
```

Última línea
```

---

## Ejemplo Completo (Con Código en Preguntas)

```json
{
  "title": "Fundamentos de Programación con Git",
  "description": "Conceptos básicos de JavaScript, Git y bases de datos",
  "cards": [
    {
      "item_type": "flashcard",
      "content_json": {
        "front": "¿Qué es una variable?",
        "back": "Un contenedor para almacenar datos que puede cambiar su valor durante la ejecución del programa.\n\n```javascript\nlet nombre = 'Juan';\nconst edad = 25;\n```"
      },
      "hint": "Es como una caja etiquetada",
      "explanation": "Las variables son fundamentales en programación. Se declaran con let, const o var en JavaScript."
    },
    {
      "item_type": "flashcard",
      "content_json": {
        "front": "Completa el comando de Git para enviar cambios al repositorio remoto:\n\n```bash\ngit ___ origin main\n```",
        "back": "El comando correcto es `push`.\n\n```bash\ngit push origin main\n```"
      },
      "hint": "Empuja (push) los cambios hacia el servidor remoto",
      "explanation": "`git push` actualiza las referencias remotas usando las referencias locales, enviando los objetos necesarios."
    },
    {
      "item_type": "multiple_choice",
      "content_json": {
        "question": "¿Cuál es la forma correcta de declarar una constante en JavaScript?",
        "options": [
          "```javascript\nlet PI = 3.14;\n```",
          "```javascript\nconst PI = 3.14;\n```",
          "```javascript\nvar PI = 3.14;\n```",
          "```javascript\nconstant PI = 3.14;\n```"
        ],
        "correctIndex": 1
      },
      "hint": "Piensa en la palabra clave correcta para una constante",
      "explanation": "En JavaScript ES6, `const` se usa para variables que no cambiarán. `let` se usa para variables locales, `var` está deprecado."
    },
    {
      "item_type": "multiple_choice",
      "content_json": {
        "question": "¿Cuál es la salida de este código Python?\n\n```python\nprint(2 + 2 * 3)\n```",
        "options": [
          "8",
          "12",
          "6",
          "Error de sintaxis"
        ],
        "correctIndex": 0
      },
      "hint": "Recuerda el orden de operaciones (PEMDAS)",
      "explanation": "Según el orden de operaciones, primero se realiza la multiplicación (2 * 3 = 6), luego la suma (2 + 6 = 8)."
    },
    {
      "item_type": "multiple_choice",
      "content_json": {
        "question": "¿Cuál es la consulta SQL correcta para obtener todos los usuarios?",
        "options": [
          "```sql\nGET * FROM users;\n```",
          "```sql\nSELECT * FROM users;\n```",
          "```sql\nFETCH * FROM users;\n```",
          "```sql\nQUERY users;\n```"
        ],
        "correctIndex": 1
      },
      "hint": "La palabra clave comienza con S",
      "explanation": "`SELECT` es la palabra clave SQL correcta para recuperar datos. `SELECT * FROM users;` obtiene todos los registros de la tabla users."
    },
    {
      "item_type": "boolean",
      "content_json": {
        "question": "En JavaScript, los arrays son indexados desde 1.",
        "correctAnswer": false
      },
      "hint": "Recuerda el primer elemento",
      "explanation": "Los arrays en JavaScript están indexados desde 0. El primer elemento tiene índice 0, no 1."
    },
    {
      "item_type": "boolean",
      "content_json": {
        "question": "El comando `git commit` envía los cambios al repositorio remoto.",
        "correctAnswer": false
      },
      "hint": "Commit guarda los cambios, pero ¿dónde?",
      "explanation": "`git commit` guarda los cambios en el repositorio local. Para enviarlos al remoto, debe usarse `git push`."
    }
  ]
}
```

---

## Validaciones

El sistema valida automáticamente:

✅ **Campos requeridos presentes**
- `item_type`: Debe ser uno de: `flashcard`, `multiple_choice`, `boolean`
- `content_json`: Debe ser un objeto JSON válido
- Campos específicos según el tipo (front/back, question/options, etc.)

✅ **Tipos de datos**
- Strings donde corresponden
- Numbers para índices
- Booleans para correctAnswer

✅ **Lógica**
- `correctIndex` debe estar dentro del rango de opciones (0 a length-1)
- Options debe tener al menos 1 elemento
- No permite valores nulos en campos requeridos

---

## Flujo de Importación

1. **Seleccionar archivo JSON** con estructura validada
2. **Crear mazo** vacío (sin materia asignada inicialmente)
3. **Procesar tarjetas** iterando sobre cada ítem en `cards[]`
4. **Crear cada tarjeta** usando el endpoint `/flashcard-decks/{deckId}/items`
5. **Asignar materia** en segundo paso (post-import)
6. **Actualizar lista** de mazos en la interfaz

---

## Notas Técnicas

- Los campos opcionales (`hint`, `explanation`) pueden omitirse o ser `null`
- El orden de los elementos en el array `cards` se preserva
- Cada tarjeta se guarda con `status: 'new'` y una fecha de repaso de 7 días
- Los valores se normalizan automáticamente (trimmed, etc.)

---

## Errores Comunes

❌ **Error: El código no tiene resaltado de sintaxis (se ve como texto plano)**
- **Causa**: No usar fences (```) para envolver el código
- **Solución**: Siempre envolver bloques de código con triple backtick y especificar el lenguaje. Ejemplo: ` ```bash código aquí ``` `

❌ **Error: Faltan campos requeridos (front, back)**
- **Causa**: Usar `type` y `data` en lugar de `item_type` y `content_json`
- **Solución**: Usar la estructura correcta según el tipo

❌ **Error: item_type debe ser uno de: flashcard, multiple_choice, boolean**
- **Causa**: Tipografía incorrecta o valor no válido en `item_type`
- **Solución**: Verificar que sea exactamente: `flashcard`, `multiple_choice`, o `boolean`

❌ **Error: Se requiere content_json**
- **Causa**: El campo está vacío o no es válido JSON
- **Solución**: Verificar que sea un objeto JSON válido

❌ **Error: El código en las opciones no aparece bien formateado**
- **Causa**: No usar fences en campos de opciones
- **Solución**: Envolver cada fragmento de código en ` ```lenguaje ... ``` `, incluso dentro de arrays de opciones


---
**Tags:** #flashcards #domains/flashcards

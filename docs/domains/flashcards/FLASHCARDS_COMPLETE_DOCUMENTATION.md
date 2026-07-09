# 📚 Documentación Completa del Sistema de Flashcards

**Última actualización:** Mayo 2026

---

## 📖 Tabla de Contenidos

1. [Sistema de Importación de Flashcards](#1-sistema-de-importación-de-flashcards)
2. [Sistema de Resaltado de Código (Code Highlighter)](#2-sistema-de-resaltado-de-código-code-highlighter)
3. [Tipos de Flashcards](#3-tipos-de-flashcards)
4. [Estructura JSON Completa](#4-estructura-json-completa)
5. [Componentes de Cada Flashcard](#5-componentes-de-cada-flashcard)
6. [Ejemplos Prácticos](#6-ejemplos-prácticos)
7. [Validaciones y Errores](#7-validaciones-y-errores)
8. [Flujo de Importación](#8-flujo-de-importación)

---

## 1. Sistema de Importación de Flashcards

### 1.1 ¿Qué es el Import de Flashcards?

El sistema de importación permite que los usuarios suban mazos de flashcards en formato JSON desde sus dispositivos. El proceso:

1. **Seleccionar archivo JSON** desde el dispositivo
2. **Validar estructura** del JSON
3. **Crear mazo** en la [[DATABASE_DOCUMENTATION|base de datos]]
4. **Procesar tarjetas** y crearlas una a una
5. **Asignar materia** (opcional)

### 1.2 Requisitos del Archivo JSON

**Tamaño máximo:** 10 MB

**Validaciones requeridas:**
- ✅ Debe ser JSON válido
- ✅ Debe contener un campo `title` (no vacío)
- ✅ Cada tarjeta debe tener un `type` válido
- ✅ Cada tarjeta debe tener un objeto `data`
- ✅ Las llaves pueden estar en camelCase o snake_case (se normalizan automáticamente)

### 1.3 Características de la Importación

| Característica | Descripción |
|---|---|
| **Normalización** | Las llaves `correct_index` y `correct_answer` se convierten a `correctIndex` y `correctAnswer` automáticamente |
| **Soporte de materias** | Opcional asignar `subject_id` al mazo |
| **Manejo de errores** | Si una tarjeta falla, continúa con las demás (no detiene el proceso) |
| **Reporte de estado** | Muestra cantidad de tarjetas exitosas y fallidas |
| **Template descargable** | Los usuarios pueden descargar una plantilla JSON para guiarse |

### 1.4 Descarga de Plantilla

La plantilla predeterminada incluye:

```json
{
  "_INSTRUCCIONES_": "IMPORTANTE: Para 'multiple_choice', opciones desde 0 (ej: correctIndex: 0). Para 'boolean', usa true o false. CÓDIGO: Las preguntas que contengan código DEBEN usar markdown fences (```lenguaje código ```). Especifica el lenguaje después de los backticks.",
  "title": "Mi Mazo Ejemplo",
  "description": "Descripción del mazo (opcional)",
  "subject_id": 1,
  "cards": [
    // Array de tarjetas aquí
  ]
}
```

### 1.5 Ubicación en el Código

**Frontend (Mobile):**
- [FlashcardImportModal.tsx](mobile/src/components/FlashcardImportModal.tsx) - Componente principal
- [FlashcardImportModal.styles.ts](mobile/src/styles/FlashcardImportModal.styles.ts) - Estilos

**Backend:**
- [flashcardsController.js](backend/controllers/flashcardsController.js) - Lógica del servidor
- [flashcards.ts](mobile/src/services/[[API_DOCUMENTATION|api]]/flashcards.ts) - Servicio API

---

## 2. Sistema de Resaltado de Código (Code Highlighter)

### 2.1 ¿Qué es el Code Highlighter?

El **Code Highlighter** es un componente que renderiza bloques de código con **resaltado de sintaxis** (syntax highlighting) para múltiples lenguajes de programación.

**Ubicación:** [CodeHighlighter.tsx](mobile/src/components/CodeHighlighter.tsx)

### 2.2 Librería Base

- **Librería:** `highlight.js` (v11+)
- **Total de lenguajes en highlight.js:** 190+ lenguajes disponibles
- **Método:** Lazy initialization (se carga bajo demanda)
- **Estrategia:** On-demand language registration

### 2.3 Lenguajes Actualmente Registrados en la App

**Cantidad actual:** 38 lenguajes registrados (54 alias incluyendo variantes)

⚠️ **Aclaración importante:** 
- Highlight.js soporta más de 190 lenguajes
- Actualmente en la aplicación hay **38 lenguajes explícitamente registrados** en [CodeHighlighter.tsx](mobile/src/components/CodeHighlighter.tsx)
- Es muy fácil agregar más lenguajes siguiendo el patrón (ver sección 2.4)

| # | Lenguaje | Aliases/Variantes |
|---|---|---|
| 1 | **JavaScript** | `js` |
| 2 | **TypeScript** | `ts` |
| 3 | **Python** | `py` |
| 4 | **Java** | — |
| 5 | **C++** | `c++` |
| 6 | **C#** | `cs`, `csharp` |
| 7 | **Go** | `golang` |
| 8 | **Rust** | `rs` |
| 9 | **PHP** | — |
| 10 | **Swift** | — |
| 11 | **Kotlin** | `kt` |
| 12 | **Ruby** | `rb` |
| 13 | **SQL** | — |
| 14 | **HTML** | — |
| 15 | **XML** | — |
| 16 | **CSS** | — |
| 17 | **Bash/Shell** | `shell`, `sh`, `git` |
| 18 | **PowerShell** | `ps` |
| 19 | **R** | — |
| 20 | **Scala** | — |
| 21 | **Groovy** | — |
| 22 | **Elixir** | `ex` |
| 23 | **Dart** | — |
| 24 | **Objective-C** | `objc` |
| 25 | **VB.NET** | — |
| 26 | **JSON** | — |
| 27 | **PL/SQL** | `oracle`, `plsql` |
| 28 | **T-SQL** | `mssql`, `tsql`, `t-sql` |
| 29 | **PL/pgSQL** | `postgresql`, `postgres` |
| 30 | **GraphQL** | — |
| 31 | **MongoDB** | `mongo` |
| 32 | **Plaintext** | (sin colores) |

**Resumen:**
- **Lenguajes únicos registrados:** 32
- **Total de alias/variantes:** 54 registros (algunos lenguajes tienen múltiples alias)
- **Lenguajes disponibles en highlight.js:** 190+
- **Lenguajes fáciles de agregar:** Todos los soportados por highlight.js

### 2.4 Cómo Registrar Nuevos Lenguajes

Aunque highlight.js soporta 190+ lenguajes, solo necesitamos registrar los que realmente usamos en la app (por optimización de bundle size). Es muy fácil agregar más:

**Pasos para agregar un nuevo lenguaje:**

1. **Verificar que existe en highlight.js:**
   - Ir a https://highlightjs.org/static/demo/
   - Buscar el lenguaje deseado
   - Confirmr que está disponible

2. **Agregar al archivo CodeHighlighter.tsx:**
   
   Ubicar la función `initializeHighlightJS()` y agregar:
   ```typescript
   hljs.registerLanguage('lenguaje', require('highlight.js/lib/languages/lenguaje'));
   hljs.registerLanguage('alias', require('highlight.js/lib/languages/lenguaje'));
   ```

3. **Reemplazar valores:**
   - `lenguaje`: nombre oficial en highlight.js (ej: `lua`, `perl`, `haskell`)
   - `alias`: (opcional) nombre corto o alias alternativo

4. **Ejemplo: Agregar Lua**
   ```typescript
   hljs.registerLanguage('lua', require('highlight.js/lib/languages/lua'));
   hljs.registerLanguage('lua53', require('highlight.js/lib/languages/lua')); // alias
   ```

5. **Documentar en este archivo** - actualizar sección 2.3 con el nuevo lenguaje

6. **Verificar funcionamiento:**
   - Ejecutar la app en desarrollo
   - Crear una flashcard con código en Lua con fences: ` ```lua ... ``` `
   - Confirmar que se resalta correctamente

**Lenguajes populares no registrados aún que se pueden agregar fácilmente:**
- Lua
- Perl
- Haskell
- Clojure
- Erlang
- F#
- MATLAB
- LISP
- Scheme
- Prolog
- Makefile
- Dockerfile
- YAML
- TOML
- CMake
- Y muchos más...

### 2.5 Sistema de Colores

El highlighter usa un esquema de colores configurable:

```typescript
const tokenColors = {
  keyword: '#FF6B6B',          // Rojo
  string: '#51CF66',           // Verde
  number: '#FFD43B',           // Amarillo
  comment: '#909090',          // Gris
  attr: '#A78BFA',             // Púrpura
  builtin: '#74C0FC',          // Azul claro
  literal: '#FFD43B',          // Amarillo
  type: '#A78BFA',             // Púrpura
  tag: '#FF6B6B',              // Rojo
  default: '#FFFFFF',          // Blanco
};
```

**Tipos de tokens adicionales:**
- `function`: #74C0FC (Azul claro)
- `variable`: #E5C07B (Amarillo anaranjado)
- `property`: #61AFEF (Azul)
- `operator`: #ABB2BF (Gris claro)
- `punctuation`: #ABB2BF (Gris claro)

### 2.6 Uso en Flashcards

El Code Highlighter se utiliza automáticamente cuando una tarjeta contiene bloques de código con markdown fences:

```markdown
```javascript
const message = "Hola, mundo!";
console.log(message);
```
```

**Nota:** Sin especificar el lenguaje, el sistema intenta auto-detectar:
```markdown
```
console.log("Hola");
```
```

---

## 3. Tipos de Flashcards

### 3.1 Resumen de los 3 Tipos

| Tipo | Uso | Estructura | Ejemplo |
|---|---|---|---|
| **flashcard** | Aprendizaje tradicional frente-reverso | `front`, `back` | Definiciones, conceptos |
| **multiple_choice** | Evaluación estilo ECAES/SABER PRO | `question`, `options[]`, `correctIndex` | Exámenes estandarizados |
| **boolean** | Preguntas de Verdadero/Falso | `question`, `correctAnswer` (bool) | Afirmaciones técnicas |

### 3.2 Tipo 1: Flashcard (Clásica)

**Propósito:** Aprendizaje de conceptos mediante repaso activo (recall).

**Estructura:**
```typescript
{
  type: 'flashcard',
  data: {
    front: string,    // Pregunta o concepto
    back: string      // Respuesta o explicación
  },
  hint?: string,
  explanation?: string
}
```

**Ejemplos de uso:**
- Definiciones de términos
- Fórmulas matemáticas
- Conceptos de programación
- Vocabulario en idiomas

### 3.3 Tipo 2: Multiple Choice (Opción Múltiple)

**Propósito:** Evaluación formativa estilo ECAES/SABER PRO con distractores diseñados pedagógicamente.

**Estructura:**
```typescript
{
  type: 'multiple_choice',
  data: {
    question: string,
    options: string[],     // Mínimo 2, máximo 4 recomendado
    correctIndex: number   // 0-based (0 = primera opción)
  },
  hint?: string,
  explanation?: string
}
```

**Validaciones:**
- ✅ `options` debe tener mínimo 2 elementos
- ✅ `correctIndex` debe ser válido (0 a options.length - 1)
- ✅ Todas las opciones deben ser semánticamente únicas (no duplicados conceptuales)

**Distractores de calidad:**
Cada opción incorrecta debe nacer de un error de razonamiento específico:
- Confusión de términos similares
- Aplicación incorrecta de fórmulas
- Conceptos relacionados pero incorrectos

### 3.4 Tipo 3: Boolean (Verdadero/Falso)

**Propósito:** Preguntas rápidas sobre afirmaciones técnicas o conceptuales.

**Estructura:**
```typescript
{
  type: 'boolean',
  data: {
    question: string,
    correctAnswer: boolean    // true o false
  },
  hint?: string,
  explanation?: string
}
```

**Características:**
- Afirmaciones con matices técnicos
- No deben ser ambiguas
- Explicación debe justificar la respuesta

---

## 4. Estructura JSON Completa

### 4.1 Estructura General del Archivo

```json
{
  "title": "string (requerido, no vacío)",
  "description": "string (opcional)",
  "subject_id": "number (opcional)",
  "cards": [
    // Array de tarjetas
  ]
}
```

### 4.2 Estructura por Tipo de Tarjeta

#### Flashcard
```json
{
  "type": "flashcard",
  "data": {
    "front": "¿Cuál es la capital de Francia?",
    "back": "París"
  },
  "hint": "Tiene la Torre Eiffel (opcional)",
  "explanation": "París es la ciudad más grande de Francia (opcional)"
}
```

#### Multiple Choice
```json
{
  "type": "multiple_choice",
  "data": {
    "question": "¿Cuál es la salida del código?",
    "options": [
      "Opción A",
      "Opción B",
      "Opción C",
      "Opción D"
    ],
    "correctIndex": 0
  },
  "hint": "Considera el orden de operaciones (opcional)",
  "explanation": "Porque... (opcional)"
}
```

#### Boolean
```json
{
  "type": "boolean",
  "data": {
    "question": "2 + 2 = 4",
    "correctAnswer": true
  },
  "hint": "Suma aritmética básica (opcional)",
  "explanation": "Es una operación aritmética correcta (opcional)"
}
```

### 4.3 Archivo JSON Completo (Ejemplo)

```json
{
  "title": "Introducción a JavaScript",
  "description": "Conceptos básicos de JavaScript para principiantes",
  "subject_id": 5,
  "cards": [
    {
      "type": "flashcard",
      "data": {
        "front": "¿Qué es una variable en JavaScript?",
        "back": "Un contenedor para almacenar valores de datos que pueden cambiar durante la ejecución del programa."
      },
      "hint": "Es un nombre que le das a un lugar de memoria",
      "explanation": "Las variables permiten que los programas sean dinámicos y reutilicen valores"
    },
    {
      "type": "multiple_choice",
      "data": {
        "question": "¿Cuál es la palabra clave moderna para declarar variables en JavaScript?",
        "options": [
          "var",
          "let",
          "name",
          "fn"
        ],
        "correctIndex": 1
      },
      "hint": "Introducida en ES6",
      "explanation": "'let' es la forma moderna, 'var' está deprecada"
    },
    {
      "type": "boolean",
      "data": {
        "question": "JavaScript se ejecuta en el navegador",
        "correctAnswer": true
      },
      "hint": "Es un lenguaje del lado del cliente",
      "explanation": "JavaScript es un lenguaje interpretado por el navegador web"
    }
  ]
}
```

---

## 5. Componentes de Cada Flashcard

### 5.1 Campos Universales

Todos los tipos de tarjetas comparten estos campos opcionales:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `type` | string | ✅ | Tipo de tarjeta: `flashcard`, `multiple_choice`, `boolean` |
| `data` | object | ✅ | Objeto con estructura específica según el tipo |
| `hint` | string | ❌ | Pista para guiar al estudiante sin dar la respuesta |
| `explanation` | string | ❌ | Explicación profunda del por qué (fundamentos, contexto) |

### 5.2 Campo: `front` (Flashcard)

**Tipo:** string
**Requerido:** ✅
**Descripción:** Lado frontal de la tarjeta, generalmente la pregunta o concepto

**Características:**
- Puede contener código con markdown fences
- Debe ser desafiante pero claro
- Máximo recomendado: 300 caracteres

**Ejemplo:**
```json
"front": "¿Cuál es el comando Git para enviar cambios?\n\n```bash\ngit ___ origin main\n```"
```

### 5.3 Campo: `back` (Flashcard)

**Tipo:** string
**Requerido:** ✅
**Descripción:** Lado reverso de la tarjeta, la respuesta o explicación

**Características:**
- Puede contener código con markdown fences
- Máximo recomendado: 500 caracteres
- Debe ser preciso y técnico
- Idealmente 2-3 oraciones

**Ejemplo:**
```json
"back": "El comando correcto es `push`.\n\n```bash\ngit push origin main\n```\n\nEsto envía los cambios locales al repositorio remoto."
```

### 5.4 Campo: `question` (Multiple Choice / Boolean)

**Tipo:** string
**Requerido:** ✅
**Descripción:** La pregunta o afirmación a evaluar

**Características:**
- Para multiple choice: Pregunta clara y específica
- Para boolean: Afirmación con matices técnicos
- Puede contener código

**Ejemplos:**
```json
// Multiple Choice
"question": "¿Cuál es la salida de este código?\n\n```javascript\nconsole.log(2 + 2 * 3);\n```"

// Boolean
"question": "El operador === en JavaScript compara tipo y valor"
```

### 5.5 Campo: `options` (Multiple Choice)

**Tipo:** string[]
**Requerido:** ✅
**Restricciones:** Mínimo 2, máximo ilimitado (recomendado 4)

**Características:**
- Cada opción debe ser única y diferenciada semánticamente
- Pueden contener código
- Los distractores deben nacer de errores específicos

**Validación:**
```javascript
// ❌ INCORRECTO: Opciones duplicadas semánticamente
{
  "options": [
    "una lista de elementos",
    "un conjunto de valores",  // Mismo concepto
    "un arreglo",
    "un vector"  // Otro nombre para lo mismo
  ]
}

// ✅ CORRECTO: Opciones únicas
{
  "options": [
    "Una estructura de datos ordenada e indexada",
    "Una estructura sin orden específico",
    "Una estructura de clave-valor",
    "Una estructura enlazada"
  ]
}
```

### 5.6 Campo: `correctIndex` (Multiple Choice)

**Tipo:** number
**Requerido:** ✅
**Rango:** 0 a (options.length - 1)

**Características:**
- **Base 0:** El primer elemento tiene índice 0
- Debe ser válido para la longitud del array

**Ejemplo:**
```json
{
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0  // La opción "A" es correcta
}
```

### 5.7 Campo: `correctAnswer` (Boolean)

**Tipo:** boolean
**Requerido:** ✅
**Valores:** `true` o `false`

**Ejemplo:**
```json
{
  "question": "JavaScript es un lenguaje tipado fuertemente",
  "correctAnswer": false  // Es incorrecto: JS es débilmente tipado
}
```

### 5.8 Campo: `hint` (Todos los tipos)

**Tipo:** string
**Requerido:** ❌ (Opcional)
**Máximo recomendado:** 100 caracteres

**Propósito:** Dar una pista que active el pensamiento sin revelar la respuesta

**Características:**
- Debe ser un "andamiaje cognitivo" (ruta de pensamiento)
- NO debe ser una respuesta parcial
- Debe guiar hacia el razonamiento correcto

**Ejemplos correctos:**
```json
// Flashcard
"hint": "Empuja los cambios hacia arriba"

// Multiple Choice
"hint": "Recuerda el orden de operaciones (multiplicación antes que suma)"

// Boolean
"hint": "Considera el comportamiento de comparación de tipos"
```

**Ejemplos incorrectos:**
```json
// ❌ Respuesta parcial (no es una pista)
"hint": "El comando comienza con 'pu...'"

// ❌ Demasiado específico
"hint": "Respuesta empieza con G"
```

### 5.9 Campo: `explanation` (Todos los tipos)

**Tipo:** string
**Requerido:** ❌ (Opcional)
**Máximo recomendado:** 500 caracteres

**Propósito:** Profundizar en el concepto, explicar el "por qué" fundamental

**Características:**
- Debe incluir contexto académico
- Puede contener código
- Explica el fundamento, no parafrasea la pregunta
- Puede incluir ejemplos o aplicaciones

**Ejemplos:**

```json
// Flashcard
"explanation": "`git push` actualiza las referencias remotas usando las referencias locales, enviando objetos necesarios al servidor. Es parte del flujo de trabajo distribuido de Git."

// Multiple Choice
"explanation": "Según el orden de operaciones (PEMDAS: Paréntesis, Exponentes, Multiplicación, División, Adición, Sustracción), primero se realiza 2 * 3 = 6, luego 2 + 6 = 8. Las opciones B, C, D representan errores comunes en el orden de operaciones."

// Boolean
"explanation": "JavaScript es débilmente tipado (loose typing). La variable puede contener cualquier tipo sin declararlo previamente. Esto contrasta con lenguajes como Java o TypeScript que requieren tipado fuerte."
```

---

## 6. Ejemplos Prácticos

### 6.1 Flashcard con Código

```json
{
  "type": "flashcard",
  "data": {
    "front": "Completa el bucle for en JavaScript para iterar 5 veces:\n\n```javascript\nfor (let i = ___; i < ___; i++) {\n  console.log(i);\n}\n```",
    "back": "La forma correcta es:\n\n```javascript\nfor (let i = 0; i < 5; i++) {\n  console.log(i);\n}\n```\n\nEsto imprimirá los números 0, 1, 2, 3, 4. Comienza en 0 y termina antes de llegar a 5."
  },
  "hint": "Los índices en programación comienzan en 0",
  "explanation": "El bucle for tiene tres partes: inicialización (i = 0), condición (i < 5), incremento (i++). Se ejecuta mientras la condición sea verdadera."
}
```

### 6.2 Multiple Choice con Código y Distractores

```json
{
  "type": "multiple_choice",
  "data": {
    "question": "¿Cuál es la salida de este código Python?\n\n```python\nx = [1, 2, 3]\nprint(x[0])\n```",
    "options": [
      "1",
      "[1]",
      "undefined",
      "IndexError"
    ],
    "correctIndex": 0
  },
  "hint": "Las listas en Python se indexan desde 0",
  "explanation": "x[0] accede al primer elemento de la lista (índice 0). En Python, las listas son indexadas desde 0, no desde 1. La opción B sería si imprimiéramos x[0:1]. Las opciones C y D son errores de JavaScript y error de programación respectivamente."
}
```

### 6.3 Mazo Mixto Completo

```json
{
  "title": "SQL Fundamentals",
  "description": "Conceptos básicos de SQL para bases de datos relacionales",
  "subject_id": 12,
  "cards": [
    {
      "type": "flashcard",
      "data": {
        "front": "¿Qué es una consulta SELECT?",
        "back": "Una instrucción SQL que recupera datos de una o más tablas de la base de datos."
      },
      "hint": "Es la operación de lectura más común",
      "explanation": "SELECT es una de las sentencias DML (Data Manipulation Language) más importantes. Permite especificar qué columnas y filas quieres obtener."
    },
    {
      "type": "flashcard",
      "data": {
        "front": "Escribe una consulta para obtener todos los usuarios:\n\n```sql\n? * FROM users;\n```",
        "back": "La consulta correcta es:\n\n```sql\nSELECT * FROM users;\n```\n\nEl * significa \"todas las columnas\"."
      },
      "hint": "Palabra clave: S-E-L..."
      "explanation": "SELECT es la palabra clave para recuperar registros. * especifica todas las columnas. FROM indica la tabla de origen."
    },
    {
      "type": "multiple_choice",
      "data": {
        "question": "¿Cuál de los siguientes comandos es una sentencia DDL (Data Definition Language)?\n\n```sql\nA) SELECT * FROM users;\nB) INSERT INTO users VALUES (...);\nC) CREATE TABLE users (...);\nD) UPDATE users SET name = 'John';\n```",
        "options": [
          "SELECT * FROM users;",
          "INSERT INTO users VALUES (...);",
          "CREATE TABLE users (...);",
          "UPDATE users SET name = 'John';"
        ],
        "correctIndex": 2
      },
      "hint": "DDL se refiere a definición de estructura, no manipulación de datos",
      "explanation": "CREATE TABLE es DDL porque define la estructura de la tabla. SELECT, INSERT y UPDATE son DML porque manipulan datos existentes. DDL = definición, DML = manipulación."
    },
    {
      "type": "boolean",
      "data": {
        "question": "En SQL, la cláusula WHERE se ejecuta ANTES que la cláusula SELECT",
        "correctAnswer": true
      },
      "hint": "Considera el orden de ejecución lógico en SQL",
      "explanation": "Aunque escribimos SELECT primero, SQL ejecuta WHERE antes. El orden de ejecución es: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY. WHERE filtra antes de seleccionar columnas."
    }
  ]
}
```

---

## 7. Validaciones y Errores

### 7.1 Validaciones del Sistema

```typescript
// Validación de estructura
✅ JSON válido
✅ Campo 'title' existe y no está vacío
✅ Array 'cards' existe (puede estar vacío)
✅ Cada card tiene 'type' válido ('flashcard', 'multiple_choice', 'boolean')
✅ Cada card tiene objeto 'data'
✅ Tamaño del archivo ≤ 10 MB

// Validación por tipo
Flashcard:
  ✅ data.front existe y no está vacío
  ✅ data.back existe y no está vacío

Multiple Choice:
  ✅ data.question existe
  ✅ data.options es array con ≥ 2 elementos
  ✅ data.correctIndex es número válido (0 a options.length - 1)

Boolean:
  ✅ data.question existe
  ✅ data.correctAnswer es boolean
```

### 7.2 Mensajes de Error Comunes

| Error | Causa | Solución |
|---|---|---|
| "El archivo no es un JSON válido" | JSON mal formado | Validar sintaxis con un linter JSON |
| "Faltan campos requeridos" | Falta 'title' | Asegurarse que haya `"title": "..."` |
| "Tipo de ítem inválido" | type no es válido | Usar solo: `flashcard`, `multiple_choice`, `boolean` |
| "Ítem sin campo data" | data no existe | Cada card debe tener `"data": {...}` |
| "El archivo es demasiado grande" | > 10 MB | Reducir cantidad de tarjetas o contenido |
| "correctIndex fuera de rango" | Index > opciones | Verificar que correctIndex < options.length |

### 7.3 Normalización de Llaves

El sistema normaliza automáticamente:

```javascript
// Entrada (snake_case)
{
  "correct_index": 0,
  "correct_answer": false
}

// Se normaliza a (camelCase)
{
  "correctIndex": 0,
  "correctAnswer": false
}
```

---

## 8. Flujo de Importación

### 8.1 Diagrama de Flujo

```
┌─────────────────────────┐
│ Usuario abre Import     │
│ Modal                   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Selecciona archivo JSON │
│ (DocumentPicker)        │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Valida tamaño (< 10MB)  │
└────────────┬────────────┘
             │ ❌ Demasiado grande
             ├──────────────────────► Error
             │ ✅ OK
             ▼
┌─────────────────────────┐
│ Lee contenido JSON      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Valida estructura JSON  │
└────────────┬────────────┘
             │ ❌ JSON inválido
             ├──────────────────────► Error
             │ ✅ JSON válido
             ▼
┌─────────────────────────┐
│ Valida campo 'title'    │
└────────────┬────────────┘
             │ ❌ Sin title
             ├──────────────────────► Error
             │ ✅ OK
             ▼
┌─────────────────────────┐
│ Crea mazo en BD         │
│ (sin subject_id aún)    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Procesa cada tarjeta:   │
│ - Normaliza llaves      │
│ - Valida estructura     │
│ - Crea en BD            │
│ (continúa si hay error) │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Muestra resumen:        │
│ X exitosas, Y fallidas  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ (Opcional) Usuario      │
│ asigna materia          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Cierra modal            │
│ Recarga lista de mazos  │
└─────────────────────────┘
```

### 8.2 Código del Flujo (Frontend)

**Archivo:** [FlashcardImportModal.tsx](mobile/src/components/FlashcardImportModal.tsx)

```typescript
// 1. Usuario elige archivo
const handleLaunchPicker = async () => {
  const result = await DocumentPicker.getDocumentAsync();
  await handleImportJSON(result.assets[0]);
};

// 2. Procesar JSON
const handleImportJSON = async (file) => {
  // Validar tamaño
  if (file.size > 10 * 1024 * 1024) {
    showAlert({ message: 'Archivo demasiado grande' });
    return;
  }

  // Leer JSON
  const jsonContent = await FileSystem.readAsStringAsync(file.uri);
  const deckData = JSON.parse(jsonContent);

  // Validar estructura
  if (!deckData.title?.trim()) {
    showAlert({ message: 'El archivo debe tener un título' });
    return;
  }

  // Crear mazo
  const newDeck = await createFlashcardDeck({
    title: deckData.title.trim(),
    description: deckData.description?.trim(),
  });

  // Procesar tarjetas
  for (const card of deckData.cards || []) {
    await createEvaluationItem({
      deck_id: newDeck.id,
      item_type: card.type,
      content_json: normalizeKeys(card.data),
      hint: card.hint,
      explanation: card.explanation,
    });
  }

  // Mostrar éxito
  showAlert({ message: `Mazo "${deckData.title}" importado` });
};
```

### 8.3 Funciones Clave en Backend

**Archivo:** [flashcardsController.js](backend/controllers/flashcardsController.js)

```javascript
// Crear mazo
exports.createFlashcardDeck = async (req, res) => {
  const { title, description, user_id, subject_id } = req.body;
  // INSERT INTO flashcard_decks ...
};

// Crear tarjeta
exports.createEvaluationItem = async (req, res) => {
  const { deck_id, item_type, content_json, hint, explanation } = req.body;
  // INSERT INTO evaluation_items ...
};
```

---

## 9. Mejores Prácticas

### 9.1 Al Crear Flashcards

✅ **Hacer:**
- Usar código con markdown fences cuando sea relevante
- Especificar el lenguaje (`bash`, `javascript`, `sql`, etc.)
- Pistas que guíen el pensamiento
- Explicaciones profundas con contexto académico
- Distractores en multiple choice con errores razonados

❌ **Evitar:**
- Preguntas ambiguas o vagas
- Respuestas demasiado largas (usar `back` para eso)
- Pistas que revelen la respuesta
- Explicaciones que parafraseen la pregunta
- Distractores aleatorios en multiple choice

### 9.2 Al Importar

✅ **Hacer:**
- Validar el JSON con un linter antes de importar
- Probar con pocos ítems primero
- Usar la plantilla descargable como base
- Asignar una materia después de importar
- Revisar el resumen de importación

❌ **Evitar:**
- Importar archivos > 10 MB
- Usar tipos de tarjeta inválidos
- Dejar campos obligatorios vacíos
- Olvidar markdown fences en código

### 9.3 Al Usar Code Highlighter

✅ **Hacer:**
- Especificar siempre el lenguaje
- Usar lenguajes registrados (ver lista en sección 2.3)
- Mantener el código legible y con indentación
- Usar ` ``` ` triple backtick

❌ **Evitar:**
- Sin especificar lenguaje (auto-detect no es 100% confiable)
- Lenguajes no soportados
- Código sin fences (sin colores)
- Indentación inconsistente

---

## 10. Referencias y Recursos

### 10.1 Archivos Relacionados

- **Frontend:**
  - [FlashcardImportModal.tsx](mobile/src/components/FlashcardImportModal.tsx)
  - [CodeHighlighter.tsx](mobile/src/components/CodeHighlighter.tsx)
  - [flashcards.ts](mobile/src/services/api/flashcards.ts)

- **Backend:**
  - [flashcardsController.js](backend/controllers/flashcardsController.js)
  - [aiController.js](backend/controllers/aiController.js)

- **Estilos:**
  - [FlashcardImportModal.styles.ts](mobile/src/styles/FlashcardImportModal.styles.ts)

- **Localización:**
  - [es/flashcards.json](mobile/src/locales/es/flashcards.json)
  - [en/flashcards.json](mobile/src/locales/en/flashcards.json)

### 10.2 Librerías Utilizadas

| Librería | Uso |
|---|---|
| `highlight.js` | Resaltado de sintaxis para código |
| `expo-document-picker` | Selección de archivos JSON |
| `expo-file-system` | Lectura de archivos |
| `expo-sharing` | Compartir plantilla |
| `react-i18next` | Internacionalización (i18n) |

### 10.3 Documentación Externa

- [highlight.js Languages](https://highlightjs.org/static/demo/)
- [JSON Schema Validator](https://www.jsonschemavalidator.net/)
- [Markdown Syntax](https://www.markdownguide.org/)

---

## 11. Historial de Cambios

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | Mayo 2026 | Documentación inicial completa |
| — | — | — |

---

**Documento generado:** Mayo 22, 2026  
**Última actualización:** Mayo 22, 2026  
**Mantenedor:** Threshold Development Team

---


---
**Tags:** #flashcards #domains/flashcards

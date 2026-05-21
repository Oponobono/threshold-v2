/**
 * academicPromptBuilder.js
 *
 * Constructor de prompts académicos de alto nivel basados en Taxonomía de Bloom.
 * Genera preguntas cognitivas profundas, no trivialidades.
 *
 * PRINCIPIOS:
 * 1. NO preguntar sobre metadatos (títulos, capítulos, números de sesión)
 * 2. Nivel cognitivo ALTO: Análisis, Síntesis, Evaluación (no solo Memoria)
 * 3. Distractores realistas: Errores conceptuales comunes en la disciplina
 * 4. Independencia: Cada pregunta debe poder responderse sin el documento
 * 5. Pedagogía: Pistas útiles (empujones hacia el razonamiento) + explicaciones magistrales
 */

/**
 * Construye un prompt de sistema de alto nivel para generación de evaluaciones.
 * 
 * @param {string} mode - 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed'
 * @param {number} count - Cantidad de ítems a generar
 * @param {string} [discipline] - Disciplina (opcional, para personalizar distractores)
 * @param {string} [difficulty] - Nivel: 'pregrado' | 'posgrado' (default: 'posgrado')
 * @returns {string} Prompt estructurado para Gemini
 */
function buildSystemPrompt(mode, count, discipline = '', difficulty = 'posgrado') {
  const isPostgrado = difficulty === 'posgrado';
  
  const baseInstructions = `Actúa como un Catedrático Universitario experto en diseño de evaluaciones de ${isPostgrado ? 'nivel Posgrado' : 'nivel Pregrado'}.
Tu misión ÚNICA es transformar el material en un reto intelectual riguroso, ignorando completamente la estructura formal del documento.

═══════════════════════════════════════════════════════════════════════════════
REGLAS DE ORO (NO NEGOCIABLES PARA CUALQUIER MATERIA):
═══════════════════════════════════════════════════════════════════════════════

1️⃣  PROHIBICIÓN ABSOLUTA DE META-DATOS:
   ❌ PROHIBIDO preguntar: "¿Cuál es el título?", "¿En qué sesión?", "¿Menciona X el documento?"
   ❌ PROHIBIDO hacer preguntas sobre la FORMA del documento
   ✅ OBLIGATORIO: Preguntar sobre la SUSTANCIA — el conocimiento puro de la disciplina

2️⃣  TAXONOMÍA DE BLOOM (NIVEL COGNITIVO OBLIGATORIO):
   Distribuir así (${isPostgrado ? '70% Análisis/Síntesis/Evaluación' : '60% Análisis/Síntesis'}):
   
   📊 NIVEL 1 - MEMORIA (MÍNIMO 10%): "¿Qué es...?", "Defina..."
      └─ SOLO para conceptos clave ineludibles
   
   📊 NIVEL 2 - COMPRENSIÓN (MÁXIMO 20%): "Explique...", "Describa..."
   
   📊 NIVEL 3 - APLICACIÓN (MÍNIMO 20%): "¿Cómo se aplica...?", "Resuelva este caso..."
   
   📊 NIVEL 4 - ANÁLISIS (MÍNIMO 25%): "¿Cuál es la diferencia entre...?", "Analice por qué..."
   
   📊 NIVEL 5 - SÍNTESIS (MÍNIMO 15%): "¿Qué pasaría si cambiamos...?", "Proponga una solución..."
   
   📊 NIVEL 6 - EVALUACIÓN (MÍNIMO 15%): "Justifique...", "Crítica conceptual...", "Evalúe la validez..."

3️⃣  DISTRACTORES ACADÉMICOS (ERRORES REALES DE LA DISCIPLINA):
   Cada opción incorrecta DEBE ser:
   ✅ Un error conceptual común (ej: confundir causa con efecto)
   ✅ Un malentendido típico de estudiantes
   ✅ Una aplicación parcial incorrecta
   ❌ NUNCA opciones absurdas u obvias
   ❌ NUNCA repetir la respuesta correcta con ligeras variaciones

4️⃣  INDEPENDENCIA RADICAL DEL ÍTEM:
   • Cada pregunta DEBE entenderse de forma autónoma
   • NO puede requerir el documento delante para ser respondida
   • El estudiante usa CONOCIMIENTO, no BÚSQUEDA EN EL TEXTO

5️⃣  COMPONENTES PEDAGÓGICOS (OBLIGATORIO):
   
   🔹 HINT (Pista - 15-20 palabras):
      • NO es la respuesta disfrazada
      • Es un "empujón" hacia el razonamiento correcto
      • Ejemplo MALO: "La respuesta es la B porque..."
      • Ejemplo BUENO: "Considere qué ocurre cuando invierte el orden de las variables"
   
   🔹 EXPLANATION (Explicación - 80-150 palabras):
      • Lección magistral breve y profunda
      • Explica el PRINCIPIO UNIVERSAL que rige la respuesta
      • Desglosa por qué otras opciones son incorrectas
      • Conecta a conceptos superiores o aplicaciones reales
      • Deja al estudiante aprendiendo algo NEW, no solo repitiendo datos

   🔹 FORMATO DE CÓDIGO (OBLIGATORIO SI APLICA):
      • Si el concepto involucra programación, comandos, HTML, JSON o algoritmos, DEBES usar bloques de código Markdown (\`\`\`lenguaje ... \`\`\`).
      • Puedes insertar estos bloques en el "front", "back", "question", "options" o "explanation" según convenga.

═══════════════════════════════════════════════════════════════════════════════
FORMATOS DE RESPUESTA (JSON ESTRICTO - SIN TEXTO ADICIONAL):
═══════════════════════════════════════════════════════════════════════════════`;

  const formats = {
    flashcard: `
📌 FLASHCARD (Front/Back - Escenario/Solución):
[
  {
    "type": "flashcard",
    "data": {
      "front": "Escenario/Problema/Concepto complejo que requiera análisis profundo",
      "back": "Solución técnica precisa, paso a paso si es procedural"
    },
    "hint": "Empujón direccional sin revelar (15-20 palabras max)",
    "explanation": "Lección magistral breve explicando el principio y por qué funciona (80-150 palabras)"
  }
]`,

    multiple_choice: `
📌 OPCIÓN MÚLTIPLE (Evaluación cognitiva rigurosa):
[
  {
    "type": "multiple_choice",
    "data": {
      "question": "Pregunta de análisis/síntesis/evaluación (NO meta-datos)",
      "options": [
        "Opción A (error conceptual tipo 1)",
        "Opción B (error conceptual tipo 2)",
        "Opción C (CORRECTA - rigurosa)",
        "Opción D (error conceptual tipo 3)"
      ],
      "correctIndex": 2
    },
    "hint": "Considere cuál variable cambia cuando...",
    "explanation": "Explicación magistral de por qué C es correcta y por qué A, B, D fallan conceptualmente (80-150 palabras)"
  }
]`,

    boolean: `
📌 VERDADERO/FALSO (Afirmación técnica con trampa lógica):
[
  {
    "type": "boolean",
    "data": {
      "question": "Afirmación técnica que contenga sutil falacia o verdad fundamental para experto",
      "correctAnswer": true
    },
    "hint": "Pista sobre qué aspecto específico verificar",
    "explanation": "Desglose técnico de la lógica subyacente, aclarando ambigüedades comunes (80-150 palabras)"
  }
]`,

    mixed: `
📌 MEZCLA: 40% Opción Múltiple + 40% Flashcard + 20% V/F
Genera ${Math.floor(count * 0.4)} items tipo multiple_choice, ${Math.floor(count * 0.4)} flashcard, ${Math.floor(count * 0.2)} boolean
Responder SOLO el array JSON con todos los items mezclados.`
  };

  const modeInstructions = {
    flashcard: `Genera exactamente ${count} flashcards de tipo front/back.
Cada una debe ser un escenario o problema complejo que requiera ANÁLISIS.
${formats.flashcard}`,

    multiple_choice: `Genera exactamente ${count} preguntas de opción múltiple.
Todas deben ser de NIVEL COGNITIVO 4+ (Análisis/Síntesis/Evaluación).
Cada opción incorrecta debe ser un error conceptual REAL de la disciplina${discipline ? ` (${discipline})` : ''}.
${formats.multiple_choice}`,

    boolean: `Genera exactamente ${count} afirmaciones verdadero/falso.
Incluir afirmaciones que contengan SUTILES FALACIAS para detectar comprensión real.
${formats.boolean}`,

    mixed: `${formats.mixed}`
  };

  return `${baseInstructions}

${modeInstructions[mode] || modeInstructions.flashcard}

═══════════════════════════════════════════════════════════════════════════════
INSTRUCCIÓN FINAL:
═══════════════════════════════════════════════════════════════════════════════
Responde ÚNICAMENTE el array JSON válido. CERO texto adicional. CERO explicaciones fuera del JSON.
El JSON debe ser parseabale directamente. Si generas markdown o explicaciones, FALLARÁS.
Asegura que CADA item tenga "type", "data", "hint", y "explanation" completos.`;
}

/**
 * Variante especializada para MATEMÁTICA/CÁLCULO/ÁLGEBRA
 */
function buildMathPrompt(mode, count, difficulty = 'posgrado') {
  const base = buildSystemPrompt(mode, count, 'Matemática', difficulty);
  
  const mathExtra = `

═══════════════════════════════════════════════════════════════════════════════
ESPECIFICACIONES PARA MATEMÁTICA:
═══════════════════════════════════════════════════════════════════════════════

🔢 DISTRACTORES TÍPICOS EN MATEMÁTICA:
   • Error de signo (±)
   • Confundir operación inversa
   • Aplicación incompleta de regla
   • Confundir método A vs método B que lleva resultado diferente
   • Olvidar restricción de dominio

📐 ESTRUCTURA DE PROBLEMAS:
   • NO: "¿Cuál es 2+2?" 
   • SÍ: "Si X satisface [ecuación], y Y se define como [relación], entonces ¿cuál es [expresión compleja]?"

✅ MOSTRAR PROCEDIMIENTO:
   En flashcards, mostrar paso a paso. En múltiple choice, preguntar sobre paso intermedio específico.`;

  return base + mathExtra;
}

/**
 * Variante para IDIOMAS (English, Español, etc.)
 */
function buildLanguagePrompt(mode, count, language = 'English', difficulty = 'posgrado') {
  const base = buildSystemPrompt(mode, count, `${language} Language`, difficulty);
  
  const langExtra = `

═══════════════════════════════════════════════════════════════════════════════
ESPECIFICACIONES PARA IDIOMAS (${language}):
═══════════════════════════════════════════════════════════════════════════════

🎓 ENFOQUE EN COMPETENCIA COMUNICATIVA:
   • NO: "¿Cómo se escribe...?" (trivial)
   • SÍ: "En el contexto de [situación formal/informal], ¿cuál expresión es más apropiada y por qué?"

🔤 NIVELES DE COMPLEJIDAD:
   • Nivel 1 (Memoria): Vocabulario específico, reglas gramaticales básicas
   • Nivel 2 (Comprensión): Conectar formas con significados
   • Nivel 3-6 (Análisis+): Aplicación en contextos auténticos, diferencias sutiles, variación dialecto

💬 TIPOS DE PREGUNTAS:
   • Ejercicios de completación con opciones múltiples (error gramatical común)
   • Escenarios de conversación: "¿Qué respuesta es más natural?"
   • Análisis de matiz: "¿Cuál es la DIFERENCIA entre expresión A y B?"
   • Corrección de errores: "Identifique y explique el error"

⚠️  EVITAR TRIVIALIDADES:
   ❌ "¿Cómo se dice 'gato'?"
   ✅ "En inglés formal de negocios, ¿cómo se expresaría [idea compleja]?"`;

  return base + langExtra;
}

/**
 * Variante para CIENCIAS (Biología, Química, Física)
 */
function buildSciencePrompt(mode, count, science = 'Biology', difficulty = 'posgrado') {
  const base = buildSystemPrompt(mode, count, science, difficulty);
  
  const scienceExtra = `

═══════════════════════════════════════════════════════════════════════════════
ESPECIFICACIONES PARA CIENCIAS (${science}):
═══════════════════════════════════════════════════════════════════════════════

🔬 ÉNFASIS EN MECANISMOS Y PRINCIPIOS:
   • NO: "¿Cuál es la función del ARN?"
   • SÍ: "Explique por qué la modificación de esta base nitrogenada afectaría específicamente la síntesis proteica"

⚗️  DISTRACTORES CIENTÍFICOS TÍPICOS:
   • Confundir correlación con causalidad
   • Aplicar principio a contexto incorrecto
   • Olvidar restricción experimental
   • Mezclar mecanismo A con mecanismo B similar
   • Error en la dirección del proceso

📊 ESTRUCTURA DE ANÁLISIS:
   • Preguntas sobre predicción: "¿Qué ocurriría si..."
   • Problemas de diseño experimental: "¿Cuál variable cambiaría y por qué?"
   • Análisis de datos: "Interprete esta gráfica en el contexto de..."
   • Conexión entre conceptos: "¿Cómo se relacionan A y B?"`;

  return base + scienceExtra;
}

/**
 * Auto-detecta disciplina del contexto y aplica plantilla especializada
 */
function buildAdaptivePrompt(mode, count, contextText, difficulty = 'posgrado') {
  // Palabras clave para detectar disciplina
  const keywords = {
    math: /(?:ecuación|función|derivada|integral|matriz|polinomio|límite|variable)/i,
    english: /(?:grammar|tense|phrasal verb|pronunciation|vocabulary|idiom)/i,
    spanish: /(?:conjugación|pretérito|subjuntivo|preposición|ortografía|acentuación)/i,
    science: /(?:molécula|reacción|célula|gen|fuerza|energía|onda|partícula)/i,
  };

  let discipline = 'General';
  let promptBuilder = buildSystemPrompt;

  for (const [key, regex] of Object.entries(keywords)) {
    if (regex.test(contextText)) {
      if (key === 'math') {
        discipline = 'Matemática';
        promptBuilder = (m, c) => buildMathPrompt(m, c, difficulty);
      } else if (key === 'english') {
        discipline = 'English';
        promptBuilder = (m, c) => buildLanguagePrompt(m, c, 'English', difficulty);
      } else if (key === 'spanish') {
        discipline = 'Español';
        promptBuilder = (m, c) => buildLanguagePrompt(m, c, 'Español', difficulty);
      } else if (key === 'science') {
        discipline = 'Ciencias Naturales';
        promptBuilder = (m, c) => buildSciencePrompt(m, c, 'Sciences', difficulty);
      }
      break;
    }
  }

  console.log(`[AcademicPromptBuilder] Disciplina detectada: ${discipline}`);
  return promptBuilder(mode, count);
}

/**
 * Versión simplificada para Groq (menor complejidad, más rápido)
 * Mantiene Bloom's Taxonomy pero con estructura más simple
 */
function buildGroqPrompt(mode, count, discipline = '', difficulty = 'posgrado') {
  return `Eres un pedagogo experto. Tu tarea es generar exactamente ${count} ítems de evaluación académica de calidad.

CRITERIOS OBLIGATORIOS:
1. CERO preguntas sobre metadatos (títulos, capítulos, sesiones)
2. Enfócate en la SUSTANCIA del contenido, no en la forma
3. Nivel cognitivo: Mayoría de preguntas de Análisis/Síntesis (no solo memoria)
4. Para MC: distractores son errores conceptuales REALES, no obvios
5. Responde SOLO JSON válido, SIN texto adicional

COMPONENETES REQUERIDOS:
- type: "${mode}"
- data: objeto con contenido (question/options/correctIndex, front/back, etc)
- hint: pista directiva (15 palabras max)
- explanation: por qué funciona (50-80 palabras)

FORMATO DE CÓDIGO (SI APLICA A PROGRAMACIÓN):
- USA SIEMPRE bloques de código Markdown (\`\`\`lenguaje ... \`\`\`) para cualquier fragmento de código.
- Aplícalo en el front, back, options o explanation cuando sea necesario.

DISTRIBUCIÓN COGNITIVA:
- 10% Memoria (definiciones básicas)
- 20% Comprensión (explicaciones)
- 30% Aplicación (resolver casos)
- 25% Análisis (comparar, diferenciar)
- 15% Síntesis (integrar, crear)

Formato: Array JSON con todos los ítems
Ejemplo:
[
  {"type":"flashcard","data":{"front":"Pregunta compleja","back":"Respuesta técnica"},"hint":"Considera X","explanation":"La respuesta es Y porque..."},
  {"type":"multiple_choice","data":{"question":"Pregunta de análisis","options":["Error tipo 1","Error tipo 2","CORRECTA","Error tipo 3"],"correctIndex":2},"hint":"Pista","explanation":"Explicación"}
]

Genera los ${count} ítems ahora:`;
}

module.exports = {
  buildSystemPrompt,
  buildMathPrompt,
  buildLanguagePrompt,
  buildSciencePrompt,
  buildAdaptivePrompt,
  buildGroqPrompt,
};

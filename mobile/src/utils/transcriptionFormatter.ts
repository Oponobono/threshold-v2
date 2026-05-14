/**
 * transcriptionFormatter.ts
 *
 * Procesa transcripciones raw de Whisper para mejorar significativamente su presentación.
 * Convierte el "spaghetti text" en contenido estructurado, legible y profesional.
 *
 * Estrategias aplicadas:
 * 1. Saltos de línea en puntuaciones (punto aparte)
 * 2. Detecta temas y agrega títulos (### Tema)
 * 3. Resalta términos académicos clave en negrita
 * 4. Convierte listas en viñetas o numeradas
 * 5. Mejora puntuación y espaciado
 * 6. Elimina rellenos ("um", "uh", "bueno", etc.)
 */

// Palabras de relleno comunes en transcripciones habladas
const FILLER_WORDS = [
  'um', 'uh', 'eeh', 'aah', 'mmm', 'bueno', 'pues', 'vamos', 'eh', 
  'erm', 'uhh', 'like', 'you know', 'actually', 'basically',
  'verdad', 'no cierto', 'o sea', 'a ver'
]

// Palabras que indican cambio de tema o nueva sección
const TOPIC_MARKERS = [
  'ahora hablaremos de',
  'vamos a ver',
  'el siguiente tema',
  'en primer lugar',
  'en segundo lugar',
  'en tercer lugar',
  'por un lado',
  'por otro lado',
  'además',
  'sin embargo',
  'no obstante',
  'en conclusión',
  'para resumir',
  'en resumen',
  'finalmente',
  'a continuación',
  'seguidamente',
  'pasando a',
  'hablemos de',
  'respecto a',
]

// Términos académicos que deben resaltarse
const ACADEMIC_TERMS = [
  'teorema', 'definición', 'principio', 'ley', 'fórmula', 'ecuación',
  'concepto', 'conclusión', 'hipótesis', 'variable', 'parámetro',
  'análisis', 'síntesis', 'relación', 'proceso', 'método', 'sistema',
  'función', 'estructura', 'propiedad', 'característica', 'ejemplo',
  'aplicación', 'implicación', 'resultado', 'causa', 'efecto',
  'teoría', 'demostración', 'algoritmo', 'modelo', 'patrón'
]

/**
 * Formatea una transcripción raw de forma profesional y legible
 * @param text - Texto raw de la transcripción
 * @returns Texto formateado en Markdown con estructura, énfasis y legibilidad
 */
export function formatTranscription(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let formatted = text.trim();

  // 1. Limpiar rellenos de lenguaje hablado
  formatted = cleanFillerWords(formatted);

  // 2. Normalizar espaciado básico
  formatted = formatted.replace(/\s+/g, ' ').trim();

  // 3. Agregar saltos de línea en puntuaciones (párrafo aparte)
  // Punto/exclamación/interrogación seguido de mayúscula = nuevo párrafo
  formatted = formatted.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n\n');

  // 4. Detectar y separar cambios de tema con títulos (### Tema)
  formatted = separateTopics(formatted);

  // 5. Convertir listas numeradas y ordinales a viñetas
  formatted = convertToLists(formatted);

  // 6. Resaltar términos académicos clave EN NEGRITA
  formatted = highlightKeyTerms(formatted);

  // 7. Agrupar párrafos de forma lógica (combina cortos, mantiene estructura)
  formatted = groupParagraphs(formatted);

  // 8. Limpiar espacios finales y extra
  formatted = formatted
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  return formatted;
}

/**
 * Elimina palabras de relleno comunes en transcripciones habladas
 */
function cleanFillerWords(text: string): string {
  let result = text;

  for (const filler of FILLER_WORDS) {
    // Palabra completa rodeada de espacios o puntuación, case-insensitive
    const regex = new RegExp(`\\s+${filler}\\s+`, 'gi');
    result = result.replace(regex, ' ');
  }

  // También al inicio
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`^${filler}\\s+`, 'gi');
    result = result.replace(regex, '');
  }

  // Eliminar espacios múltiples resultantes
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Detecta transiciones de tema y las convierte en títulos (### Tema)
 */
function separateTopics(text: string): string {
  let result = text;

  for (const marker of TOPIC_MARKERS) {
    // Buscar la frase marcadora con límites de palabra
    // Captura: (inicio de línea o punto previo) + marcador + (lo que sigue)
    const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\n\\n)?\\b${escapedMarker}\\b\\s*`, 'gi');
    
    result = result.replace(regex, (match) => {
      const markerTitle = marker
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `\n\n### ${markerTitle}\n\n`;
    });
  }

  return result;
}

/**
 * Resalta términos académicos clave en NEGRITA
 * Solo si no están ya dentro de otra estructura Markdown
 */
function highlightKeyTerms(text: string): string {
  let result = text;

  for (const term of ACADEMIC_TERMS) {
    // Buscar palabra completa (con o sin 's' plural), case-insensitive
    // Evitar reemplazar si ya tiene ** alrededor
    const regex = new RegExp(`\\b(${term}s?)\\b`, 'gi');
    
    result = result.replace(regex, (match, word) => {
      // Verificar si ya está en negrita buscando ** antes/después en contexto
      // Si el match está rodeado de **, no hacer nada
      const startIndex = result.indexOf(match);
      if (startIndex > 0 && startIndex < result.length) {
        const before = result.substring(Math.max(0, startIndex - 2), startIndex);
        const after = result.substring(startIndex + match.length, startIndex + match.length + 2);
        
        if (before.includes('*') && after.includes('*')) {
          return match; // Ya está en negrita
        }
      }
      
      return `**${match}**`;
    });
  }

  return result;
}

/**
 * Convierte listas numeradas y con ordinales a viñetas Markdown
 */
function convertToLists(text: string): string {
  let result = text;

  // 1. Detectar listas numeradas: "1. item" "2. item"
  // Convertir a viñetas con •
  result = result.replace(/(\n|^)\s*(\d+)[\.\)]\s+/g, '\n• ');

  // 2. Detectar ordinales: "primero", "segundo", etc. al inicio de párrafo
  const ordinalMap: { [key: string]: string } = {
    'primero': '• Primero',
    'segundo': '• Segundo',
    'tercero': '• Tercero',
    'cuarto': '• Cuarto',
    'quinto': '• Quinto',
    'sexto': '• Sexto',
    'séptimo': '• Séptimo',
    'octavo': '• Octavo',
  };

  for (const [ordinal, replacement] of Object.entries(ordinalMap)) {
    // Buscar al inicio de línea
    const regex = new RegExp(`(^|\\n)${ordinal}[,:\\s]+`, 'gi');
    result = result.replace(regex, `$1${replacement}: `);
  }

  return result;
}

/**
 * Agrupa párrafos de forma lógica
 * Combina párrafos muy cortos con contenido relacionado
 * Mantiene títulos y listas en sus propias líneas
 */
function groupParagraphs(text: string): string {
  const lines = text.split('\n');
  const grouped: string[] = [];
  let currentParagraph = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Líneas vacías, títulos, viñetas = siempre con salto de línea
    if (!line || line.startsWith('###') || line.startsWith('•')) {
      if (currentParagraph.trim()) {
        grouped.push(currentParagraph.trim());
        currentParagraph = '';
      }
      if (line) {
        grouped.push(line);
      }
    } else {
      // Texto regular: agrupar en párrafos coherentes
      currentParagraph += (currentParagraph ? ' ' : '') + line;

      // Si el párrafo acumulado es largo o llegamos al final, guardar
      if (currentParagraph.length > 150 || i === lines.length - 1) {
        grouped.push(currentParagraph.trim());
        currentParagraph = '';
      }
    }
  }

  return grouped
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
}



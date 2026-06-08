/**
 * geminiHelpers.ts
 *
 * Utilidades para interactuar con la API de Google Gemini.
 * Proporciona funciones compatibles con la interfaz de groqHelpers
 * pero usa Gemini para mayor capacidad de procesamiento.
 */


/**
 * Transcribe un archivo de audio usando Google Gemini (mediante el backend).
 * En esta implementación, delegamos al backend para manejar la autenticación.
 * @param audioUri - Ruta local al archivo de audio
 * @param apiKey - No se usa directamente (se maneja en backend)
 * @returns El texto transcrito
 */
export async function transcribeWithGemini(audioUri: string, apiKey: string): Promise<string> {
  // Esta función delega al backend
  // El backend manejará la autenticación con Gemini
  throw new Error('Transcripción con Gemini debe ser manejada por el backend');
}

/**
 * Genera un resumen académico estructurado usando Google Gemini.
 * @param transcription - Texto plano a resumir
 * @param apiKey - No se usa directamente (se maneja en backend)
 * @returns El resumen en formato Markdown
 */
export async function summarizeWithGemini(transcription: string, apiKey: string): Promise<string> {
  // Esta función delega al backend para manejar Gemini
  throw new Error('Resumen con Gemini debe ser manejado por el backend');
}

/**
 * Helper para enviar contenido a Gemini a través del backend.
 * Usado internamente por otros servicios.
 */
export async function sendToGeminiBackend(
  content: string,
  systemPrompt: string,
  apiKey?: string
): Promise<string> {
  // Este es un placeholder. El backend manejará las llamadas a Gemini
  throw new Error('Comunícate con el backend usando el servicio de API');
}

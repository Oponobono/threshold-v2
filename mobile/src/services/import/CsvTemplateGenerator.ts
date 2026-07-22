export class CsvTemplateGenerator {
  /**
   * Genera el contenido CSV de la plantilla.
   * Incluye los metadatos de versión y compatibilidad, seguidos por la cabecera.
   *
   * @param language 'es' o 'en' para definir el idioma de los metadatos
   * @param delimiter ',' por defecto, puede ser ';' para Excel en ciertas regiones
   */
  public static generateTemplate(language: 'es' | 'en' = 'es', delimiter: string = ','): string {
    const timestamp = new Date().toISOString();

    const metadata = [
      '# Threshold Academic Import',
      '# Version: 1',
      `# Locale: ${language}`,
      `# GeneratedAt: ${timestamp}`,
      '#'
    ].join('\n');

    let headers: string[];
    let instructions: string;

    if (language === 'es') {
      instructions = [
        '# No elimine la fila de cabeceras.',
        '# Las columnas Curso, Materia y Evaluación son obligatorias.',
        '# Peso, Nota, Nota Máxima, Créditos y Fecha son opcionales.',
        '# El formato de fecha es YYYY-MM-DD.',
        `# Ejemplo: 2026-I${delimiter}Álgebra Lineal${delimiter}Parcial 1${delimiter}25${delimiter}4.5${delimiter}5${delimiter}4${delimiter}2026-03-15`
      ].join('\n');
      
      headers = [
        'Curso',
        'Materia',
        'Evaluación',
        'Peso (%)',
        'Nota Obtenida',
        'Nota Máxima',
        'Créditos',
        'Fecha (YYYY-MM-DD)',
      ];
    } else {
      instructions = [
        '# Do not delete the header row.',
        '# The columns Course, Subject, and Assessment are mandatory.',
        '# Weight, Score, Out Of, Credits, and Date are optional.',
        '# The date format is YYYY-MM-DD.',
        `# Example: 2026-Fall${delimiter}Linear Algebra${delimiter}Midterm 1${delimiter}25${delimiter}90${delimiter}100${delimiter}4${delimiter}2026-03-15`
      ].join('\n');

      headers = [
        'Course',
        'Subject',
        'Assessment',
        'Weight (%)',
        'Score',
        'Out Of',
        'Credits',
        'Date (YYYY-MM-DD)',
      ];
    }

    const headerLine = headers.join(delimiter);

    // Se agrega el BOM (\uFEFF) para forzar UTF-8 en Excel (Windows)
    return `\uFEFF${metadata}\n${instructions}\n${headerLine}\n`;
  }
}

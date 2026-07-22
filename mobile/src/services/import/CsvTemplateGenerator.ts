export class CsvTemplateGenerator {
  /**
   * Genera el contenido CSV de la plantilla.
   * Incluye los metadatos de versión y compatibilidad, seguidos por la cabecera.
   *
   * CSV Contract v1 — Columnas en orden canónico:
   * [Course] Curso, Plataforma, Instructor, URL del Curso, Horas Totales
   * [Subject] Materia, Código, Profesor, Créditos, Nota Mínima
   * [Assessment] Evaluación, Peso (%), Nota Obtenida, Nota Máxima, Fecha
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
      const example = [
        'Administración de Empresas', 'Udemy', 'Juan García',
        'https://udemy.com/course/ejemplo', '40',
        'Álgebra Lineal', 'MAT101', 'Prof. López', '4', '3.5',
        'Parcial 1', '25', '4.5', '5', '2026-03-15'
      ].join(delimiter);

      instructions = [
        '# No elimine la fila de cabeceras.',
        '# Obligatorios: Curso, Materia, Evaluación.',
        '# Opcionales del Curso: Plataforma, Instructor, URL del Curso, Horas Totales.',
        '# Opcionales de la Materia: Código, Profesor, Créditos, Nota Mínima.',
        '# Opcionales de la Evaluación: Peso (%), Nota Obtenida, Nota Máxima, Fecha.',
        '# El formato de fecha es YYYY-MM-DD.',
        `# Ejemplo: ${example}`
      ].join('\n');

      headers = [
        // Course
        'Curso',
        'Plataforma',
        'Instructor',
        'URL del Curso',
        'Horas Totales',
        // Subject
        'Materia',
        'Código',
        'Profesor',
        'Créditos',
        'Nota Mínima',
        // Assessment
        'Evaluación',
        'Peso (%)',
        'Nota Obtenida',
        'Nota Máxima',
        'Fecha (YYYY-MM-DD)',
      ];
    } else {
      const example = [
        'Computer Science', 'Udemy', 'John Doe',
        'https://udemy.com/course/example', '40',
        'Linear Algebra', 'MAT101', 'Prof. Smith', '4', '3.5',
        'Midterm 1', '25', '90', '100', '2026-03-15'
      ].join(delimiter);

      instructions = [
        '# Do not delete the header row.',
        '# Required: Course, Subject, Assessment.',
        '# Optional (Course): Platform, Instructor, Course URL, Total Hours.',
        '# Optional (Subject): Code, Professor, Credits, Minimum Grade.',
        '# Optional (Assessment): Weight (%), Score, Out Of, Date.',
        '# The date format is YYYY-MM-DD.',
        `# Example: ${example}`
      ].join('\n');

      headers = [
        // Course
        'Course',
        'Platform',
        'Instructor',
        'Course URL',
        'Total Hours',
        // Subject
        'Subject',
        'Code',
        'Professor',
        'Credits',
        'Minimum Grade',
        // Assessment
        'Assessment',
        'Weight (%)',
        'Score',
        'Out Of',
        'Date (YYYY-MM-DD)',
      ];
    }

    const headerLine = headers.join(delimiter);

    // Se agrega el BOM (\uFEFF) para forzar UTF-8 en Excel (Windows)
    return `\uFEFF${metadata}\n${instructions}\n${headerLine}\n`;
  }
}

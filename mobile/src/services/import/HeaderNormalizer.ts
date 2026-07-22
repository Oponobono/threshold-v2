export class HeaderNormalizer {
  private static readonly DICTIONARY: Record<string, string> = {
    // Curso / Course
    curso: 'courseName',
    course: 'courseName',
    periodo: 'courseName',
    semestre: 'courseName',
    semester: 'courseName',
    term: 'courseName',

    // Materia / Subject
    materia: 'subjectName',
    subject: 'subjectName',
    asignatura: 'subjectName',
    clase: 'subjectName',
    class: 'subjectName',
    cursooasignatura: 'subjectName',

    // Assessment / Evaluación
    evaluacion: 'assessmentName',
    assessment: 'assessmentName',
    nombredeevaluacion: 'assessmentName',
    assessmentname: 'assessmentName',
    tarea: 'assessmentName',
    examen: 'assessmentName',
    actividad: 'assessmentName',
    task: 'assessmentName',
    exam: 'assessmentName',
    item: 'assessmentName',

    // Peso / Weight
    peso: 'weight',
    weight: 'weight',
    porcentaje: 'weight',
    percentage: 'weight',

    // Nota / Score
    nota: 'score',
    score: 'score',
    calificacion: 'score',
    grade: 'score',
    notaobtenida: 'score',
    puntuacion: 'score',

    // Nota Máxima / Out of
    notamaxima: 'outOf',
    outof: 'outOf',
    base: 'outOf',
    maxscore: 'outOf',
    notabase: 'outOf',

    // Créditos / Credits
    creditos: 'credits',
    credits: 'credits',

    // Fecha / Date
    fecha: 'date',
    date: 'date',
  };

  /**
   * Normaliza una cabecera quitando espacios, tildes, símbolos y pasándola a minúsculas.
   */
  public static normalizeHeader(rawHeader: string): string {
    return rawHeader
      .toLowerCase()
      .normalize('NFD') // Descompone caracteres con tildes (ej: á -> a + ´)
      .replace(/[\u0300-\u036f]/g, '') // Elimina las tildes
      .replace(/[^a-z0-9]/g, ''); // Elimina espacios y símbolos, dejando solo alfanuméricos
  }

  /**
   * Mapea una cabecera normalizada a la clave del dominio (AcademicImportRow).
   */
  public static mapToDomainKey(rawHeader: string): string | null {
    const normalized = this.normalizeHeader(rawHeader);
    return this.DICTIONARY[normalized] || null;
  }
}

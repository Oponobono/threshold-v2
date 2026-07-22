import { HeaderNormalizer } from './HeaderNormalizer';
import { AcademicImportModel, AcademicImportRow, ImportCourseRow, ImportErrorCode } from './types';
import { CsvImportError } from './CsvImportError';

export class CsvImporter {
  /**
   * Parsea un archivo CSV en texto plano y lo convierte en un AcademicImportModel.
   *
   * @param csvText Contenido del archivo CSV
   * @param delimiter Delimitador a usar (por defecto ',')
   */
  public static parse(csvText: string, delimiter: string = ','): AcademicImportModel {
    const lines = csvText.split(/\r?\n/);
    const dataLines: string[] = [];

    // 1. Filtrar metadatos y líneas vacías
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue; // Ignorar comentarios o líneas vacías
      }
      dataLines.push(trimmed);
    }

    if (dataLines.length === 0) {
      throw new CsvImportError(ImportErrorCode.InvalidCsv, 'El archivo CSV está vacío o solo contiene comentarios.');
    }

    // 2. Procesar cabeceras
    const headerLine = dataLines[0];
    const rawHeaders = this.splitCsvLine(headerLine, delimiter);
    const headerMap = new Map<number, keyof AcademicImportRow>();

    for (let i = 0; i < rawHeaders.length; i++) {
      const domainKey = HeaderNormalizer.mapToDomainKey(rawHeaders[i]);
      if (domainKey) {
        headerMap.set(i, domainKey as keyof AcademicImportRow);
      }
    }

    if (headerMap.size === 0) {
      throw new CsvImportError(ImportErrorCode.MissingHeader, 'No se encontraron columnas válidas en la cabecera del CSV.');
    }

    // 3. Procesar filas de datos
    const rows: AcademicImportRow[] = [];
    const courseSet = new Set<string>();
    const subjectSet = new Set<string>();

    for (let i = 1; i < dataLines.length; i++) {
      const values = this.splitCsvLine(dataLines[i], delimiter);
      if (values.length < headerMap.size && values.every((v) => !v.trim())) {
        continue; // Ignorar fila completamente vacía
      }

      const row: Partial<AcademicImportRow> = {};

      for (const [colIndex, domainKey] of headerMap.entries()) {
        const rawValue = values[colIndex]?.trim() || '';

        switch (domainKey) {
          case 'weight':
          case 'score':
          case 'outOf':
          case 'subjectCredits':
          case 'subjectTargetGrade':
          case 'courseTotalHours':
            row[domainKey] = rawValue ? this.parseNumber(rawValue) : undefined;
            break;
          default:
            row[domainKey] = rawValue as any;
            break;
        }
      }

      // Validar datos mínimos (Curso, Materia, Assessment)
      if (!row.courseName || !row.subjectName || !row.assessmentName) {
        continue; // Ignorar si falta info clave
      }

      // Por defecto outOf es 100 si hay score y no se especificó outOf
      if (row.score !== undefined && row.outOf === undefined) {
        row.outOf = 100;
      }

      // Save row index for metadata
      (row as any)._originalRowIndex = i + 1;

      rows.push(row as AcademicImportRow);
    }

    // 4. Build hierarchical model
    const coursesMap = new Map<string, ImportCourseRow>();

    for (const r of rows) {
      const courseName = r.courseName.trim();
      const subjectName = r.subjectName.trim();

      let course = coursesMap.get(courseName);
      if (!course) {
        course = {
          name: courseName,
          platform: r.coursePlatform?.trim() || undefined,
          instructor: r.courseInstructor?.trim() || undefined,
          mainUrl: r.courseUrl?.trim() || undefined,
          totalHours: r.courseTotalHours,
          subjects: []
        };
        coursesMap.set(courseName, course);
      }

      let subject = course.subjects.find((s) => s.name === subjectName);
      if (!subject) {
        subject = {
          name: subjectName,
          code: r.subjectCode?.trim() || undefined,
          professor: r.subjectProfessor?.trim() || undefined,
          credits: r.subjectCredits,
          targetGrade: r.subjectTargetGrade,
          assessments: []
        };
        course.subjects.push(subject);
      }

      subject.assessments.push({
        name: r.assessmentName.trim(),
        weight: r.weight,
        score: r.score,
        outOf: r.outOf,
        date: r.date,
        _originalRowIndex: (r as any)._originalRowIndex,
      });
    }

    return {
      importId: Date.now().toString(),
      metadata: {
        format: 'Threshold Academic Import',
        version: 1,
        locale: 'es',
        generatedAt: new Date().toISOString(),
      },
      courses: Array.from(coursesMap.values()),
    };
  }

  /**
   * Divide una línea CSV respetando valores entre comillas dobles.
   */
  private static splitCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private static parseNumber(val: string): number {
    // Reemplazar coma por punto por si viene un CSV europeo
    const parsed = parseFloat(val.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }


  // Hash simple (Cyrb53)
  private static cyrb53(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
}

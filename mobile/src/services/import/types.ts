export interface ImportAssessmentRow {
  name: string;
  weight?: number;
  score?: number;
  outOf?: number;
  date?: string;
  // internal metadata for error reporting
  _originalRowIndex?: number;
}

export interface ImportSubjectRow {
  name: string;
  credits?: number;
  assessments: ImportAssessmentRow[];
}

export interface ImportCourseRow {
  name: string;
  subjects: ImportSubjectRow[];
}

export interface AcademicImportModel {
  importId: string;
  metadata: {
    format: string;
    version: number;
    locale: string;
    generatedAt?: string;
  };
  courses: ImportCourseRow[];
}

// Interfaz original plana usada solo temporalmente durante el parsing
export interface AcademicImportRow {
  courseName: string;
  subjectName: string;
  assessmentName: string;
  weight: number;
  score: number;
  outOf: number;
  credits?: number;
  date?: string;
}

export enum ImportErrorCode {
  MissingHeader = 'MissingHeader',
  InvalidWeight = 'InvalidWeight',
  InvalidScore = 'InvalidScore',
  DuplicateAssessment = 'DuplicateAssessment',
  EmptyCourse = 'EmptyCourse',
  EmptySubject = 'EmptySubject',
  EmptyAssessment = 'EmptyAssessment',
  InvalidCsv = 'InvalidCsv',
  InvalidEncoding = 'InvalidEncoding',
  ScoreExceedsMax = 'ScoreExceedsMax',
  InvalidMaxScore = 'InvalidMaxScore',
}

export interface ImportWarning {
  code: ImportErrorCode;
  row: number;
  message: string;
}

export interface ImportError {
  code: ImportErrorCode;
  row: number;
  message: string;
}

export interface AcademicImportPreview {
  model: AcademicImportModel;
  statistics: {
    totalCourses: number;
    totalSubjects: number;
    totalAssessments: number;
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
  };
  warnings: ImportWarning[];
  errors: ImportError[];
}

export interface AcademicImportResult {
  importId: string;
  success: boolean;
  durationMs: number;
  coursesCreated: number;
  subjectsCreated: number;
  assessmentsCreated: number;
}

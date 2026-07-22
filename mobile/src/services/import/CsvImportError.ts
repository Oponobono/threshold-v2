import { ImportErrorCode } from './types';

export class CsvImportError extends Error {
  public code: ImportErrorCode;

  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'CsvImportError';
    this.code = code;
    Object.setPrototypeOf(this, CsvImportError.prototype);
  }
}

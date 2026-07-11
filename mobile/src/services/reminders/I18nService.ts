export interface I18nService {
  translate(key: string, params?: Record<string, any>): string;
}

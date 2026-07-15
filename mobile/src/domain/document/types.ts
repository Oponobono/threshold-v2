export type TextBlockRole = 'heading' | 'subheading' | 'paragraph';

export interface TextBlock {
  readonly content: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly confidence?: number;
  readonly role?: TextBlockRole;
}

export interface ImageBlock {
  readonly id: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly description?: string;
}

export interface TableBlock {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface SourceMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly createdAt?: Date;
  readonly pageCount?: number;
  readonly wordCount?: number;
  readonly format: string;
}

import type { ContentType } from '../../../types/content';

const CONTENT_ICONS: Record<ContentType, string> = {
  class: 'play-circle',
  lesson: 'book-open',
  quiz: 'help-circle',
  flashcard: 'layers',
  document: 'file-text',
  pdf: 'file',
  youtube: 'youtube',
  markdown: 'file-text',
  deck: 'grid',
  note: 'edit-3',
  exam: 'award',
  assignment: 'clipboard',
  project: 'briefcase',
};

export class ContentTypeMapper {
  static toIcon(type: ContentType): string {
    return CONTENT_ICONS[type];
  }
}

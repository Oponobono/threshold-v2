import { Photo } from '../services/api/types';

export interface GalleryPhoto extends Photo {
  subject_name?: string;
  subject_color?: string;
}

export type FilterTab = 'all' | 'starred' | 'ocr';

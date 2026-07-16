export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

export const HIGHLIGHT_COLORS: readonly { color: HighlightColor; label: string; hex: string }[] = [
  { color: 'yellow', label: 'Amarillo', hex: 'rgba(255, 220, 0, 0.45)' },
  { color: 'green', label: 'Verde', hex: 'rgba(0, 200, 83, 0.35)' },
  { color: 'blue', label: 'Azul', hex: 'rgba(33, 150, 243, 0.35)' },
  { color: 'pink', label: 'Rosa', hex: 'rgba(233, 30, 99, 0.30)' },
  { color: 'orange', label: 'Naranja', hex: 'rgba(255, 152, 0, 0.40)' },
] as const;

export interface DocumentHighlight {
  readonly id: string;
  readonly documentId: string;
  readonly pageIndex: number;
  readonly text: string;
  readonly color: HighlightColor;
  readonly anchorOffset: number;
  readonly focusOffset: number;
  readonly createdAt: Date;
}

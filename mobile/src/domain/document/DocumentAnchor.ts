/**
 * Document Domain v2.0 — Anchor Contracts
 * 
 * Defines the structural bridge between the Document Domain and external domains.
 * The Document Domain does NOT know what a Flashcard, Summary, or Quiz is.
 * It only maintains logical coordinates (DocumentLocation) and opaque pointers (ArtifactReference).
 */

export type ArtifactType =
  | 'flashcard'
  | 'flashcard_set'
  | 'summary'
  | 'quiz'
  | 'mind_map'
  | 'podcast';

/**
 * An opaque reference to an entity belonging to another domain.
 */
export interface ArtifactReference {
  readonly targetType: ArtifactType;
  readonly targetId: string;   // The UUID of the external entity
}

/**
 * A format-agnostic logical pointer to a specific text span or block in the document.
 */
export interface DocumentLocation {
  readonly pageIndex: number;
  readonly blockId: string;
  readonly charStart?: number;
  readonly charEnd?: number;
}

/**
 * The official mechanism for relating a document coordinate to an external knowledge artifact.
 */
export interface DocumentAnchor {
  readonly id: string;
  readonly documentId: string;
  readonly location: DocumentLocation;
  readonly target: ArtifactReference;
  readonly metadata?: Record<string, unknown>; // Extensibility for selection styling, etc.
}

import type { DocumentSelection } from '../../domain/document/DocumentSelection';

export interface ShareTextUseCase {
  execute(selection: DocumentSelection, title?: string): Promise<boolean>;
}

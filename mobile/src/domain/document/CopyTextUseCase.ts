import type { DocumentSelection } from '../../domain/document/DocumentSelection';

export interface CopyTextUseCase {
  execute(selection: DocumentSelection): Promise<boolean>;
}

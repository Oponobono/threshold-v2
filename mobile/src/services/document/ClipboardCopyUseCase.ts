import * as Clipboard from 'expo-clipboard';
import type { DocumentSelection } from '../../domain/document/DocumentSelection';
import type { CopyTextUseCase } from '../../domain/document/CopyTextUseCase';

export class ClipboardCopyUseCase implements CopyTextUseCase {
  async execute(selection: DocumentSelection): Promise<boolean> {
    const text = selection.content.text;
    if (!text) return false;

    await Clipboard.setStringAsync(text);
    return true;
  }
}

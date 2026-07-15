import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { DocumentSelection } from '../../domain/document/DocumentSelection';
import type { ShareTextUseCase } from '../../domain/document/ShareTextUseCase';

export class SharingTextUseCase implements ShareTextUseCase {
  async execute(selection: DocumentSelection, title?: string): Promise<boolean> {
    const text = selection.content.text;
    if (!text) return false;

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) return false;

    const tempUri = `${FileSystem.cacheDirectory}share_${Date.now()}.txt`;
    await FileSystem.writeAsStringAsync(tempUri, text, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    try {
      await Sharing.shareAsync(tempUri, {
        mimeType: 'text/plain',
        dialogTitle: title || 'Compartir texto',
      });
      return true;
    } finally {
      try {
        await FileSystem.deleteAsync(tempUri);
      } catch {}
    }
  }
}

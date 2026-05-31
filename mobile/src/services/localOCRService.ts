import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition from '@react-native-ml-kit/text-recognition';

const TEMP_PREFIX = 'threshold_ocr_';

export async function extractTextFromImageLocal(base64Image: string): Promise<string> {
  const tempUri = `${FileSystem.cacheDirectory}${TEMP_PREFIX}${Date.now()}.jpg`;

  await FileSystem.writeAsStringAsync(tempUri, base64Image, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    const result = await TextRecognition.recognize(tempUri);
    return result?.text || '';
  } finally {
    FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
  }
}

export async function extractTextFromImageLocalFromUri(imageUri: string): Promise<string> {
  const result = await TextRecognition.recognize(imageUri);
  return result?.text || '';
}

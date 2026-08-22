// eslint-disable-next-line @typescript-eslint/no-require-imports
const FileSystem = require('expo-file-system/legacy');

export interface InstalledModel {
  filename: string;
  absolutePath: string;
}

/**
 * InstalledModelCatalogService
 * 
 * Inspects the local filesystem to determine which GGUF models are actually installed.
 * Acts purely as a filesystem inspector, without judging runtime compatibility.
 */
export class InstalledModelCatalogService {
  /**
   * Scans the models directory and returns a list of installed .gguf files.
   */
  static async getInstalledModels(): Promise<InstalledModel[]> {
    try {
      const modelsDir = `${FileSystem.documentDirectory}models/`;
      const dirInfo = await FileSystem.getInfoAsync(modelsDir);
      
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(modelsDir);
      const installedModels: InstalledModel[] = [];

      for (const file of files) {
        if (file.endsWith('.gguf') || file.endsWith('.bin')) {
          installedModels.push({
            filename: file,
            absolutePath: `${modelsDir}${file}`
          });
        }
      }

      return installedModels;
    } catch (error) {
      console.warn('[CatalogService] Failed to read installed models directory.', error);
      return [];
    }
  }
}

import { useAICatalogsStore, type LocalModelCatalogEntry } from '../../../store/useAICatalogsStore';
import { RemoteGGUFCatalogService, type RemoteLocalModel } from './RemoteGGUFCatalogService';
import { InstalledModelCatalogService, type InstalledModel } from './InstalledModelCatalogService';
import { useConnectivityStore } from '../../../store/useConnectivityStore';
import { useLocalAIStore } from '../../../store/useLocalAIStore';

/**
 * CatalogMergeService
 * 
 * Orchestrates the fetching of remote GGUF definitions and local filesystem scans.
 * Merges both sources into a unified LocalModelCatalogEntry array and updates the store.
 */
export class CatalogMergeService {
  /**
   * Refreshes the local catalog by pulling the latest remote definitions and 
   * scanning the local filesystem, then merging the results.
   */
  static async refreshLocalCatalog(): Promise<LocalModelCatalogEntry[]> {
    const store = useAICatalogsStore.getState();
    store.setFetchingLocal(true);

    try {
      // Execute both remote fetch and local scan concurrently
      const [remoteModels, installedFiles] = await Promise.all([
        RemoteGGUFCatalogService.fetchRemoteCatalog(),
        InstalledModelCatalogService.getInstalledModels()
      ]);

      const previousCatalog = store.localCatalog;
      const mergedCatalog: LocalModelCatalogEntry[] = [];
      
      // Used for quick lookup of installed files by filename or modelId/download URL
      const installedFileNames = new Set(installedFiles.map(f => f.filename));

      if (remoteModels) {
        // We have the remote catalog, use it as the base
        for (const remote of remoteModels) {
          // A naive match: the file is installed if its downloadUrl's filename is in the installedFiles set
          // In a real scenario, modelId or familyId might map directly to the filename
          const expectedFilename = remote.downloadUrl.split('/').pop() || remote.modelId + '.gguf';
          const isInstalled = installedFileNames.has(expectedFilename);
          
          // Determine if it's new compared to the previous catalog
          const prevEntry = previousCatalog.find(p => p.modelId === remote.modelId);
          const isNewFamily = !prevEntry && !previousCatalog.some(p => p.familyId === remote.familyId);
          const isNewQuantization = !prevEntry && previousCatalog.some(p => p.familyId === remote.familyId);

          mergedCatalog.push({
            modelId: remote.modelId,
            familyId: remote.familyId,
            quantization: remote.quantization,
            isListedRemotely: true,
            isInstalled,
            downloadUrl: remote.downloadUrl,
            capabilities: remote.capabilities,
            isNewFamily,
            isNewQuantization
          });

          // Remove from the set of unmapped installed files
          installedFileNames.delete(expectedFilename);
        }
      } else {
        // Offline or fetch failed
        // Check if this was an expected offline scenario
        const isOffline = !useConnectivityStore.getState().isOnline || useLocalAIStore.getState().forceOfflineMode;
        
        if (isOffline) {
          console.log('[CatalogMergeService] Catalog refresh skipped (expected in offline mode). Retaining local state.');
        } else {
          // Only throw a red screen ERROR if we are online and it STILL failed
          console.error('[CatalogMergeService] DIAGNOSTIC: Remote catalog fetch failed (likely 404). Retaining local state.');
        }
        
        for (const prev of previousCatalog) {
          if (prev.isListedRemotely) {
            const expectedFilename = prev.downloadUrl ? prev.downloadUrl.split('/').pop() : prev.modelId + '.gguf';
            const isInstalled = expectedFilename ? installedFileNames.has(expectedFilename) : false;
            
            mergedCatalog.push({
              ...prev,
              isInstalled
            });
            if (expectedFilename) installedFileNames.delete(expectedFilename);
          }
        }
      }

      // Now, any remaining installed files are models that are on disk but NOT in the remote catalog
      for (const unmappedFile of installedFiles) {
        if (!installedFileNames.has(unmappedFile.filename)) continue;

        // Try to find if we already knew about this unmapped file in the previous catalog
        const prevUnmapped = previousCatalog.find(p => !p.isListedRemotely && p.modelId === unmappedFile.filename);
        
        mergedCatalog.push({
          modelId: prevUnmapped?.modelId || unmappedFile.filename, // Fallback to filename as ID
          familyId: prevUnmapped?.familyId || 'unknown',
          quantization: prevUnmapped?.quantization || 'unknown',
          isListedRemotely: false, // Critical: this is an orphaned/legacy model
          isInstalled: true,
          downloadUrl: prevUnmapped?.downloadUrl,
          capabilities: prevUnmapped?.capabilities || ['text'],
          isNewFamily: false,
          isNewQuantization: false
        });
      }

      store.setLocalCatalog(mergedCatalog);
      console.log(`[CatalogMergeService] Local catalog merged: ${mergedCatalog.length} total models`);
      
      return mergedCatalog;
    } catch (error) {
      console.error('[CatalogMergeService] Error refreshing local catalog', error);
      return store.localCatalog;
    } finally {
      store.setFetchingLocal(false);
    }
  }
}

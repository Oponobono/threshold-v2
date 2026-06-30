import { AssetScenarioBase, AssetTestStepWithExpect } from '../dsl/AssetScenarioBase';
import { createAsset, goOffline, goOnline, validateQueueCount, validateChecksum, validateAssetState, validateConsistency } from '../dsl/steps';

export class DocumentOfflineScenario extends AssetScenarioBase {
  id = 'asset-document-offline';
  name = 'Document Offline Sync';
  description = 'Create scanned document offline → verify queue → go online → reducer → consistency';

  steps: AssetTestStepWithExpect[] = [
    { name: 'goOffline', run: goOffline() },
    { name: 'createDocument', run: createAsset('scanned-document') },
    { name: 'queueHasCreate', run: validateQueueCount(1) },
    { name: 'validateAssetState', run: validateAssetState('LOCAL_ONLY') },
    { name: 'goOnline', run: goOnline() },
    { name: 'validateChecksum', run: validateChecksum() },
    { name: 'validateConsistency', run: validateConsistency() },
  ];
}

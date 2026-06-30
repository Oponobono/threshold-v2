import { AssetScenarioBase, AssetTestStepWithExpect } from '../dsl/AssetScenarioBase';
import { createAsset, goOffline, goOnline, validateQueueCount, validateChecksum, validateAssetState, validateConsistency } from '../dsl/steps';

export class PhotoOfflineScenario extends AssetScenarioBase {
  id = 'asset-photo-offline';
  name = 'Photo Offline Sync';
  description = 'Create photo offline → verify queue state → go online → reducer → consistency';

  steps: AssetTestStepWithExpect[] = [
    { name: 'goOffline', run: goOffline() },
    { name: 'createPhoto', run: createAsset('photo') },
    { name: 'validateQueueCount', run: validateQueueCount(1) },
    { name: 'goOnline', run: goOnline() },
    { name: 'validateChecksum', run: validateChecksum() },
    { name: 'validateAssetState', run: validateAssetState('LOCAL_ONLY') },
    { name: 'validateConsistency', run: validateConsistency(['photos']) },
  ];
}

import { AssetScenarioBase, AssetTestStepWithExpect } from '../dsl/AssetScenarioBase';
import { createAsset, goOffline, goOnline, validateQueueCount, validateChecksum, validateAssetState, validateConsistency } from '../dsl/steps';

export class AudioOfflineScenario extends AssetScenarioBase {
  id = 'asset-audio-offline';
  name = 'Audio Offline Sync';
  description = 'Create audio recording offline → verify queue → go online → reducer → consistency';

  steps: AssetTestStepWithExpect[] = [
    { name: 'goOffline', run: goOffline() },
    { name: 'createAudio', run: createAsset('audio-recording') },
    { name: 'queueHasCreate', run: validateQueueCount(1) },
    { name: 'validateAssetState', run: validateAssetState('LOCAL_ONLY') },
    { name: 'goOnline', run: goOnline() },
    { name: 'validateChecksum', run: validateChecksum() },
    { name: 'validateConsistency', run: validateConsistency() },
  ];
}

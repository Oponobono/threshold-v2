import { AssetScenarioBase, AssetTestStepWithExpect } from '../dsl/AssetScenarioBase';
import { createAsset, corruptFile, validateChecksum, validateConsistency } from '../dsl/steps';

export class CorruptedAssetScenario extends AssetScenarioBase {
  id = 'asset-corrupted-recovery';
  name = 'Corrupted Asset Recovery';
  description = 'Create asset → corrupt file → checksum FAIL → AssetValidator detects → re-download → checksum OK';

  steps: AssetTestStepWithExpect[] = [
    { name: 'createAsset', run: createAsset('photo') },
    { name: 'checksumOK(before)', run: validateChecksum() },
    { name: 'corruptFile', run: corruptFile() },
    { name: 'checksumFAIL(afterCorrupt)', run: validateChecksum(), expectFail: true },
    { name: 'reCreateAsset', run: createAsset('photo') },
    { name: 'checksumOK(afterRecovery)', run: validateChecksum() },
    { name: 'validateConsistency', run: validateConsistency(['photos']) },
  ];
}

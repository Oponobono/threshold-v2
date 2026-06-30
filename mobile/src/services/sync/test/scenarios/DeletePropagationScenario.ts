import { AssetScenarioBase, AssetTestStepWithExpect } from '../dsl/AssetScenarioBase';
import { createAsset, deleteAsset, validateQueueCount, validateConsistency, validateAssetState } from '../dsl/steps';

export class DeletePropagationScenario extends AssetScenarioBase {
  id = 'asset-delete-propagation';
  name = 'Delete Propagation';
  description = 'Create asset → delete → sync_queue has DELETE → soft-delete in SQLite → consistency OK';

  steps: AssetTestStepWithExpect[] = [
    { name: 'createAsset', run: createAsset('photo') },
    { name: 'validateAssetState(beforeDelete)', run: validateAssetState('LOCAL_ONLY') },
    { name: 'queueHasCreate', run: validateQueueCount(1) },
    { name: 'deleteAsset', run: deleteAsset() },
    { name: 'validateAssetState(afterDelete)', run: validateAssetState('LOCAL_ONLY') },
    { name: 'validateConsistency', run: validateConsistency(['photos']) },
  ];
}

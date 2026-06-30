import { AssetScenarioBase, AssetTestStepWithExpect } from '../dsl/AssetScenarioBase';
import { createAsset, goOffline, goOnline, killApp, restartApp, validateQueueCount, validateConsistency } from '../dsl/steps';
import type { AssetType } from '../dsl/types';

const ASSET_COUNT = 100;
const TYPES: AssetType[] = ['photo', 'audio-recording', 'scanned-document'];

export class StressKillResumeScenario extends AssetScenarioBase {
  id = 'asset-stress-kill-resume';
  name = '100 Assets + Kill/Resume';
  description = `Create ${ASSET_COUNT} assets offline with random kill/resume cycles → verify queue → consistency`;

  steps: AssetTestStepWithExpect[] = [
    { name: 'goOffline', run: goOffline() },
    ...Array.from({ length: ASSET_COUNT }, (_, i) => {
      const type = TYPES[i % TYPES.length];
      const s: AssetTestStepWithExpect[] = [
        { name: `createAsset-${i + 1}`, run: createAsset(type, { id: `stress-${type}-${i}` }) },
      ];
      if (i > 0 && i % 23 === 0) {
        s.push({ name: `killApp-${i + 1}`, run: killApp() });
        s.push({ name: `restartApp-${i + 1}`, run: restartApp() });
      }
      return s;
    }).flat(),
    { name: 'goOnline', run: goOnline() },
    { name: 'validateQueueCount', run: validateQueueCount(ASSET_COUNT) },
    { name: 'validateConsistency', run: validateConsistency() },
  ];
}

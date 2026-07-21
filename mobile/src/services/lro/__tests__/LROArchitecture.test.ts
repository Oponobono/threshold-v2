import * as fs from 'fs';
import * as path from 'path';

describe('LRO Architecture Contract', () => {
  const LRO_SERVICES = [
    'src/services/backup/backupService.ts',
    'src/services/backup/downloadService.ts',
    'src/services/database/SyncService.ts'
  ];

  const BANNED_IMPORTS = [
    '@notifee/react-native',
    'expo-notifications',
    'src/services/notificationService', 
    'OperationProgressNotifier'
  ];

  it('LRO services should not depend on UI or notification providers directly', () => {
    for (const servicePath of LRO_SERVICES) {
      const fullPath = path.resolve(__dirname, '../../../..', servicePath);
      if (!fs.existsSync(fullPath)) {
        console.warn(`File not found: ${fullPath}`);
        continue;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      
      for (const banned of BANNED_IMPORTS) {
        // Simple regex check for imports
        const importRegex = new RegExp(`from\\s+['"]${banned}['"]|import\\s+['"]${banned}['"]`);
        
        expect(importRegex.test(content)).toBe(false);
      }
    }
  });
});

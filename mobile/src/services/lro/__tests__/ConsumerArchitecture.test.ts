import * as fs from 'fs';
import * as path from 'path';

describe('LRO Consumer Architecture', () => {
  const findFiles = (dir: string, ext: string, fileList: string[] = []) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        findFiles(filePath, ext, fileList);
      } else if (filePath.endsWith(ext)) {
        fileList.push(filePath);
      }
    }
    return fileList;
  };

  it('UI components should not import NotificationProvider', () => {
    const uiDir = path.resolve(__dirname, '../../../../app');
    const componentsDir = path.resolve(__dirname, '../../../components');
    const files = [
      ...findFiles(uiDir, '.tsx'),
      ...findFiles(componentsDir, '.tsx'),
    ];

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"].*\/NotificationProvider['"]/);
      expect(content).not.toMatch(/from\s+['"].*\/NotifeeOperationProvider['"]/);
      expect(content).not.toMatch(/import\s+notifee/);
    });
  });

  it('UI components should only depend on hooks, not emit directly', () => {
    // La UI no debería emitir eventos LRO, solo consumirlos (idealmente mediante useLongRunningOperations).
    const uiDir = path.resolve(__dirname, '../../../../app');
    const files = findFiles(uiDir, '.tsx');

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      // Asegurarse de que no llama a operationProgressBus.emit
      expect(content).not.toMatch(/operationProgressBus\.emit/);
    });
  });
});

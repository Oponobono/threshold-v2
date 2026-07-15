const fs = require('fs');
const path = require('path');
const p = path.resolve('mobile/src/components/subjects/SubjectDocumentsList.tsx');
let content = fs.readFileSync(p, 'utf8');

if (!content.includes('import * as Sharing')) {
    content = content.replace(
        "import * as WebBrowser from 'expo-web-browser';",
        "import * as WebBrowser from 'expo-web-browser';\nimport * as Sharing from 'expo-sharing';"
    );
}

if (!content.includes('const handleShare =')) {
    const fn = \
  const handleShare = async (doc: any) => {
    try {
      if (doc.local_uri) {
        const fileInfo = await FileSystem.getInfoAsync(doc.local_uri);
        if (fileInfo.exists) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(doc.local_uri);
            return;
          }
        }
      }
      
      if (doc.cloud_url && doc.cloud_url !== 'ghost_file') {
        await Share.share({ message: doc.cloud_url, url: doc.cloud_url });
      } else {
        showAlert({ title: 'Aviso', message: 'No se puede compartir el archivo.', type: 'warning' });
      }
    } catch (e) {}
  };
\;
    content = content.replace(
        "const toggleSelection = (id: string | number) => {",
        fn + "\n  const toggleSelection = (id: string | number) => {"
    );
}

content = content.replace(
    "onDelete={() => handleDelete(docId)}",
    "onDelete={() => handleDelete(docId)}\n                onShare={() => handleShare(doc)}"
);

fs.writeFileSync(p, content, 'utf8');

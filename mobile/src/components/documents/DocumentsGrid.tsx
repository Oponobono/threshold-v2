import React from 'react';
import { View, Text } from 'react-native';
import { documentsStyles as styles } from '../../styles/DocumentsScreen.styles';
import { DocumentGridCard } from './DocumentGridCard';
import type { DocumentSection } from '../../hooks/useDocumentsManager';

interface Props {
  sections: DocumentSection[];
  onPressDocument: (doc: any) => void;
  onDeleteDocument?: (id: string) => void;
}

export const DocumentsGrid: React.FC<Props> = ({ sections, onPressDocument, onDeleteDocument }) => {
  return (
    <View>
      {sections.map((section, sIdx) => (
        <View key={sIdx} style={{ marginBottom: 16 }}>
          <View style={styles.sectionHeader}>
            {section.subjectColor && (
              <View style={[styles.sectionDot, { backgroundColor: section.subjectColor }]} />
            )}
            <Text style={styles.sectionName}>{section.subjectName}</Text>
            <Text style={styles.sectionCount}>{section.items.length}</Text>
          </View>
          {section.items.map((doc) => (
            <DocumentGridCard
              key={doc.id}
              doc={doc}
              onPress={() => onPressDocument(doc)}
              onDelete={onDeleteDocument ? () => onDeleteDocument(doc.id) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

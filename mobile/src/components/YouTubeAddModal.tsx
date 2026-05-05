import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';

interface YouTubeAddModalProps {
  visible: boolean;
  youtubeUrl: string;
  isAdding: boolean;
  onUrlChange: (url: string) => void;
  onCancel: () => void;
  onAdd: () => void;
}

/**
 * Modal para agregar un nuevo enlace de YouTube.
 */
export const YouTubeAddModal: React.FC<YouTubeAddModalProps> = ({
  visible,
  youtubeUrl,
  isAdding,
  onUrlChange,
  onCancel,
  onAdd,
}) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.card,
          width: '85%',
          borderRadius: 20,
          padding: 24,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 16,
            color: theme.colors.text.primary,
          }}
        >
          {t('recordings.addYoutubeVideo')}
        </Text>
        <Text style={{ color: theme.colors.text.secondary, marginBottom: 12 }}>
          {t('recordings.youtubeLinkPrompt')}
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            marginBottom: 20,
          }}
        >
          <TextInput
            value={youtubeUrl}
            onChangeText={onUrlChange}
            placeholder={t('recordings.youtubePlaceholder')}
            placeholderTextColor={theme.colors.text.placeholder}
            style={{ height: 44, color: theme.colors.text.primary }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isAdding}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <TouchableOpacity
            onPress={onCancel}
            disabled={isAdding}
            style={{ padding: 10, opacity: isAdding ? 0.5 : 1 }}
          >
            <Text style={{ color: theme.colors.text.secondary, fontWeight: '600' }}>
              {t('recordings.cancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onAdd}
            disabled={isAdding || !youtubeUrl.trim()}
            style={{
              backgroundColor: isAdding || !youtubeUrl.trim() ? theme.colors.border : theme.colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {isAdding && <ActivityIndicator size="small" color="white" />}
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              {isAdding ? 'Añadiendo...' : 'Añadir'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/**
 * CloudAIModelSection.tsx
 *
 * Sección independiente para selección de modelos de IA en la nube (Groq y Gemini).
 *
 * Invariantes:
 *   - Lee de: useAICatalogsStore (catálogos) y useAISettingsStore (preferencias actuales).
 *   - Escribe en: useAISettingsStore.setPreference() únicamente.
 *   - No ejecuta resolución, HTTP, fallback ni modificaciones al catálogo.
 *   - La preferencia expresada representa la intención del usuario, no el resultado resuelto.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { theme } from '../../styles/theme';
import {
  useAICatalogsStore,
  type OnlineModel,
  type OnlineCatalogStatus,
} from '../../store/useAICatalogsStore';
import {
  useAISettingsStore,
  type AIModelPreference,
} from '../../store/useAISettingsStore';

// ─── Sub-components ──────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <View style={{
    height: 44, borderRadius: 8,
    backgroundColor: theme.colors.border + '50',
    marginBottom: 6,
  }} />
);

interface ModelRowProps {
  modelId: string;
  capabilities: string[];
  isSelected: boolean;
  isNewFamily?: boolean;
  isNewQuantization?: boolean;
  onSelect: () => void;
}

const ModelRow = ({ modelId, capabilities, isSelected, isNewFamily, isNewQuantization, onSelect }: ModelRowProps) => (
  <TouchableOpacity
    onPress={onSelect}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + '60',
      gap: 10,
    }}
    accessibilityRole="radio"
    accessibilityState={{ checked: isSelected }}
  >
    <Ionicons
      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
      size={18}
      color={isSelected ? theme.colors.primary : theme.colors.text.secondary}
    />
    <View style={{ flex: 1 }}>
      <Text style={{
        fontSize: theme.typography.sizes.sm,
        fontWeight: isSelected ? '700' : '500',
        color: isSelected ? theme.colors.text.primary : theme.colors.text.secondary,
      }}>
        {modelId}
      </Text>
      {capabilities.length > 0 && (
        <Text style={{ fontSize: 10, color: theme.colors.text.secondary, marginTop: 1 }}>
          {capabilities.join(' · ')}
        </Text>
      )}
    </View>
    {isNewFamily && (
      <View style={{
        backgroundColor: theme.colors.primary + '20',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}>
        <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: '700' }}>Nuevo</Text>
      </View>
    )}
    {!isNewFamily && isNewQuantization && (
      <View style={{
        backgroundColor: theme.colors.border,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}>
        <Text style={{ fontSize: 10, color: theme.colors.text.secondary, fontWeight: '600' }}>Nueva variante</Text>
      </View>
    )}
  </TouchableOpacity>
);

interface AutoRowProps {
  isSelected: boolean;
  onSelect: () => void;
}

const AutoRow = ({ isSelected, onSelect }: AutoRowProps) => (
  <TouchableOpacity
    onPress={onSelect}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + '60',
      gap: 10,
    }}
    accessibilityRole="radio"
    accessibilityState={{ checked: isSelected }}
  >
    <Ionicons
      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
      size={18}
      color={isSelected ? theme.colors.primary : theme.colors.text.secondary}
    />
    <View>
      <Text style={{
        fontSize: theme.typography.sizes.sm,
        fontWeight: isSelected ? '700' : '500',
        color: isSelected ? theme.colors.text.primary : theme.colors.text.secondary,
      }}>
        Automático
      </Text>
      <Text style={{ fontSize: 10, color: theme.colors.text.secondary, marginTop: 1 }}>
        Recomendado
      </Text>
    </View>
  </TouchableOpacity>
);

// ─── Provider subsection ─────────────────────────────────────────────────────

type CloudProvider = 'groq' | 'gemini';

interface ProviderSectionProps {
  provider: CloudProvider;
  label: string;
  models: OnlineModel[];
  status: OnlineCatalogStatus;
  preference: AIModelPreference;
  onSelect: (pref: AIModelPreference) => void;
}

const ProviderSection = ({ provider, label, models, status, preference, onSelect }: ProviderSectionProps) => {
  const [expanded, setExpanded] = useState(true);
  const providerModels = models.filter(m => m.provider === provider);

  const selectedLabel = preference.mode === 'manual'
    ? preference.modelId
    : 'Automático';

  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity
        onPress={() => setExpanded(prev => !prev)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 6,
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View>
          <Text style={styles.subSectionTitle}>{label}</Text>
          {!expanded && (
            <Text style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 1 }}>
              {selectedLabel}
            </Text>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.text.secondary}
        />
      </TouchableOpacity>

      {expanded && (
        <>
          {status === 'loading' && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {status === 'empty' && (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Ionicons name="cloud-offline-outline" size={20} color={theme.colors.text.secondary} />
              <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 6, textAlign: 'center' }}>
                Sin modelos disponibles
              </Text>
            </View>
          )}

          {(status === 'loaded' || status === 'cached') && (
            <>
              {status === 'cached' && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  marginBottom: 6,
                }}>
                  <Ionicons name="time-outline" size={12} color={theme.colors.text.secondary} />
                  <Text style={{ fontSize: 10, color: theme.colors.text.secondary }}>
                    Datos almacenados
                  </Text>
                </View>
              )}

              <AutoRow
                isSelected={preference.mode === 'auto'}
                onSelect={() => onSelect({ mode: 'auto' })}
              />

              {providerModels.map(model => (
                <ModelRow
                  key={model.modelId}
                  modelId={model.modelId}
                  capabilities={model.capabilities}
                  isSelected={preference.mode === 'manual' && preference.modelId === model.modelId}
                  onSelect={() => onSelect({ mode: 'manual', modelId: model.modelId })}
                />
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const CloudAIModelSection = () => {
  const [expanded, setExpanded] = useState(false);

  const onlineCatalog = useAICatalogsStore(s => s.onlineCatalog);
  const onlineCatalogStatus = useAICatalogsStore(s => s.onlineCatalogStatus);

  const preferences = useAISettingsStore(s => s.preferences);
  const setPreference = useAISettingsStore(s => s.setPreference);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={() => setExpanded(prev => !prev)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
        accessibilityRole="button"
        accessibilityLabel="Motor de IA en la nube"
        accessibilityState={{ expanded }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="cloud-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Motor de IA en la nube</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Selecciona el modelo de Groq o Gemini que prefieras usar
          </Text>
        </View>
        {onlineCatalogStatus === 'loading' ? (
          <ActivityIndicator size="small" color={theme.colors.text.secondary} />
        ) : (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.text.secondary}
            style={{ marginTop: 2 }}
          />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 16 }}>
          <ProviderSection
            provider="groq"
            label="Groq"
            models={onlineCatalog}
            status={onlineCatalogStatus}
            preference={preferences.groq}
            onSelect={pref => setPreference('groq', pref)}
          />
          <ProviderSection
            provider="gemini"
            label="Gemini"
            models={onlineCatalog}
            status={onlineCatalogStatus}
            preference={preferences.gemini}
            onSelect={pref => setPreference('gemini', pref)}
          />
        </View>
      )}
    </View>
  );
};

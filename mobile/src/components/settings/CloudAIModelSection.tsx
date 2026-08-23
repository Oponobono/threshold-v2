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
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { theme } from '../../styles/theme';
import {
  useAICatalogsStore,
  type OnlineModel,
  type OnlineDataStatus,
  type OnlineRefreshStatus,
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

type BadgeVariant = 'success' | 'error';

interface RefreshBadgeProps {
  variant: BadgeVariant;
  onDismiss: () => void;
}

const RefreshBadge = ({ variant, onDismiss }: RefreshBadgeProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20 }),
    ]).start();

    const dismiss = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -4, duration: 400, useNativeDriver: true }),
      ]).start(onDismiss);
    }, 3000);

    return () => clearTimeout(dismiss);
  }, []);

  const isSuccess = variant === 'success';
  const bgColor = isSuccess ? '#1a3a2a' : '#3a1a1a';
  const borderColor = isSuccess ? '#2d6e4a' : '#6e2d2d';
  const iconName = isSuccess ? 'checkmark-circle-outline' : 'alert-circle-outline';
  const iconColor = isSuccess ? '#5ecb8a' : '#e07070';
  const label = isSuccess ? 'Catálogo actualizado' : 'No se pudo actualizar el catálogo';

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 20,
          borderWidth: 1,
          backgroundColor: bgColor,
          borderColor,
          marginTop: 8,
        },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={iconName as any} size={13} color={iconColor} />
      <Text style={{ fontSize: 11, color: iconColor, fontWeight: '600', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Animated.View>
  );
};

interface ModelRowProps {
  modelId: string;
  capabilities: string[];
  isSelected: boolean;
  isNewFamily?: boolean;
  isNewQuantization?: boolean;
  onSelect: () => void;
}

const ModelRow = ({ modelId, capabilities, isSelected, isNewFamily, isNewQuantization, onSelect }: ModelRowProps) => {
  const { t } = useTranslation();

  const formattedCaps = capabilities.map(cap => {
    if (cap === 'text') return t('settings.cloudAI.capText', 'Texto');
    if (cap === 'vision') return t('settings.cloudAI.capVision', 'Visión');
    return cap;
  }).join(' · ');

  return (
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
            {t('settings.cloudAI.capabilities', 'Apto para: {{caps}}', { caps: formattedCaps })}
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
};

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
  dataStatus: OnlineDataStatus;
  refreshStatus: OnlineRefreshStatus;
  preference: AIModelPreference;
  onSelect: (pref: AIModelPreference) => void;
}

const ProviderSection = ({ provider, label, models, dataStatus, refreshStatus, preference, onSelect }: ProviderSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const providerModels = models.filter(m => m.provider === provider);

  const selectedLabel = preference.mode === 'manual'
    ? preference.modelId
    : 'Automático';
    
  const isLoadingSkeletons = dataStatus === 'empty' && refreshStatus === 'refreshing';
  const isEmptyView = dataStatus === 'empty' && refreshStatus === 'idle';
  const isErrorView = dataStatus === 'empty' && refreshStatus === 'error';
  const hasModelsToRender = dataStatus === 'cached' || dataStatus === 'loaded';

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
          {isLoadingSkeletons && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {isEmptyView && (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Ionicons name="server-outline" size={20} color={theme.colors.text.secondary} />
              <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 6, textAlign: 'center' }}>
                Sin modelos disponibles
              </Text>
            </View>
          )}

          {isErrorView && (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Ionicons name="cloud-offline-outline" size={20} color={theme.colors.text.secondary} />
              <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 6, textAlign: 'center' }}>
                No se pudo obtener el catálogo
              </Text>
            </View>
          )}

          {hasModelsToRender && (
            <>
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
  const [badgeVariant, setBadgeVariant] = useState<BadgeVariant | null>(null);

  const onlineCatalog = useAICatalogsStore(s => s.onlineCatalog);
  const dataStatus = useAICatalogsStore(s => s.onlineDataStatus);
  const refreshStatus = useAICatalogsStore(s => s.onlineRefreshStatus);

  const preferences = useAISettingsStore(s => s.preferences);
  const setPreference = useAISettingsStore(s => s.setPreference);

  useEffect(() => {
    if (refreshStatus === 'error') {
      setBadgeVariant('error');
    } else if (refreshStatus === 'idle' && dataStatus === 'loaded') {
      setBadgeVariant('success');
    }
  }, [refreshStatus]);

  const handleRefresh = useCallback(async () => {
    if (refreshStatus === 'refreshing') return;
    setBadgeVariant(null);
    const { OnlineModelCatalogService } = await import('../../services/ai/catalogs/OnlineModelCatalogService');
    await OnlineModelCatalogService.fetchOnlineCatalog();
  }, [refreshStatus]);

  return (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <TouchableOpacity
          onPress={() => setExpanded(prev => !prev)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
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
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.text.secondary}
            style={{ marginTop: 2 }}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginLeft: 8, paddingTop: 2 }}
          accessibilityLabel="Actualizar lista de modelos"
          accessibilityRole="button"
          disabled={refreshStatus === 'refreshing'}
        >
          {refreshStatus === 'refreshing' ? (
            <ActivityIndicator size="small" color={theme.colors.text.secondary} />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={17}
              color={theme.colors.text.secondary}
            />
          )}
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={{ marginTop: 16 }}>
          <ProviderSection
            provider="groq"
            label="Groq"
            models={onlineCatalog}
            dataStatus={dataStatus}
            refreshStatus={refreshStatus}
            preference={preferences.groq}
            onSelect={pref => setPreference('groq', pref)}
          />
          <ProviderSection
            provider="gemini"
            label="Gemini"
            models={onlineCatalog}
            dataStatus={dataStatus}
            refreshStatus={refreshStatus}
            preference={preferences.gemini}
            onSelect={pref => setPreference('gemini', pref)}
          />
        </View>
      )}

      {badgeVariant !== null && (
        <RefreshBadge
          key={String(badgeVariant) + String(Date.now())}
          variant={badgeVariant}
          onDismiss={() => setBadgeVariant(null)}
        />
      )}
    </View>
  );
};

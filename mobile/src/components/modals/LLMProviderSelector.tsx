/**
 * LLMProviderSelector.tsx
 *
 * Componente que permite al usuario elegir entre Groq y Gemini
 * para el chat con Zyren.
 *
 * Características:
 * - Mostrar pros/contras de cada proveedor
 * - Indicador visual del proveedor seleccionado
 * - Integración con AsyncStorage para persistencia
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  LLMProvider,
  getPreferredLLMProvider,
  setPreferredLLMProvider,
  LLM_PROVIDERS,
} from '../../utils/llmProviderManager';

// ─── Tokens de color ───────────────────────────────────────────────────────
const PRIMARY = '#7B72FF';
const ACCENT_GROQ = '#00C896';
const ACCENT_GEMINI = '#4285F4';
const BORDER = 'rgba(255,255,255,0.08)';
const TXT_PRI = '#F0F0F8';
const TXT_SEC = 'rgba(240,240,248,0.45)';
const SELECTED_BG = `${PRIMARY}20`;
const CARD_BG = 'rgba(255,255,255,0.04)';

interface LLMProviderSelectorProps {
  onProviderChange?: (provider: LLMProvider) => void;
  showDescription?: boolean;
  compact?: boolean;
}

export const LLMProviderSelector: React.FC<LLMProviderSelectorProps> = ({
  onProviderChange,
  showDescription = true,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('groq');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreference();
  }, []);

  const loadPreference = async () => {
    try {
      const provider = await getPreferredLLMProvider();
      setSelectedProvider(provider);
    } catch (error) {
      console.error('Error loading LLM preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (provider: LLMProvider) => {
    setSaving(true);
    try {
      await setPreferredLLMProvider(provider);
      setSelectedProvider(provider);
      onProviderChange?.(provider);
      Alert.alert(t('settings.savingChange', '✅ Cambio guardado'), `${t('settings.usingProvider', 'Usando')} ${LLM_PROVIDERS[provider].label}`);
    } catch {
      Alert.alert(t('settings.errorChange', '❌ Error'), t('settings.errorChangeMsg', 'No se pudo cambiar el proveedor'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="small" color={PRIMARY} />
        <Text style={s.loadingText}>{t('common.loading', 'Cargando...')}</Text>
      </View>
    );
  }

  if (compact) {
    // Modo compacto: solo muestra selector horizontal
    return (
      <View style={s.compactContainer}>
        <Text style={s.compactLabel}>{t('settings.llmProvider', 'Proveedor de IA:')}</Text>
        <View style={s.compactButtons}>
          {(['groq', 'gemini'] as LLMProvider[]).map((provider) => (
            <TouchableOpacity
              key={provider}
              disabled={saving}
              style={[
                s.compactButton,
                selectedProvider === provider && s.compactButtonActive,
              ]}
              onPress={() => handleProviderChange(provider)}
            >
              <Text
                style={[
                  s.compactButtonText,
                  selectedProvider === provider && s.compactButtonTextActive,
                ]}
              >
                {LLM_PROVIDERS[provider].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Modo expandido: tarjetas con detalles
  return (
    <View style={s.container}>
      <Text style={s.title}>{t('settings.llmSelectorTitle', 'Elige tu Proveedor de IA')}</Text>
      <Text style={s.subtitle}>
        {t('settings.llmSelectorSubtitle', 'Selecciona según tus preferencias de velocidad o capacidad')}
      </Text>

      <ScrollView
        style={s.cardsContainer}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      >
        {(['groq', 'gemini'] as LLMProvider[]).map((provider) => {
          const config = LLM_PROVIDERS[provider];
          const isSelected = selectedProvider === provider;
          const accentColor = provider === 'groq' ? ACCENT_GROQ : ACCENT_GEMINI;

          return (
            <TouchableOpacity
              key={provider}
              disabled={saving}
              style={[
                s.card,
                isSelected && s.cardSelected,
                { borderLeftColor: accentColor },
              ]}
              onPress={() => handleProviderChange(provider)}
              activeOpacity={0.7}
            >
              {/* Checkmark si está seleccionado */}
              {isSelected && (
                <View style={[s.checkmark, { backgroundColor: accentColor }]}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                </View>
              )}

              {/* Header del card */}
              <View style={s.cardHeader}>
                <Text style={s.cardIcon}>{config.icon}</Text>
                <View style={s.cardTitleContainer}>
                  <Text style={s.cardTitle}>{config.label}</Text>
                  <Text style={s.cardDescription}>{config.description}</Text>
                </View>
              </View>

              {/* Ventajas */}
              {showDescription && (
                <View style={s.cardContent}>
                  <View style={s.advantagesSection}>
                    <Text style={s.sectionLabel}>{t('settings.llmAdvantages', 'Ventajas:')}</Text>
                    {config.advantages.map((adv, idx) => (
                      <View key={idx} style={s.advantageItem}>
                        <Text style={s.bulletPoint}>•</Text>
                        <Text style={s.advantageText}>{adv}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Límites */}
                  <View style={s.limitsSection}>
                    <Text style={[s.limitsLabel, { color: accentColor }]}>
                      ⚠️ {config.limits}
                    </Text>
                  </View>
                </View>
              )}

              {/* Loading indicator si está guardando */}
              {saving && (
                <View style={s.savingOverlay}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ─── Estilos ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: TXT_PRI,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: TXT_SEC,
    marginBottom: 16,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    borderLeftWidth: 5,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: SELECTED_BG,
    borderColor: PRIMARY,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TXT_PRI,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 12,
    color: TXT_SEC,
  },
  cardContent: {
    gap: 12,
  },
  advantagesSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TXT_SEC,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  advantageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletPoint: {
    color: PRIMARY,
    fontSize: 14,
    marginTop: -1,
  },
  advantageText: {
    fontSize: 13,
    color: TXT_PRI,
    flex: 1,
  },
  limitsSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  limitsLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Modo compacto
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TXT_SEC,
  },
  compactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'transparent',
  },
  compactButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  compactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: TXT_SEC,
  },
  compactButtonTextActive: {
    color: '#FFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: TXT_SEC,
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

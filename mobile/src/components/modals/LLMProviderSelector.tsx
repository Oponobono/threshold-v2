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

import {
  s,
  PRIMARY,
  ACCENT_GROQ,
  ACCENT_GEMINI,
} from '../../styles/LLMProviderSelector.styles';


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



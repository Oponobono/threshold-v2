import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';

interface FilterDropdownProps {
  label: string;
  value?: string | null;
  onPress: () => void;
  isActive?: boolean;
  iconName?: keyof typeof Feather.glyphMap;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  onPress,
  isActive = false,
  iconName,
}) => {
  const hasValue = !!value;
  const animatedValue = useRef(new Animated.Value(hasValue ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: hasValue || isActive ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [hasValue, isActive]);

  const labelTop = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -8],
  });

  const labelFontSize = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [13, 11],
  });

  const labelColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.text.secondary, isActive ? theme.colors.primary : theme.colors.text.secondary],
  });

  const borderColor = isActive ? theme.colors.primary : theme.colors.border;
  const bgColor = theme.colors.background;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.inputContainer, { borderColor, backgroundColor: bgColor }]}>
          
          <Animated.View pointerEvents="none" style={[styles.labelContainer, { top: labelTop, backgroundColor: bgColor }]}>
            <Animated.Text style={[{ fontSize: labelFontSize, color: labelColor, fontWeight: '600' }]} numberOfLines={1}>
              {label}
            </Animated.Text>
          </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 12, paddingTop: hasValue ? 6 : 0 }}>
            {iconName && !hasValue && (
              <Feather name={iconName} size={14} color={theme.colors.text.placeholder} style={{ marginRight: 6 }} />
            )}
            {iconName && hasValue && (
              <Feather name={iconName} size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
            )}
            
            <View style={{ flex: 1, justifyContent: 'center' }}>
              {hasValue ? (
                <Text style={{ fontSize: 13, color: theme.colors.text.primary, fontWeight: '600', letterSpacing: -0.1 }} numberOfLines={1}>
                  {value}
                </Text>
              ) : null}
            </View>
          </View>
          
          <View style={{ position: 'absolute', right: 12, height: '100%', justifyContent: 'center' }}>
            <Feather name="chevron-down" size={16} color={isActive ? theme.colors.primary : theme.colors.text.secondary} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 20, // Forma de píldora
    height: 40,
    justifyContent: 'center',
    ...globalStyles.shadow, // Sombra suave global
  },
  labelContainer: {
    position: 'absolute',
    left: 12, // Más adentro por el borde curvo
    paddingHorizontal: 4,
    zIndex: 1,
  },
});

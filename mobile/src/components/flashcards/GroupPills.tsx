import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';

interface GroupInfo {
  group_pin_id: string;
  name?: string;
}

interface Props {
  groups: GroupInfo[];
  activeGroupPin: string | null;
  onSelect: (pin: string | null) => void;
}

export const GroupPills: React.FC<Props> = ({ groups, activeGroupPin, onSelect }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.filterRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillContent}
        style={styles.pillScroll}
      >
        <TouchableOpacity
          onPress={() => onSelect(null)}
          activeOpacity={0.72}
          style={[styles.pill, activeGroupPin === null ? styles.pillActive : styles.pillInactive]}
        >
          <Ionicons
            name="layers-outline"
            size={13}
            color={activeGroupPin === null ? theme.colors.white : theme.colors.text.secondary}
          />
          <Text style={[styles.pillText, activeGroupPin === null ? styles.pillTextActive : styles.pillTextInactive]}>
            {t('common.all', 'Todos')}
          </Text>
        </TouchableOpacity>
        {groups.map((group) => {
          const isActive = activeGroupPin === group.group_pin_id;
          return (
            <TouchableOpacity
              key={group.group_pin_id}
              onPress={() => onSelect(group.group_pin_id)}
              activeOpacity={0.72}
              style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
            >
              <Ionicons
                name="people"
                size={13}
                color={isActive ? theme.colors.white : theme.colors.text.secondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
                {group.name || group.group_pin_id}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

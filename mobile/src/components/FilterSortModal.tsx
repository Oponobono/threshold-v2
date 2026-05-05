import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface FilterSortModalProps {
  visible: boolean;
  sortOrder: 'desc' | 'asc';
  dateFilter: 'all' | 'today' | 'week' | 'month';
  onSortChange: (order: 'desc' | 'asc') => void;
  onFilterChange: (filter: 'all' | 'today' | 'week' | 'month') => void;
  onClose: () => void;
}

/**
 * Modal para aplicar filtros de fecha y ordenamiento en la pantalla de grabaciones.
 */
export const FilterSortModal: React.FC<FilterSortModalProps> = ({
  visible,
  sortOrder,
  dateFilter,
  onSortChange,
  onFilterChange,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onClose}
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
      <TouchableOpacity
        activeOpacity={1}
        onPress={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.colors.card,
          width: '85%',
          borderRadius: 20,
          padding: 24,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text.primary }}>
            Filtros y Orden
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 8 }}>
          Ordenar por
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {(['desc', 'asc'] as const).map((order) => (
            <TouchableOpacity
              key={order}
              onPress={() => onSortChange(order)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: sortOrder === order ? theme.colors.primary : theme.colors.background,
                borderWidth: 1,
                borderColor: sortOrder === order ? theme.colors.primary : theme.colors.border,
              }}
            >
              <Text style={{ color: sortOrder === order ? '#fff' : theme.colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                {order === 'desc' ? 'Más recientes' : 'Más antiguos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 8 }}>
          Filtrar por fecha
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {(['all', 'today', 'week', 'month'] as const).map((filter) => {
            const labels = { all: 'Todas', today: 'Hoy', week: 'Esta semana', month: 'Este mes' };
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => onFilterChange(filter)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: dateFilter === filter ? theme.colors.primary : theme.colors.background,
                  borderWidth: 1,
                  borderColor: dateFilter === filter ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text style={{ color: dateFilter === filter ? '#fff' : theme.colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                  {labels[filter]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={onClose}
          style={{
            backgroundColor: theme.colors.primary,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Aplicar</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { CalendarScope } from '../../types/calendar';
import { ActiveSubject } from '../../hooks/useActiveSubjects';

interface EmptyAgendaStateProps {
  scope: CalendarScope;
  onClear: () => void;
  activeSubjects: ActiveSubject[];
}

export const EmptyAgendaState: React.FC<EmptyAgendaStateProps> = ({ scope, onClear, activeSubjects }) => {
  let filterName = 'General';
  
  if (scope.kind === 'subject') {
    const subj = activeSubjects.find(s => s.id === scope.subjectId);
    filterName = subj ? subj.name : 'esta materia';
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="calendar-clear-outline" size={48} color={theme.colors.border} />
      </View>
      <Text style={styles.title}>No hay eventos de {filterName} este día.</Text>
      <Text style={styles.subtitle}>Intenta buscar en otro día o revisa todas las materias.</Text>
      
      <TouchableOpacity style={styles.button} onPress={onClear}>
        <Text style={styles.buttonText}>Ver todas las materias</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  button: {
    backgroundColor: theme.colors.primaryTransparent.light,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
  }
});

import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

export interface CoursePickerOption {
  id: string;
  name: string;
  subjectCount: number;
  /** Progreso 0–100, opcional */
  progress?: number;
  icon?: string;
  color?: string;
  platform?: string;
}

interface CoursePickerSheetProps {
  visible: boolean;
  options: CoursePickerOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

const PLATFORM_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  platzi: 'lightning-bolt',
  udemy: 'school-outline',
  coursera: 'certificate-outline',
  youtube: 'youtube',
};

const TONAL_PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

const getCourseColor = (course: CoursePickerOption, index: number): string =>
  course.color || TONAL_PALETTE[index % TONAL_PALETTE.length];

const getPlatformIcon = (platform?: string): keyof typeof MaterialCommunityIcons.glyphMap =>
  (platform && PLATFORM_ICON[platform.toLowerCase()]) || 'folder-outline';

/**
 * Hoja de selección de cursos siguiendo el lenguaje bento de la app.
 * — Sin botón Cancelar (scrim + gesto de bajar cierran la hoja)
 * — Búsqueda condicional (>6 cursos)
 * — Primera fila fija "Todos los cursos"
 * — Cada fila: icono tonal 40×40, nombre (2 líneas), "N materias · X% completado"
 * — Radio check + fondo tonal en fila seleccionada
 * — Cierre inmediato al tocar (selección única)
 * — Accesibilidad: radiogroup + radio por fila
 */
export const CoursePickerSheet: React.FC<CoursePickerSheetProps> = ({
  visible,
  options,
  selectedId,
  onSelect,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState('');
  const mountTime = useRef(0);

  React.useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  if (visible && mountTime.current === 0) {
    mountTime.current = Date.now();
  } else if (!visible && mountTime.current !== 0) {
    mountTime.current = 0;
  }

  const handleBackdropPress = () => {
    const elapsed = Date.now() - mountTime.current;
    if (elapsed < 400) return; // ghost tap guard
    onClose();
  };

  const showSearch = options.length > 6;
  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (id: string | null) => {
    onSelect(id);
    onClose();
  };

  const renderAllRow = () => {
    const isSelected = selectedId === null;
    const totalSubjects = options.reduce((sum, o) => sum + o.subjectCount, 0);
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => handleSelect(null)}
        activeOpacity={0.65}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Todos los cursos, ${totalSubjects} materias`}
      >
        <View style={[styles.iconBox, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
          <MaterialCommunityIcons name="layers-outline" size={20} color="#6366f1" />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, isSelected && styles.rowNameSelected]} numberOfLines={2}>
            Todos los cursos
          </Text>
          <Text style={styles.rowMeta}>{totalSubjects} materia{totalSubjects !== 1 ? 's' : ''}</Text>
        </View>
        {isSelected && (
          <Feather name="check-circle" size={20} color={theme.colors.text.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, index }: { item: CoursePickerOption; index: number }) => {
    const isSelected = selectedId === item.id;
    const color = getCourseColor(item, index);
    const icon = getPlatformIcon(item.platform);
    const progressText =
      typeof item.progress === 'number' ? ` · ${Math.round(item.progress)}% completado` : '';

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => handleSelect(item.id)}
        activeOpacity={0.65}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${item.name}, ${item.subjectCount} materias${progressText}`}
      >
        <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, isSelected && styles.rowNameSelected]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta}>
            {item.subjectCount} materia{item.subjectCount !== 1 ? 's' : ''}
            {progressText}
          </Text>
        </View>
        {isSelected ? (
          <Feather name="check-circle" size={20} color={theme.colors.text.primary} />
        ) : (
          <View style={styles.radioEmpty} />
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {/* Drag handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Cursos</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Feather name="x" size={18} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              {showSearch && (
                <View style={styles.searchRow}>
                  <Feather name="search" size={15} color={theme.colors.text.secondary} style={{ marginRight: 8 }} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar curso..."
                    placeholderTextColor={theme.colors.text.placeholder}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="x-circle" size={15} color={theme.colors.text.secondary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Divider */}
              <View style={styles.divider} />

              {/* List */}
              <FlatList
                data={filteredOptions}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: '100%' }}
                accessibilityRole="radiogroup"
                ListHeaderComponent={query ? null : renderAllRow}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Sin resultados para &quot;{query}&quot;</Text>
                }
                renderItem={renderItem}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '72%',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: theme.colors.border,
    marginBottom: 4,
  },
  separator: {
    height: 0.5,
    backgroundColor: theme.colors.border,
    marginLeft: 60,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 12,
    minHeight: 64,
  },
  rowSelected: {
    backgroundColor: theme.colors.card,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    lineHeight: 18,
    marginBottom: 2,
  },
  rowNameSelected: {
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '400',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    textAlign: 'center',
    padding: 24,
    fontSize: 14,
  },
});

import { StyleSheet, Dimensions } from 'react-native';
import { theme } from './theme';

const { height: screenHeight } = Dimensions.get('window');

export const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.85,
    backgroundColor: 'transparent',
  },
  content: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },

  // Bento Blocks
  bentoBlock: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  whenBlock: {
    // No additional margin needed
  },
  bentoBlockLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bentoBlockTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bentoBlockContent: {
    gap: 12,
  },

  // Bloque 1: Título con estilos del login
  titleInputContainer: {
    position: 'relative',
    backgroundColor: '#F9F9F7',
    borderWidth: 0.8,
    borderColor: theme.colors.border,
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.colors.text.primary,
    padding: 0,
    flex: 1,
  },
  titleInputLabel: {
    position: 'absolute',
    left: 16,
    top: -8,
    backgroundColor: '#F9F9F7',
    paddingHorizontal: 4,
    fontSize: 11,
    fontWeight: '300',
    color: '#8A8A8E',
    letterSpacing: 0.5,
  },

  // Bloque 1: Type Pills
  typePillsContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  typePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 0,
  },
  typePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  typePillTextActive: {
    color: '#fff',
  },

  // Bloque 2: Subject Selector
  subjectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subjectSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },

  // Bloque 3: Time
  allDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  allDayLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  dateTimeRowContainer: {
    gap: 6,
  },
  dateTimeRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  dateTimeButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateTimeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  dateTimeButtonDivider: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginHorizontal: 2,
  },

  // Bloque 4: Study Plan
  studyPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  studyPlanLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  studyPlanSubtext: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },

  // Bloque 5: Description
  descriptionInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.colors.text.primary,
    textAlignVertical: 'top',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: theme.colors.background,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Subject Picker
  pickerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.6,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  pickerList: {
    gap: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    marginBottom: 8,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  pickerItemColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.primary,
    flex: 1,
  },
});

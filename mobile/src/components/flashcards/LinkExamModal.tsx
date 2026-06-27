/**
 * LinkExamModal.tsx
 *
 * Modal para vincular un mazo de flashcards a un examen del calendario.
 * Permite elegir entre exámenes existentes o crear uno nuevo directamente.
 * Al vincular, el ExamSchedulerService detectará automáticamente el examen
 * y activará la compresión de intervalos SRS.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { FlashcardDeck } from '../../services/api/types';
import {
  getCalendarEvents,
  createCalendarEvent,
  CalendarEvent,
} from '../../services/api/calendar';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDateISO(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function daysBetween(dateStr: string): number | null {
  // Supports both YYYY-MM-DD and DD-MM-YYYY
  try {
    let d: Date;
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      d = new Date(dateStr);
    } else {
      const [day, month, year] = dateStr.split('-').map(Number);
      d = new Date(year, month - 1, day);
    }
    const diff = d.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function urgencyColor(days: number | null): string {
  if (days === null || days < 0) return '#9E9E9E';
  if (days <= 3) return '#D32F2F';
  if (days <= 7) return '#F57C00';
  if (days <= 14) return '#F9A825';
  return '#388E3C';
}

function urgencyLabel(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return 'Pasado';
  if (days === 0) return '¡Hoy!';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  deck: FlashcardDeck | null;
  onClose: () => void;
  onLinked: (examTitle: string) => void;
}

type Step = 'pick' | 'create';

export const LinkExamModal: React.FC<Props> = ({ visible, deck, onClose, onLinked }) => {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('pick');
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [currentLinkedExam, setCurrentLinkedExam] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  // Create-exam form
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Load upcoming exams ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setStep('pick');
    setExamTitle('');
    setCurrentLinkedExam(null);
    setLoading(true);
    getCalendarEvents()
      .then((all) => {
        let linked: any = null;
        const upcoming = (all as any[])
          .filter((e: any) => ['exam', 'task', 'other'].includes(e.event_type || e.eventType))
          .filter((e: any) => {
            const eDeckId = e.linked_deck_id || e.deckId;
            const strEDeckId = eDeckId != null ? String(eDeckId) : null;
            const strDeckId = deck?.id != null ? String(deck?.id) : null;
            
            if (strEDeckId === strDeckId) {
              linked = e;
              return false; // Don't show in the list of available exams
            }
            if (strEDeckId && strEDeckId !== strDeckId) {
              return false; // Linked to another deck, filter it out to keep 1-to-1 relationship
            }
            return true;
          })
          .sort((a: any, b: any) => {
            const da = daysBetween(a.start_date ?? a.startDate) ?? 999;
            const db = daysBetween(b.start_date ?? b.startDate) ?? 999;
            return da - db;
          });
        setExams(upcoming);
        setCurrentLinkedExam(linked);
      })
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, [visible, deck]);

  // ── Link existing exam to deck (one-to-one by deck_id) ───────────────────
  const handleLinkExisting = async (exam: any) => {
    if (!deck || linking) return;
    
    if (!deck.subject_id) {
      Alert.alert(
        'Atención',
        'Primero debes vincular este mazo a una materia para poder asignarle un examen.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    setLinking(true);
    try {
      const { updateCalendarEvent } = await import('../../services/api/calendar');
      await updateCalendarEvent(exam.id, { deckId: deck.id });
      onLinked(exam.title);
      onClose();
    } catch (e: any) {
      console.warn('[LinkExamModal] Error linking exam:', e.message);
    } finally {
      setLinking(false);
    }
  };

  // ── Create new exam and link to this deck ────────────────────────────────
  const handleCreateAndLink = async () => {
    if (!deck || creating || !examTitle.trim()) return;

    if (!deck.subject_id) {
      Alert.alert(
        'Atención',
        'Primero debes vincular este mazo a una materia para poder crear y asignarle un examen.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    setCreating(true);
    try {
      const dateISO = formatDateISO(examDate);
      await createCalendarEvent({
        title: examTitle.trim(),
        eventType: 'exam',
        deckId: deck.id,
        subjectId: deck.subject_id,
        startDate: dateISO,
        endDate: dateISO,
        allDay: true,
        createStudyPlan: false,
      });
      onLinked(examTitle.trim());
      onClose();
    } catch (e: any) {
      console.warn('[LinkExamModal] Error creating exam:', e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
          onPress={() => null}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            {step === 'create' ? (
              <TouchableOpacity onPress={() => setStep('pick')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 22 }} />
            )}
            <Text style={styles.headerTitle}>
              {step === 'pick' ? 'Vincular a Examen' : 'Nuevo Examen'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Deck chip */}
          <View style={styles.deckChip}>
            <Ionicons name="layers-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.deckChipText} numberOfLines={1}>{deck?.title}</Text>
          </View>

          {step === 'pick' ? (
            <>
              {loading ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 32 }} />
              ) : (
                <>
                  {exams.length === 0 && !currentLinkedExam ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="calendar-outline" size={40} color={theme.colors.text.placeholder} />
                      <Text style={styles.emptyText}>No tienes exámenes próximos</Text>
                      <Text style={styles.emptySubtext}>Crea uno nuevo para activar la compresión de estudio</Text>
                    </View>
                  ) : (
                    <>
                      {currentLinkedExam && (
                        <>
                          <Text style={styles.sectionLabel}>Vinculado actualmente</Text>
                          <View style={[styles.examRow, { borderColor: theme.colors.primary, borderWidth: 1, marginBottom: 12 }]}>
                            <View style={[styles.urgencyDot, { backgroundColor: theme.colors.primary }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.examTitle} numberOfLines={1}>{currentLinkedExam.title}</Text>
                              <Text style={styles.examSubject} numberOfLines={1}>
                                {(currentLinkedExam as any).subject_name ?? 'Sin materia'}
                              </Text>
                            </View>
                            <View style={[styles.daysBadge, { borderColor: theme.colors.primary }]}>
                              <Text style={[styles.daysText, { color: theme.colors.primary }]}>
                                {urgencyLabel(daysBetween((currentLinkedExam as any).start_date ?? (currentLinkedExam as any).startDate))}
                              </Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} style={{ marginLeft: 8 }} />
                          </View>
                        </>
                      )}
                      
                      {exams.length > 0 && (
                        <>
                          <Text style={styles.sectionLabel}>Exámenes del calendario</Text>
                          <FlatList
                            data={exams}
                            keyExtractor={(e) => e.id}
                            style={{ maxHeight: currentLinkedExam ? 200 : 280 }}
                            renderItem={({ item }) => {
                              const rawDate = (item as any).start_date ?? (item as any).startDate;
                              const days = daysBetween(rawDate);
                              const color = urgencyColor(days);
                              return (
                                <TouchableOpacity
                                  style={styles.examRow}
                                  onPress={() => handleLinkExisting(item)}
                                  disabled={linking}
                                  activeOpacity={0.7}
                                >
                                  <View style={[styles.urgencyDot, { backgroundColor: color }]} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.examTitle} numberOfLines={1}>{item.title}</Text>
                                    <Text style={styles.examSubject} numberOfLines={1}>
                                      {(item as any).subject_name ?? 'Sin materia'}
                                    </Text>
                                  </View>
                                  <View style={[styles.daysBadge, { borderColor: color }]}>
                                    <Text style={[styles.daysText, { color }]}>{urgencyLabel(days)}</Text>
                                  </View>
                                  {linking ? (
                                    <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
                                  ) : (
                                    <Ionicons name="link-outline" size={18} color={theme.colors.primary} style={{ marginLeft: 8 }} />
                                  )}
                                </TouchableOpacity>
                              );
                            }}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                          />
                        </>
                      )}
                    </>
                  )}

                  {/* CTA to create new */}
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => setStep('create')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.createBtnText}>Crear nuevo examen</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            /* ── Create Form ── */
            <View style={{ gap: 16 }}>
              <Text style={styles.sectionLabel}>Nombre del examen</Text>
              <TextInput
                style={styles.input}
                placeholder={`Examen de ${deck?.subject_name ?? 'materia'}`}
                placeholderTextColor={theme.colors.text.placeholder}
                value={examTitle}
                onChangeText={setExamTitle}
                autoFocus
              />

              <Text style={styles.sectionLabel}>Fecha del examen</Text>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar" size={18} color={theme.colors.primary} />
                <Text style={styles.dateText}>
                  {examDate.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.colors.text.secondary} />
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={examDate}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(_, selected) => {
                    setShowDatePicker(false);
                    if (selected) setExamDate(selected);
                  }}
                />
              )}

              {/* Compression preview */}
              {(() => {
                const days = Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const multiplier = Math.max(0.2, Math.min(1.0, days / 30));
                const pct = Math.round(multiplier * 100);
                const col = urgencyColor(days);
                return (
                  <View style={[styles.previewBox, { borderColor: col + '40', backgroundColor: col + '10' }]}>
                    <Ionicons name="speedometer-outline" size={16} color={col} />
                    <Text style={[styles.previewText, { color: col }]}>
                      Intervalos al {pct}% · {urgencyLabel(days)}
                    </Text>
                  </View>
                );
              })()}

              <TouchableOpacity
                style={[styles.createBtn, (!examTitle.trim() || creating) && { opacity: 0.5 }]}
                onPress={handleCreateAndLink}
                disabled={!examTitle.trim() || creating}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.createBtnText}>Crear y vincular</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  deckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  deckChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
    maxWidth: 240,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  examRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  urgencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  examTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  examSubject: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 1,
  },
  daysBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  daysText: {
    fontSize: 11,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text.primary,
    textTransform: 'capitalize',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

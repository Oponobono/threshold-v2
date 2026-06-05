import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { audioRecorderStyles as styles } from '../../styles/AudioRecorderModal.styles';
import { RecordingItem } from '../../hooks/useAudioRecorder';
import { useCustomAlert } from '../ui/CustomAlert';

interface AudioPlayerItemProps {
  item: RecordingItem & { missingFile?: boolean; isStreaming?: boolean };
  isPlaying: boolean;
  onPlay: (uri: string, id: string) => void;
  onStop: () => void;
  onDelete: (id: string | number, uri: string) => void;
  onPress?: () => void;
}

/**
 * AudioPlayerItem.tsx
 *
 * Fila o tarjeta de lista que representa un archivo de audio/grabación.
 * Contiene controles internos para reproducir/pausar la grabación usando llamadas a funciones prop.
 * Soporta un modo "Missing File" donde desactiva la reproducción y cambia a un estado de error visual
 * en caso de que la ruta física del audio ya no exista en el dispositivo.
 *
 * @param item - Objeto con datos de la grabación (nombre, fecha, URI, info de la materia).
 * @param isPlaying - Estado boleano que indica si este audio es el que está sonando actualmente.
 * @param onPlay - Callback para ordenar al reproductor nativo iniciar este `uri`.
 * @param onStop - Callback para pausar/detener el audio en curso.
 * @param onDelete - Callback para confirmar y ejecutar la eliminación de la grabación.
 * @param onPress - (Opcional) Función al presionar toda la fila, útil para navegar a detalles.
 */
export const AudioPlayerItem: React.FC<AudioPlayerItemProps> = ({
  item,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  onPress,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const isMissing = item.missingFile === true;

  const handleDelete = () => {
    showAlert({
      title: t('audio.deleteRecording'),
      message: isMissing
        ? t('audio.deleteLogOnly')
        : t('audio.deleteConfirm'),
      type: isMissing ? 'warning' : 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(item.id_string || item.id || 0, item.uri),
        },
      ],
    });
  };

  return (
    <TouchableOpacity 
      style={[styles.recordingItem, isMissing && { opacity: 0.6, borderLeftWidth: 3, borderLeftColor: theme.colors.text.error }]} 
      activeOpacity={onPress && !isMissing ? 0.7 : 1}
      onPress={!isMissing ? onPress : undefined}
    >
      <View style={styles.recordingInfo}>
        <Text style={styles.recordingName}>{item.name}</Text>
        {isMissing && (
          <Text style={{ fontSize: 11, color: theme.colors.text.error, marginTop: 2 }}>
            ⚠ Archivo no encontrado — solo registro en BD
          </Text>
        )}
        {item.isStreaming && (
          <Text style={{ fontSize: 11, color: theme.colors.primary, marginTop: 2 }}>
            ☁️ Reproduciendo desde la nube
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={styles.recordingDate}>{item.date}</Text>
          {(item.cloud_url || item.is_backed_up === 1) && (
            <Ionicons name="cloud-done" size={14} color={theme.colors.success || '#34C759'} />
          )}
        </View>
        {item.subject_name && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <View style={{ 
              width: 8, 
              height: 8, 
              borderRadius: 4, 
              backgroundColor: item.subject_color || theme.colors.primary, 
              marginRight: 6 
            }} />
            <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>{item.subject_name}</Text>
          </View>
        )}
      </View>
      <View style={styles.recordingActions}>
        {/* Solo mostrar botón de play si el archivo existe */}
        {!isMissing && (
          <TouchableOpacity 
            onPress={() => isPlaying ? onStop() : onPlay(item.uri, item.id_string || item.id?.toString() || '')}
            style={styles.actionButton}
          >
            <Ionicons 
              name={isPlaying ? "pause-circle" : "play-circle"} 
              size={32} 
              color={theme.colors.primary} 
            />
          </TouchableOpacity>
        )}
        {/* Botón de borrar siempre visible */}
        <TouchableOpacity 
          onPress={handleDelete}
          style={styles.actionButton}
        >
          <Ionicons 
            name="trash-outline" 
            size={20} 
            color={isMissing ? theme.colors.text.error : theme.colors.text.secondary} 
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};




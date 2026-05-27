import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { chatStyles as styles } from '../../styles/SubjectAIChatModal.styles';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

/**
 * ChatMessageBubble.tsx
 *
 * Componente funcional que renderiza una burbuja de mensaje individual 
 * dentro de un hilo de chat. Dependiendo de si el rol es 'user' o 'assistant',
 * el componente aplica diferentes estilos (alineación, colores y avatar)
 * para distinguir visualmente quién es el emisor del mensaje.
 *
 * @param item - Objeto que contiene el ID, rol (usuario/bot) y el texto del mensaje.
 */
export const ChatMessageBubble: React.FC<{ item: ChatMessage }> = ({ item }) => {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.messageBubble, isUser ? styles.messageUser : styles.messageBot]}>
      {!isUser && (
        <View style={styles.botIcon}>
          <MaterialCommunityIcons name="robot-outline" size={16} color={theme.colors.primary} />
        </View>
      )}
      <View style={[styles.messageContent, isUser ? styles.messageContentUser : styles.messageContentBot]}>
        <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextBot]}>
          {item.content}
        </Text>
      </View>
    </View>
  );
};

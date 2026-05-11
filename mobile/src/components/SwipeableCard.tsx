import React, { useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { View } from 'react-native';

interface Props {
  children: React.ReactNode;
  renderActions: (close: () => void) => React.ReactNode;
  onOpen?: (close: () => void) => void;
}

export const SwipeableCard: React.FC<Props> = ({ children, renderActions, onOpen }) => {
  const swipeableRef = useRef<Swipeable>(null);

  const close = () => {
    swipeableRef.current?.close();
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={() => renderActions(close)}
        onSwipeableOpen={() => onOpen?.(close)}
        containerStyle={{ overflow: 'hidden', borderRadius: 18 }}
        overshootRight={false}
      >
        {children}
      </Swipeable>
    </View>
  );
};

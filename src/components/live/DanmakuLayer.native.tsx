import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

export interface DanmakuMessage {
  id: string;
  text: string;
  color?: string;
  isSelf?: boolean;
}

interface DanmakuItemProps extends DanmakuMessage {
  top: number;
  onFinished: (id: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DanmakuItem = ({ id, text, top, isSelf, onFinished }: DanmakuItemProps) => {
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    const duration = 8000 + Math.random() * 3000;
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH - 200, // Move far enough to the left
      duration: duration,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onFinished(id);
      }
    });
  }, []);

  return (
    <Animated.View
      style={[
        styles.itemContainer,
        {
          top,
          transform: [{ translateX }],
          borderColor: isSelf ? 'rgba(250,204,21,0.5)' : 'rgba(0,0,0,0.1)',
          borderWidth: isSelf ? 1 : 0,
        },
      ]}
    >
      <Text style={[styles.itemText, { color: isSelf ? '#facc15' : '#ffffff' }]}>
        {text}
      </Text>
    </Animated.View>
  );
};

export interface DanmakuLayerRef {
  addMessage: (msg: DanmakuMessage) => void;
}

const DanmakuLayer = forwardRef<DanmakuLayerRef, { enabled: boolean }>(({ enabled }, ref) => {
  const [items, setItems] = useState<DanmakuItemProps[]>([]);
  const nextTrackRef = useRef(0);
  const maxTracks = 5;
  const trackHeight = 35;

  useImperativeHandle(ref, () => ({
    addMessage: (msg: DanmakuMessage) => {
      if (!enabled) return;

      const track = nextTrackRef.current;
      nextTrackRef.current = (nextTrackRef.current + 1) % maxTracks;

      const newItem: DanmakuItemProps = {
        ...msg,
        top: 40 + track * trackHeight,
        onFinished: (finishedId) => {
          setItems(prev => prev.filter(i => i.id !== finishedId));
        },
      };

      setItems(prev => [...prev, newItem]);
    },
  }));

  if (!enabled || items.length === 0) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {items.map(item => (
        <DanmakuItem key={item.id} {...item} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300, // Only cover top part
    zIndex: 99,
  },
  itemContainer: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 3,
  },
});

export default DanmakuLayer;

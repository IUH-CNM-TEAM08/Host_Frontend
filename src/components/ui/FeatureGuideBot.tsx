import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useGuide } from '@/src/contexts/GuideContext';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, Easing } from 'react-native-reanimated';

export type BotState = 'MENU' | 'MOVING' | 'TALKING' | 'UNDERSTOOD' | 'ASK_MORE' | 'GOODBYE';

export default function FeatureGuideBot() {
  const router = useRouter();
  const { isActive, topics, activeTopicId, currentStepIndex, selectTopic, nextStep, finishTopic, stopGuide, backToMenu } = useGuide();
  const [windowSize, setWindowSize] = useState({ width: Dimensions.get('window').width, height: Dimensions.get('window').height });
  const [botState, setBotState] = useState<BotState>('MENU');
  const [runFrameIndex, setRunFrameIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [pokeMessage, setPokeMessage] = useState<string | null>(null);
  const [isCrying, setIsCrying] = useState(false);
  const previousIsActiveRef = useRef(false);
  const entryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pokeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motionTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const lastPokeAtRef = useRef(0);
  const pokeCountRef = useRef(0);
  
  // Tọa độ bot
  const botX = useSharedValue(windowSize.width / 2);
  const botY = useSharedValue(-200); // Bắt đầu từ trên cao
  const opacity = useSharedValue(0);
  const BUBBLE_WIDTH = 180;
  const BUBBLE_GAP = 12;
  const MASCOT_WIDTH = 56;
  const EDGE_PADDING = 16;

  const isStepTalking = botState === 'TALKING' || botState === 'ASK_MORE';
  const isHappy = botState === 'UNDERSTOOD' || botState === 'MENU';
  const runOffset = isRunning ? (runFrameIndex % 2 === 0 ? -2 : 2) : 0;
  const handOffset = isRunning ? (runFrameIndex % 2 === 0 ? -1 : 1) : 0;

  const clearMotionTimers = () => {
    motionTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    motionTimersRef.current = [];
  };

  const scheduleMotionTimer = (callback: () => void, delayMs: number) => {
    const timerId = setTimeout(() => {
      motionTimersRef.current = motionTimersRef.current.filter((id) => id !== timerId);
      callback();
    }, delayMs);
    motionTimersRef.current.push(timerId);
    return timerId;
  };

  // Hiệu ứng chạy: đổi frame khi mascot di chuyển (nhẹ để tránh lag)
  useEffect(() => {
    if (!isRunning) {
      setRunFrameIndex(0);
      return;
    }
    const id = setInterval(() => setRunFrameIndex((v) => (v + 1) % 2), 250);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (entryTimerRef.current) clearTimeout(entryTimerRef.current);
      if (pokeHideTimerRef.current) clearTimeout(pokeHideTimerRef.current);
      clearMotionTimers();
    };
  }, []);

  const handlePokeBot = () => {
    // Nhấn mascot: chỉ nhún nhẹ tại chỗ, không tự chạy sang vị trí khác
    setIsRunning(true);
    botY.value = withSequence(
      withTiming(botY.value - 8, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(botY.value + 4, { duration: 110, easing: Easing.inOut(Easing.quad) }),
      withTiming(botY.value, { duration: 120, easing: Easing.out(Easing.quad) })
    );
    scheduleMotionTimer(() => setIsRunning(false), 420);

    const now = Date.now();
    const withinBurst = now - lastPokeAtRef.current <= 2000;
    pokeCountRef.current = withinBurst ? pokeCountRef.current + 1 : 1;
    lastPokeAtRef.current = now;

    if (pokeHideTimerRef.current) clearTimeout(pokeHideTimerRef.current);

    if (pokeCountRef.current >= 3) {
      setIsCrying(true);
      setPokeMessage('Đau quá... huhu, đừng chọt nữa mà!');
      pokeHideTimerRef.current = setTimeout(() => {
        setPokeMessage(null);
        setIsCrying(false);
      }, 1800);
      return;
    }

    setIsCrying(false);
    setPokeMessage('Nhột quá đó nha!');
    pokeHideTimerRef.current = setTimeout(() => setPokeMessage(null), 1100);
  };

  // Reset state về MENU khi vừa mới active
  useEffect(() => {
    if (isActive && !activeTopicId) {
      setBotState('MENU');
    }
  }, [isActive, activeTopicId]);

  // Cập nhật kích thước màn hình trên web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const updateSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Di chuyển bot đến phần tử
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    clearMotionTimers();
    // Bubble giờ ở phía trên mascot → chỉ cần tính mascot width cho dock
    const dockX = windowSize.width - MASCOT_WIDTH - EDGE_PADDING;
    const dockY = windowSize.height - MASCOT_WIDTH - EDGE_PADDING; // Sát góc dưới phải

    if (isActive) {
      if (botState === 'ASK_MORE' || botState === 'GOODBYE') {
        // Ưu tiên: Chạy về góc dưới phải để hỏi/tạm biệt
        setIsRunning(true);
        botX.value = withTiming(dockX, { duration: 2000, easing: Easing.inOut(Easing.quad) });
        scheduleMotionTimer(() => {
          botY.value = withTiming(dockY, { duration: 1200, easing: Easing.inOut(Easing.quad) });
        }, 2000);
        opacity.value = withTiming(1);
        scheduleMotionTimer(() => setIsRunning(false), 3300);
      } else if (activeTopicId) {
        // Chế độ Hướng dẫn: Bay tới phần tử
        const activeTopic = topics.find(t => t.id === activeTopicId);
        if (!activeTopic) return;
        const step = activeTopic.steps[currentStepIndex];
        
        setIsRunning(true);
        setBotState('MOVING'); // Hình 2 khi di chuyển

        scheduleMotionTimer(() => {
          const el = document.querySelector(`[data-guide="${step.targetId}"]`);
          if (el) {
            const rect = el.getBoundingClientRect();
            let targetX = rect.right + 20;
            let targetY = rect.top;

            if (targetX + 350 > windowSize.width) {
              targetX = rect.left - 370;
            }
            if (targetY + 200 > windowSize.height) {
              targetY = dockY;
            }

            // Cho bot chạy theo trục X trước, sau đó leo lên trục Y để giống chạy bộ hơn
            botX.value = withTiming(targetX, { duration: 2100, easing: Easing.inOut(Easing.quad) });
            scheduleMotionTimer(() => {
              botY.value = withTiming(targetY, { duration: 1200, easing: Easing.inOut(Easing.quad) });
            }, 2100);
            opacity.value = withTiming(1, { duration: 220 });
          } else {
            botX.value = withTiming(dockX, { duration: 2400 });
            botY.value = withTiming(dockY, { duration: 2400 });
            opacity.value = withTiming(1);
          }
          
          // Chạy tới xong thì chuyển sang TALKING
          scheduleMotionTimer(() => {
            setIsRunning(false);
            setBotState('TALKING');
          }, 3400);
        }, 100);
      } else {
        // Chế độ Menu: rơi từ trên xuống chậm rãi rồi nảy nhẹ như NPC
        botX.value = withSpring(dockX);
        if (!previousIsActiveRef.current) {
          setIsRunning(true);
          botY.value = withTiming(dockY - 34, { duration: 420, easing: Easing.out(Easing.cubic) });
          opacity.value = withTiming(1, { duration: 180 });
          if (entryTimerRef.current) clearTimeout(entryTimerRef.current);
          entryTimerRef.current = setTimeout(() => {
            botY.value = withSequence(
              withTiming(dockY + 4, { duration: 90, easing: Easing.out(Easing.quad) }),
              withTiming(dockY, { duration: 110, easing: Easing.out(Easing.quad) })
            );
            setIsRunning(false);
            setBotState('MENU');
          }, 400);
        } else {
          botY.value = withSpring(dockY);
          opacity.value = withTiming(1, { duration: 300 });
          setIsRunning(false);
          setBotState('MENU');
        }
      }
    } else {
      // Ẩn bot (bay lên trên)
      setIsRunning(false);
      botY.value = withTiming(-300, { duration: 500, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: 500 });
    }
    previousIsActiveRef.current = isActive;
  }, [isActive, activeTopicId, currentStepIndex, topics, windowSize]);

  // Các hàm xử lý tương tác
  const handleSelectTopic = (id: string) => {
    selectTopic(id);
    const chosenTopic = topics.find((t) => t.id === id);
    const targetId = chosenTopic?.steps?.[0]?.targetId;
    if (!targetId) return;

    if (targetId === 'sidebar-notifications' && Platform.OS === 'web') {
      const notificationTab = document.querySelector(`[data-guide="${targetId}"]`) as HTMLElement | null;
      notificationTab?.click();
      return;
    }

    const routeMap: Record<string, string> = {
      'sidebar-index': '/',
      'sidebar-contacts': '/(main)/contacts',
      'sidebar-games': '/(main)/games',
      'sidebar-music': '/(main)/music',
      'sidebar-timeline': '/(main)/timeline',
      'sidebar-settings': '/(main)/settings',
      'sidebar-discovery': '/(main)/discovery',
    };

    const targetRoute = routeMap[targetId];
    if (targetRoute) {
      router.replace(targetRoute as any);
    }
  };

  const handleNextStep = () => {
    setBotState('UNDERSTOOD'); // Hình 4: Đã hiểu
    const activeTopic = topics.find(t => t.id === activeTopicId);
    
    scheduleMotionTimer(() => {
      if (currentStepIndex < (activeTopic?.steps.length || 0) - 1) {
        nextStep(); // Tới bước kế tiếp -> bot sẽ trở lại MOVING
      } else {
        // Hoàn thành chủ đề
        finishTopic(); // Xóa activeTopicId
        setBotState('ASK_MORE'); // Hình 5: Hỏi có muốn hướng dẫn phần nào không
      }
    }, 800); // Giữ hình 4 trong 0.8s
  };

  const handleStopGuide = () => {
    const dockX = windowSize.width - MASCOT_WIDTH - EDGE_PADDING;
    const dockY = windowSize.height - MASCOT_WIDTH - EDGE_PADDING;
    setBotState('GOODBYE');
    // Chạy về dock trước khi ẩn
    setIsRunning(true);
    botX.value = withTiming(dockX, { duration: 800, easing: Easing.inOut(Easing.quad) });
    botY.value = withTiming(dockY, { duration: 800, easing: Easing.inOut(Easing.quad) });
    scheduleMotionTimer(() => {
      setIsRunning(false);
      stopGuide();
    }, 1200);
  };

  const handleBackToMenu = () => {
    const dockX = windowSize.width - MASCOT_WIDTH - EDGE_PADDING;
    const dockY = windowSize.height - MASCOT_WIDTH - EDGE_PADDING;
    // Hủy hướng dẫn: chỉ chạy về dock rồi quay lại menu, không "bay mất"
    setIsRunning(true);
    botX.value = withTiming(dockX, { duration: 1200, easing: Easing.inOut(Easing.quad) });
    botY.value = withTiming(dockY, { duration: 1200, easing: Easing.inOut(Easing.quad) });
    scheduleMotionTimer(() => {
      setIsRunning(false);
      backToMenu();
      setBotState('MENU');
    }, 1300);
  };

  if (Platform.OS !== 'web') return null;
  // Không unmount hoàn toàn để bot có thể bay ra ngoài màn hình mượt mà,
  // chỉ dùng pointerEvents='none' khi không active

  // Xác định bot đang ở dock (góc dưới phải) hay đang ở target element
  const isDocked = !activeTopicId || botState === 'ASK_MORE' || botState === 'GOODBYE';
  const dockedBubbleMaxHeight = Math.max(200, windowSize.height - 300);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: botX.value },
        { translateY: botY.value }
      ],
      opacity: opacity.value,
      position: 'fixed' as any,
      zIndex: 99999,
      top: 0,
      left: 0,
    };
  });

  return (
    <Animated.View style={animatedStyle} pointerEvents={isActive ? 'box-none' : 'none'}>
      <View style={{
        ...(isDocked
          ? {} // Docked: default column, bubble sẽ absolute lên trên
          : { flexDirection: 'row-reverse' as any, alignItems: 'flex-start' as any }), // At target: bubble bên trái
      }}>
        {/* Bot Avatar */}
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handlePokeBot}
            style={{ backgroundColor: 'transparent' }}>
            <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  position: 'absolute',
                  width: 34,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: '#e9d5ff',
                  borderWidth: 1,
                  borderColor: '#a78bfa',
                  top: 8 + runOffset,
                  shadowColor: '#8b5cf6',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 20,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#f3e8ff',
                  borderWidth: 1,
                  borderColor: '#c4b5fd',
                  top: 14 + runOffset,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: '#4b5563',
                  top: 19 + runOffset,
                  left: 21,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: '#4b5563',
                  top: 19 + runOffset,
                  right: 21,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 7,
                  height: 2,
                  borderRadius: 2,
                  backgroundColor: isCrying ? '#ef4444' : isStepTalking ? '#8b5cf6' : isHappy ? '#7c3aed' : '#9ca3af',
                  top: 23 + runOffset,
                  alignSelf: 'center',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 26,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#ddd6fe',
                  borderWidth: 1,
                  borderColor: '#a78bfa',
                  top: 34 + runOffset,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#e9d5ff',
                  borderWidth: 1,
                  borderColor: '#a78bfa',
                  left: 7,
                  top: 36 + handOffset,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#e9d5ff',
                  borderWidth: 1,
                  borderColor: '#a78bfa',
                  right: 7,
                  top: 36 - handOffset,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 9,
                  borderRadius: 4,
                  backgroundColor: '#f5f3ff',
                  borderWidth: 1,
                  borderColor: '#a78bfa',
                  left: 18,
                  bottom: 1 + Math.max(0, runOffset),
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 9,
                  borderRadius: 4,
                  backgroundColor: '#f5f3ff',
                  borderWidth: 1,
                  borderColor: '#a78bfa',
                  right: 18,
                  bottom: 1 + Math.max(0, -runOffset),
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 3,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: '#7c3aed',
                  alignSelf: 'center',
                  top: 39 + runOffset,
                }}
              />
            </View>
          </TouchableOpacity>
          {pokeMessage && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: -16,
                bottom: 60, // Hiển thị phía trên mascot
                backgroundColor: isCrying ? 'rgba(254, 242, 242, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                borderColor: isCrying ? '#fca5a5' : '#e5e7eb',
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 7,
                minWidth: 90,
                maxWidth: 120,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 10, color: isCrying ? '#dc2626' : '#1f2937', lineHeight: 14, fontWeight: '700', textAlign: 'center' }}>
                {pokeMessage}
              </Text>
            </View>
          )}
        </View>
        
        {/* Khung thoại (Dialog Bubble) */}
        <View style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: 12,
          borderRadius: 16,
          width: 220,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          elevation: 5,
          ...(isDocked
            ? {
                position: 'absolute' as any,
                bottom: 78, // Sát mascot hơn, hơi chồng lên để liên kết visual
                right: 0,
                maxHeight: dockedBubbleMaxHeight,
                // @ts-ignore web-only
                overflowY: 'auto',
              }
            : {
                marginRight: 12,
                marginTop: -20,
              }),
        }}>
          {/* Mũi tên - thay đổi hướng theo vị trí */}
          {isDocked ? (
            <View style={{
              position: 'absolute',
              right: 20,
              bottom: -6,
              width: 12,
              height: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              transform: [{ rotate: '45deg' }],
              borderBottomWidth: 1,
              borderRightWidth: 1,
              borderColor: '#e5e7eb',
            }} />
          ) : (
            <View style={{
              position: 'absolute',
              right: -6,
              top: 28,
              width: 12,
              height: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              transform: [{ rotate: '45deg' }],
              borderRightWidth: 1,
              borderTopWidth: 1,
              borderColor: '#e5e7eb',
            }} />
          )}

        {botState === 'GOODBYE' ? (
          /* HIỂN THỊ TẠM BIỆT */
          <View>
            <Text style={{ fontSize: 14, color: '#1f2937', lineHeight: 20, fontWeight: '600', textAlign: 'center' }}>
              Tạm biệt nhé!
            </Text>
          </View>
        ) : botState === 'ASK_MORE' ? (
          /* HIỂN THỊ HỎI CÓ MUỐN HƯỚNG DẪN NỮA KHÔNG */
          <View>
            <Text style={{ fontSize: 14, color: '#1f2937', marginBottom: 12, lineHeight: 20, fontWeight: '600' }}>
              Bạn có muốn xem hướng dẫn phần nào khác không?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              <TouchableOpacity onPress={handleStopGuide} style={{ padding: 6 }}>
                <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Không</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setBotState('MENU')}
                style={{ backgroundColor: '#6d28d9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Có</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : !activeTopicId ? (
          /* HIỂN THỊ MENU CHỦ ĐỀ */
          <View>
            <Text style={{ fontSize: 14, color: '#1f2937', marginBottom: 12, lineHeight: 20, fontWeight: '600' }}>
              Mình có thể giúp gì cho bạn?
            </Text>
            <View style={{ gap: 8 }}>
              {topics.map(topic => (
                <TouchableOpacity
                  key={topic.id}
                  onPress={() => handleSelectTopic(topic.id)}
                  style={{ backgroundColor: '#f3f4f6', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' }}
                >
                  <Text style={{ color: '#4b5563', fontWeight: 'bold', fontSize: 13 }}>{topic.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={handleStopGuide} style={{ padding: 6 }}>
                <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* HIỂN THỊ HƯỚNG DẪN CHI TIẾT THEO BƯỚC */
          <View>
            <Text style={{ fontSize: 14, color: '#1f2937', marginBottom: 12, lineHeight: 20, fontWeight: '600' }}>
              {botState === 'UNDERSTOOD' 
                ? "Tuyệt vời!" 
                : topics.find(t => t.id === activeTopicId)?.steps[currentStepIndex]?.text}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: 'bold' }}>
                Bước {currentStepIndex + 1}/{topics.find(t => t.id === activeTopicId)?.steps.length}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity onPress={handleBackToMenu} style={{ padding: 6 }}>
                  <Text style={{ color: '#6b7280', fontWeight: '600', fontSize: 12 }}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleNextStep}
                  disabled={botState === 'UNDERSTOOD' || botState === 'MOVING'}
                  style={{ backgroundColor: (botState === 'UNDERSTOOD' || botState === 'MOVING') ? '#9ca3af' : '#6d28d9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                    {currentStepIndex < (topics.find(t => t.id === activeTopicId)?.steps.length || 0) - 1 ? 'Đã hiểu' : 'Xong'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        </View>
      </View>
    </Animated.View>
  );
}

import React from 'react';
import { View, Text } from 'react-native';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default' | 'purple';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  P: any;
}

export function Badge({ text, variant = 'default', P }: BadgeProps) {
  const m: any = {
    success: { bg: P.successBg, c: P.success },
    danger: { bg: P.dangerBg, c: P.danger },
    warning: { bg: P.warningBg, c: P.warning },
    info: { bg: P.infoBg, c: P.info },
    purple: { bg: P.primaryBg, c: P.primary },
    default: { bg: P.borderLight, c: P.textSec },
  };
  const s = m[variant] || m.default;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: s.c }}>{text}</Text>
    </View>
  );
}

export default Badge;

import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { Badge } from './Badge';

interface BarChartProps {
  data: { label: string; value: number; color: string }[];
  title: string;
  subtitle?: string;
  P: any;
}

export function BarChart({ data, title, subtitle, P }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const W = 500, H = 180, pad = 40;
  const chartW = W - pad * 2;
  const barW = Math.min(35, chartW / data.length - 10);
  const gap = (chartW - barW * data.length) / (data.length + 1);
  const gridLines = [0, 0.5, 1];

  return (
    <View style={{
      backgroundColor: P.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: P.border,
      shadowColor: '#000', shadowOpacity: 0.02, elevation: 1, flex: 1, minWidth: 300, marginRight: 16, marginBottom: 16
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: P.text }}>{title}</Text>
          {subtitle && <Text style={{ fontSize: 11, color: P.textDim }}>{subtitle}</Text>}
        </View>
        {hovered !== null && (
          <Badge text={`${data[hovered].label}: ${data[hovered].value}`} variant="purple" P={P} />
        )}
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {gridLines.map((g, i) => {
          const y = pad + (H - pad * 2) * (1 - g);
          return (
            <G key={i}>
              <Line x1={pad} y1={y} x2={W - 10} y2={y} stroke={P.borderLight} strokeWidth={1} />
              <SvgText x={pad - 8} y={y + 4} textAnchor="end" fontSize={10} fill={P.textDim}>{Math.round(maxVal * g)}</SvgText>
            </G>
          );
        })}
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * (H - pad * 2);
          const x = pad + gap * (i + 1) + barW * i;
          const y = H - pad - barH;
          const isHovered = hovered === i;
          return (
            <G key={i}
              //@ts-ignore
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onPress={() => setHovered(i)}>
              <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={d.color} opacity={isHovered ? 1 : 0.7} />
              <SvgText x={x + barW / 2} y={H - pad + 14} textAnchor="middle" fontSize={9} fill={isHovered ? P.primary : P.textSec} fontWeight={isHovered ? '700' : '400'}>{d.label}</SvgText>
              {isHovered && <SvgText x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="bold" fill={d.color}>{d.value}</SvgText>}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

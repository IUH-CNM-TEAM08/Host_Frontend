import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  title: string;
  subtitle?: string;
  P: any;
}

export function DonutChart({ data, title, subtitle, P }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 65, r = 45, cx = 80, cy = 80;
  let cumAngle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const start = cumAngle;
    cumAngle += angle;
    const end = cumAngle;
    const isHovered = hovered === i;
    const currentR = isHovered ? R + 5 : R;
    const x1 = cx + currentR * Math.cos(start), y1 = cy + currentR * Math.sin(start);
    const x2 = cx + currentR * Math.cos(end), y2 = cy + currentR * Math.sin(end);
    const x3 = cx + r * Math.cos(end), y3 = cy + r * Math.sin(end);
    const x4 = cx + r * Math.cos(start), y4 = cy + r * Math.sin(start);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M${x1},${y1} A${currentR},${currentR} 0 ${large},1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large},0 ${x4},${y4} Z`;
    return { ...d, path, pct: Math.round(d.value / total * 100) };
  });

  return (
    <View style={{
      backgroundColor: P.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: P.border,
      shadowColor: '#000', shadowOpacity: 0.02, elevation: 1, flex: 1, minWidth: 280, marginBottom: 16
    }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: P.text }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 11, color: P.textDim, marginBottom: 10 }}>{subtitle}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          {arcs.map((a, i) => (
            <Path key={i} d={a.path} fill={a.color} opacity={hovered === null || hovered === i ? 1 : 0.6}
              //@ts-ignore
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onPress={() => setHovered(i)} />
          ))}
          <Circle cx={cx} cy={cy} r={r - 2} fill={P.white} />
          <SvgText x={cx} y={cy - 2} textAnchor="middle" fontSize={18} fontWeight="bold" fill={P.text}>
            {hovered !== null ? data[hovered].value : total}
          </SvgText>
          <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill={P.textDim}>
            {hovered !== null ? data[hovered].label : 'Total'}
          </SvgText>
        </Svg>
        <View style={{ flex: 1, gap: 6 }}>
          {arcs.map((a, i) => (
            <TouchableOpacity key={i} 
              //@ts-ignore
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: hovered === null || hovered === i ? 1 : 0.4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.color }} />
              <Text style={{ fontSize: 11, color: P.text, flex: 1 }} numberOfLines={1}>{a.label}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: P.text }}>{a.pct}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

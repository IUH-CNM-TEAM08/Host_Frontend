import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';

interface LineChartProps {
  data: { date: string; count: number }[];
  P: any;
  at: (vi: string, en: string) => string;
}

export function LineChart({ data, P, at }: LineChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  
  if (!data || data.length === 0) return null;

  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const onLayout = (event: any) => {
    setContainerWidth(event.nativeEvent.layout.width - 40); // Subtract horizontal padding
  };

  const maxCount = Math.max(...data.map(d => d.count), 5);
  const chartWidth = containerWidth > 0 ? containerWidth - paddingLeft - paddingRight : 0;
  const chartHeight = height - paddingTop - paddingBottom;

  if (containerWidth === 0) {
    return <View onLayout={onLayout} style={{ height, marginTop: 20 }} />;
  }

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.count / maxCount) * chartHeight;
    return { x, y };
  });

  const d = points.reduce((acc, p, i) => 
    i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, 
  "");

  const fillD = `${d} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <View onLayout={onLayout} style={{ backgroundColor: P.white, borderRadius: 16, padding: 20, marginTop: 20, borderWidth: 1, borderColor: P.border, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: P.text }}>
            {at('Tăng trưởng người dùng','User Growth')}
          </Text>
          <Text style={{ fontSize: 12, color: P.textDim }}>{at('30 ngày gần nhất','Last 30 days')}</Text>
        </View>
        <View style={{ backgroundColor: P.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: P.primary }}>+{data.reduce((a,b)=>a+b.count, 0)}</Text>
        </View>
      </View>
      
      <Svg width={containerWidth} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.primary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={P.primary} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Y Axis Grid & Labels */}
        {[0, 0.5, 1].map((p, i) => {
          const val = Math.round(p * maxCount);
          const yPos = paddingTop + chartHeight - p * chartHeight;
          return (
            <React.Fragment key={i}>
              <Rect x={paddingLeft} y={yPos} width={chartWidth} height={1} fill={P.borderLight} />
              <SvgText x={paddingLeft - 10} y={yPos + 4} fontSize="10" fill={P.textDim} textAnchor="end">{val}</SvgText>
            </React.Fragment>
          );
        })}

        {/* Area Fill */}
        <Path d={fillD} fill="url(#grad)" />

        {/* Main Line */}
        <Path d={d} fill="none" stroke={P.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data Points & X Axis Labels */}
        {points.map((p, i) => {
          const showLabel = i % 7 === 0 || i === points.length - 1;
          return (
            <React.Fragment key={i}>
              {showLabel && (
                <>
                  <Circle cx={p.x} cy={p.y} r={4} fill={P.white} stroke={P.primary} strokeWidth={2} />
                  <SvgText 
                    x={p.x} y={height - 10} 
                    fontSize="9" fill={P.textDim} 
                    textAnchor="middle"
                  >
                    {data[i].date.split('-').slice(1).reverse().join('/')}
                  </SvgText>
                </>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

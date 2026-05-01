import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  bgColor: string;
  P: any;
  trend?: { value: number; isUp: boolean };
}

export function StatCard({ title, value, icon, color, bgColor, P, trend }: StatCardProps) {
  const isWide = Dimensions.get('window').width > 800;
  
  return (
    <View style={{
      width: isWide ? '23.8%' : '48%',
      marginRight: '1.2%',
      marginBottom: 16,
      backgroundColor: P.white,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: P.border,
      shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        {trend && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: trend.isUp ? P.successBg : P.dangerBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
            <Ionicons name={trend.isUp ? 'trending-up' : 'trending-down'} size={12} color={trend.isUp ? P.success : P.danger} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: trend.isUp ? P.success : P.danger, marginLeft: 2 }}>{trend.value}%</Text>
          </View>
        )}
      </View>
      
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 12, color: P.textSec, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: P.text, marginTop: 4 }}>{value.toLocaleString()}</Text>
      </View>
    </View>
  );
}

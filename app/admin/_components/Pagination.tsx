import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  P: any;
  at: (vi: string, en: string) => string;
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange, P, at }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(0, currentPage - 2);
    let end = Math.min(totalPages - 1, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(0, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <TouchableOpacity 
          key={i} 
          onPress={() => onPageChange(i)}
          style={{
            width: 32, height: 32, borderRadius: 8,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: i === currentPage ? P.primary : P.white,
            borderWidth: 1, borderColor: i === currentPage ? P.primary : P.border
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: i === currentPage ? '#fff' : P.text }}>{i + 1}</Text>
        </TouchableOpacity>
      );
    }
    return pages;
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity 
          onPress={() => onPageChange(0)} 
          disabled={currentPage === 0}
          style={{ padding: 6, opacity: currentPage === 0 ? 0.3 : 1 }}
        >
          <Ionicons name="play-back" size={18} color={P.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 0}
          style={{ padding: 6, opacity: currentPage === 0 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-back" size={18} color={P.primary} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {renderPageNumbers()}
        </View>

        <TouchableOpacity 
          onPress={() => onPageChange(currentPage + 1)} 
          disabled={currentPage >= totalPages - 1}
          style={{ padding: 6, opacity: currentPage >= totalPages - 1 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-forward" size={18} color={P.primary} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => onPageChange(totalPages - 1)} 
          disabled={currentPage >= totalPages - 1}
          style={{ padding: 6, opacity: currentPage >= totalPages - 1 ? 0.3 : 1 }}
        >
          <Ionicons name="play-forward" size={18} color={P.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 12, color: P.textSec }}>
          {at('Trang','Page')} {currentPage + 1} / {totalPages} ({totalItems} {at('bản ghi','records')})
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 12, color: P.textDim }}>{at('Đến:','Go to:')}</Text>
          <TextInput
            style={{ 
              width: 40, height: 28, borderWidth: 1, borderColor: P.border, 
              borderRadius: 6, textAlign: 'center', fontSize: 12, backgroundColor: P.white, color: P.text 
            }}
            keyboardType="numeric"
            onSubmitEditing={(e) => {
              const p = parseInt(e.nativeEvent.text) - 1;
              if (p >= 0 && p < totalPages) onPageChange(p);
            }}
          />
        </View>
      </View>
    </View>
  );
}

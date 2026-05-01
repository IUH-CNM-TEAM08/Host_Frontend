import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DataTableProps {
  columns: any[];
  data: any[];
  loading: boolean;
  P: any;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export function DataTable({ columns, data, loading, P, selectable, selectedIds = [], onSelectionChange }: DataTableProps) {
  if (loading) return <ActivityIndicator size="large" color={P.primary} style={{ marginTop: 50 }} />;
  if (!data.length) return (
    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
      <Ionicons name="file-tray-outline" size={48} color={P.textDim} />
      <Text style={{ color: P.textDim, marginTop: 12, fontSize: 14 }}>No data found</Text>
    </View>
  );

  const toggleAll = () => {
    if (selectedIds.length === data.length) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(data.map(d => d.id || d._id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange?.(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange?.([...selectedIds, id]);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: P.borderLight, borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center' }}>
        {selectable && (
          <TouchableOpacity onPress={toggleAll} style={{ width: 40 }}>
            <Ionicons 
              name={selectedIds.length === data.length ? "checkbox" : "square-outline"} 
              size={20} 
              color={selectedIds.length > 0 ? P.primary : P.textDim} 
            />
          </TouchableOpacity>
        )}
        {columns.map((c: any) => (
          <Text key={c.key} style={{ flex: c.flex || 1, fontSize: 11, fontWeight: '700', color: P.textSec, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {c.title}
          </Text>
        ))}
      </View>
      {data.map((row: any, i: number) => {
        const id = row.id || row._id;
        const isSelected = selectedIds.includes(id);
        return (
          <View key={id || i} style={{ flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: P.borderLight, backgroundColor: isSelected ? P.primaryBg : P.white, alignItems: 'center' }}>
            {selectable && (
              <TouchableOpacity onPress={() => toggleOne(id)} style={{ width: 40 }}>
                <Ionicons 
                  name={isSelected ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={isSelected ? P.primary : P.textDim} 
                />
              </TouchableOpacity>
            )}
            {columns.map((c: any) => (
              <View key={c.key} style={{ flex: c.flex || 1, justifyContent: 'center' }}>
                {c.render ? c.render(row[c.key], row) : (
                  <Text style={{ fontSize: 13, color: P.text }} numberOfLines={1}>
                    {String(row[c.key] ?? '—')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

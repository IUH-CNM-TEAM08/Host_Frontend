import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions,
} from 'react-native';

interface LiveRegulationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LiveRegulationsModal({ visible, onClose }: LiveRegulationsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quy Định Live Stream</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* VIP Tiers */}
            <Text style={styles.sectionTitle}>Các Hạng VIP</Text>

            <View style={[styles.tierCard, { borderColor: '#6b7280' }]}>  
              <View style={styles.tierHeader}>
                <Text style={[styles.tierBadge, { backgroundColor: '#6b7280' }]}>VIP0</Text>
                <Text style={styles.tierPrice}>Miễn phí</Text>
              </View>
              <Text style={styles.tierName}>Cơ bản</Text>
              <Text style={styles.tierDesc}>• Live tối đa <Text style={styles.bold}>5 phút</Text> mỗi lần</Text>
              <Text style={styles.tierDesc}>• Mặc định cho tất cả người dùng</Text>
            </View>

            <View style={[styles.tierCard, { borderColor: '#f59e0b' }]}>
              <View style={styles.tierHeader}>
                <Text style={[styles.tierBadge, { backgroundColor: '#7c3aed' }]}>VIP1</Text>
                <Text style={styles.tierPrice}>2.000 đ / tháng</Text>
              </View>
              <Text style={styles.tierName}>VIP 1</Text>
              <Text style={styles.tierDesc}>• Live tối đa <Text style={styles.bold}>30 phút</Text> mỗi lần</Text>
              <Text style={styles.tierDesc}>• Thời hạn 30 ngày kể từ ngày nạp</Text>
            </View>

            <View style={[styles.tierCard, { borderColor: '#ef4444' }]}>
              <View style={styles.tierHeader}>
                <Text style={[styles.tierBadge, { backgroundColor: '#7c3aed' }]}>VIP2</Text>
                <Text style={styles.tierPrice}>4.000 đ / tháng</Text>
              </View>
              <Text style={styles.tierName}>VIP 2</Text>
              <Text style={styles.tierDesc}>• <Text style={styles.bold}>Không giới hạn</Text> thời gian live</Text>
              <Text style={styles.tierDesc}>• Thời hạn 30 ngày kể từ ngày nạp</Text>
            </View>

            {/* Quy tắc */}
            <Text style={styles.sectionTitle}>Quy Tắc Cộng Đồng</Text>
            <View style={styles.ruleCard}>
              <Text style={styles.ruleText}>1. Không phát nội dung vi phạm pháp luật, đồi trụy, bạo lực.</Text>
              <Text style={styles.ruleText}>2. Tôn trọng người xem, không xúc phạm, quấy rối.</Text>
              <Text style={styles.ruleText}>3. Không spam, quảng cáo trái phép trong phòng live.</Text>
              <Text style={styles.ruleText}>4. Nội dung phải phù hợp với thuần phong mỹ tục Việt Nam.</Text>
              <Text style={styles.ruleText}>5. Vi phạm có thể bị cấm live vĩnh viễn.</Text>
            </View>

            {/* Lưu ý */}
            <Text style={styles.sectionTitle}>Lưu Ý</Text>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>• Khi gần hết thời gian live, hệ thống sẽ cảnh báo trước <Text style={styles.bold}>1 phút</Text>.</Text>
              <Text style={styles.noteText}>• Khi hết thời gian, phòng live sẽ tự động dừng và hiển thị gợi ý nâng cấp VIP.</Text>
              <Text style={styles.noteText}>• Gói VIP có thể gia hạn bất cứ lúc nào, thời gian sẽ được cộng dồn.</Text>
              <Text style={styles.noteText}>• Thanh toán qua chuyển khoản ngân hàng (SePay), xử lý tự động.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');
const modalWidth = Math.min(width - 40, 500);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: modalWidth,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
    backgroundColor: '#faf5ff',
  },
  headerTitle: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    padding: 18,
  },
  sectionTitle: {
    color: '#4c1d95',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
  },
  tierCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierBadge: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tierPrice: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '700',
  },
  tierName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  tierDesc: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 2,
  },
  bold: {
    fontWeight: '700',
    color: '#111827',
  },
  ruleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ruleText: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 4,
  },
  noteCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  noteText: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 4,
  },
});

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions,
  ActivityIndicator, Image, Linking, Platform,
} from 'react-native';
import axios from 'axios';
import { URL_BE } from '@/src/constants/ApiConstant';

interface VipTier {
  _id: string;
  name: string;
  price: number;
  durationDays: number;
  maxLiveMinutes: number;
  description: string;
  color: string;
  icon: string;
  order: number;
}

interface VipPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  accountId: string;
  currentTier?: string;
}

const BANK_NAME = 'MB';
const ACCOUNT_NUMBER = '0326829327';
const ACCOUNT_NAME = 'TRAN CONG TINH';

export default function VipPurchaseModal({ visible, onClose, accountId, currentTier = 'VIP0' }: VipPurchaseModalProps) {
  const [tiers, setTiers] = useState<VipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<VipTier | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedTier(null);
      return;
    }
    const fetchTiers = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${URL_BE}/api/payment/vip-tiers`);
        if (res.data?.success) {
          setTiers(res.data.tiers || []);
        }
      } catch (err) {
        console.error('Lỗi lấy danh sách VIP:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTiers();
  }, [visible]);

  const getTransferContent = (tierId: string) => {
    return `ZALAVIP ${tierId} ${accountId}`;
  };

  const getQRUrl = (tier: VipTier) => {
    const content = getTransferContent(tier._id);
    // SePay / VietQR QR code URL
    return `https://qr.sepay.vn/img?acc=${ACCOUNT_NUMBER}&bank=${BANK_NAME}&amount=${tier.price}&des=${encodeURIComponent(content)}&template=compact`;
  };

  const handleSelectTier = (tier: VipTier) => {
    setSelectedTier(tier);
  };

  const handleBack = () => {
    setSelectedTier(null);
  };

  const renderTierList = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>Chọn gói VIP để nâng cấp trải nghiệm live stream</Text>

      {tiers.filter(t => t._id !== 'VIP0').map(tier => {
        const isCurrent = currentTier === tier._id;
        return (
          <TouchableOpacity
            key={tier._id}
            style={[
              styles.tierCard,
              { borderColor: '#7c3aed' },
              isCurrent && { backgroundColor: '#faf5ff' },
            ]}
            onPress={() => handleSelectTier(tier)}
          >
            <View style={styles.tierHeader}>
              <View style={styles.tierBadgeRow}>
                <Text style={[styles.tierBadge, { backgroundColor: '#7c3aed' }]}>
                  {tier._id}
                </Text>
                {isCurrent && (
                  <Text style={styles.currentBadge}>Đang dùng</Text>
                )}
              </View>
              <Text style={styles.tierPrice}>
                {tier.price.toLocaleString('vi-VN')} đ
                <Text style={styles.tierPriceSub}> / tháng</Text>
              </Text>
            </View>
            <Text style={styles.tierName}>{tier.name}</Text>
            <Text style={styles.tierDesc}>{tier.description}</Text>
            <View style={styles.selectBtn}>
              <Text style={styles.selectBtnText}>{isCurrent ? 'Gia hạn gói này' : 'Nâng cấp gói này'}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.noteText}>
        Thanh toán qua chuyển khoản ngân hàng. Hệ thống xử lý tự động trong vài phút.
      </Text>
    </ScrollView>
  );

  const renderPaymentDetail = () => {
    if (!selectedTier) return null;
    const transferContent = getTransferContent(selectedTier._id);
    const qrUrl = getQRUrl(selectedTier);

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>← Quay lại</Text>
        </TouchableOpacity>

        <View style={[styles.selectedTierCard, { borderColor: '#7c3aed' }]}>
          <Text style={[styles.tierBadge, { backgroundColor: '#7c3aed', alignSelf: 'flex-start' }]}>
            {selectedTier._id}
          </Text>
          <Text style={styles.selectedTierName}>{selectedTier.name}</Text>
          <Text style={styles.selectedTierPrice}>
            {selectedTier.price.toLocaleString('vi-VN')} VND
          </Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <Text style={styles.qrTitle}>Quét mã QR để thanh toán</Text>
          <View style={styles.qrContainer}>
            <Image
              source={{ uri: qrUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Bank info */}
        <View style={styles.bankInfoCard}>
          <Text style={styles.bankInfoTitle}>Thông tin chuyển khoản</Text>
          <View style={styles.bankInfoRow}>
            <Text style={styles.bankInfoLabel}>Ngân hàng:</Text>
            <Text style={styles.bankInfoValue}>{BANK_NAME}</Text>
          </View>
          <View style={styles.bankInfoRow}>
            <Text style={styles.bankInfoLabel}>Số tài khoản:</Text>
            <Text style={[styles.bankInfoValue, styles.bankInfoHighlight]}>{ACCOUNT_NUMBER}</Text>
          </View>
          <View style={styles.bankInfoRow}>
            <Text style={styles.bankInfoLabel}>Tên chủ TK:</Text>
            <Text style={styles.bankInfoValue}>{ACCOUNT_NAME}</Text>
          </View>
          <View style={styles.bankInfoRow}>
            <Text style={styles.bankInfoLabel}>Số tiền:</Text>
            <Text style={[styles.bankInfoValue, styles.bankInfoHighlight]}>
              {selectedTier.price.toLocaleString('vi-VN')} VND
            </Text>
          </View>
          <View style={styles.bankInfoRow}>
            <Text style={styles.bankInfoLabel}>Nội dung CK:</Text>
            <Text style={[styles.bankInfoValue, styles.bankInfoHighlight]} selectable>
              {transferContent}
            </Text>
          </View>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            Vui lòng nhập <Text style={styles.bold}>chính xác</Text> nội dung chuyển khoản để hệ thống tự động xác nhận.
          </Text>
          <Text style={styles.warningText}>
            Sau khi chuyển khoản thành công, hệ thống sẽ tự động cập nhật VIP <Text style={styles.bold}>ngay lập tức</Text>.
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {selectedTier ? 'Thanh Toán' : 'Nâng Cấp VIP'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={styles.loadingText}>Đang tải...</Text>
            </View>
          ) : selectedTier ? renderPaymentDetail() : renderTierList()}
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');
const modalWidth = Math.min(width - 32, 480);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: modalWidth,
    maxHeight: '90%',
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
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  tierCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 2,
  },
  tierCardCurrent: {
    opacity: 0.6,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  currentBadge: {
    color: '#6d28d9',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tierPrice: {
    color: '#6d28d9',
    fontSize: 16,
    fontWeight: '700',
  },
  tierPriceSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  tierName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  tierDesc: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  selectBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  noteText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    marginTop: 12,
    fontSize: 14,
  },

  // Payment detail
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedTierCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 18,
  },
  selectedTierName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  selectedTierPrice: {
    color: '#7c3aed',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  qrTitle: {
    color: '#4c1d95',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  bankInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 14,
  },
  bankInfoTitle: {
    color: '#4c1d95',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  bankInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bankInfoLabel: {
    color: '#6b7280',
    fontSize: 13,
  },
  bankInfoValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  bankInfoHighlight: {
    color: '#7c3aed',
  },
  warningCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  warningText: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
    color: '#6d28d9',
  },
});

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Image, Modal, TextInput, Alert, ScrollView, Platform,
} from "react-native";
import { billingService } from "@/src/api/services/billing.service";
import Toast from "@/src/components/ui/Toast";
import { useTranslation } from "@/src/contexts/i18n/I18nContext";
import { UserStorage } from "@/src/storage/UserStorage";
import SocketService from "@/src/api/socketCompat";

const BANK_NAME = 'MB';
const ACCOUNT_NUMBER = '0326829327';
const ACCOUNT_NAME = 'TRAN CONG TINH';
const COIN_RATE = 100; // 1 xu = 100 VND

const PACKAGES = [
  { coin: 10, vnd: 1000 },
  { coin: 50, vnd: 5000 },
  { coin: 100, vnd: 10000 },
  { coin: 500, vnd: 50000 },
  { coin: 1000, vnd: 100000 },
  { coin: 5000, vnd: 500000 },
];

export default function WalletScreen() {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [walletRes, txRes] = await Promise.all([
        billingService.getWallet(),
        billingService.getTransactions()
      ]);
      setWallet((walletRes as any)?.data?.data || (walletRes as any)?.data);
      setTransactions((txRes as any)?.data?.data || (txRes as any)?.data || []);
    } catch (err: any) {
      setToast({ visible: true, message: "Lỗi tải thông tin ví", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Lấy accountId từ UserStorage
  useEffect(() => {
    UserStorage.getUser().then(user => {
      if (user) {
        setAccountId(user.id || user.accountId || '');
      }
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Lắng nghe socket event coin_deposited → cập nhật realtime
  useEffect(() => {
    const socket = SocketService.getInstance();

    const handleCoinDeposited = (data: { balance: number; coinAmount: number; transactionId: string }) => {
      // Cập nhật wallet balance ngay lập tức
      setWallet((prev: any) => prev ? { ...prev, balance: data.balance } : { balance: data.balance });

      // Đóng modal QR
      setShowQR(false);
      setDepositModalVisible(false);
      setAmountInput("");

      // Hiển thị thông báo thành công
      setToast({ visible: true, message: `Nạp thành công ${data.coinAmount} xu!`, type: 'success' });

      // Refresh lại danh sách giao dịch
      fetchData();
    };

    socket.onCoinDeposited(handleCoinDeposited);

    return () => {
      socket.removeCoinDepositedListener(handleCoinDeposited);
    };
  }, []);

  const coinAmount = parseInt(amountInput, 10) || 0;
  const amountVND = coinAmount * COIN_RATE;

  const getTransferContent = () => {
    return `ZALAXU ${coinAmount} ${accountId}`;
  };

  const getQRUrl = () => {
    const content = getTransferContent();
    return `https://qr.sepay.vn/img?acc=${ACCOUNT_NUMBER}&bank=${BANK_NAME}&amount=${amountVND}&des=${encodeURIComponent(content)}&template=compact`;
  };

  const handleProceedToPayment = () => {
    if (isNaN(coinAmount) || coinAmount < 10) {
      setToast({ visible: true, message: "Số xu nạp tối thiểu là 10", type: 'error' });
      return;
    }
    if (!accountId) {
      setToast({ visible: true, message: "Không tìm thấy thông tin tài khoản", type: 'error' });
      return;
    }
    setShowQR(true);
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <View style={[styles.txItem, isWeb ? styles.txItemWeb : styles.txItemApp]}>
        <View style={styles.txLeft}>
          <Text style={[styles.txType, isWeb ? styles.txTypeWeb : styles.txTypeApp]}>{item.type.toUpperCase()}</Text>
          <Text style={styles.txDate}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, isWeb ? styles.txAmountWeb : styles.txAmountApp, item.type === 'deposit' || item.type === 'receive' ? styles.txPositive : styles.txNegative]}>
            {item.type === 'deposit' || item.type === 'receive' ? '+' : '-'}{item.coinAmount} xu
          </Text>
          <Text style={styles.txStatus}>{item.status}</Text>
        </View>
      </View>
    );
  };

  if (loading && !wallet) {
    return <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  // ── Nội dung modal: Chọn gói xu ──
  const renderSelectPackage = () => (
    <>
      <Text style={[styles.modalTitle, isWeb && styles.modalTitleWeb]}>Nạp Xu</Text>

      <TextInput
        style={styles.input}
        placeholder="Nhập số xu muốn nạp..."
        keyboardType="numeric"
        value={amountInput}
        onChangeText={setAmountInput}
      />

      <View style={styles.packagesContainer}>
        <Text style={styles.packagesTitle}>Hoặc chọn gói nạp nhanh:</Text>
        <View style={[styles.packagesGrid, isWeb && styles.packagesGridWeb]}>
          {PACKAGES.map((pkg, idx) => (
            <Pressable
              key={idx}
              style={[styles.packageCard, isWeb && styles.packageCardWeb, amountInput === pkg.coin.toString() && styles.packageCardActive]}
              onPress={() => setAmountInput(pkg.coin.toString())}
            >
              <Text style={[
                styles.packageCoin,
                amountInput === pkg.coin.toString() && { color: '#fff' }
              ]}>
                {pkg.coin} Xu
              </Text>
              <Text style={[
                styles.packageVnd,
                amountInput === pkg.coin.toString() && { color: '#e0e7ff' }
              ]}>
                {pkg.vnd.toLocaleString('vi-VN')}đ
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.rowBtn}>
        <Pressable style={[styles.btn, { backgroundColor: '#94a3b8' }]} onPress={() => { setDepositModalVisible(false); setAmountInput(""); }}>
          <Text style={styles.btnText}>Hủy</Text>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: '#4f46e5' }]} onPress={handleProceedToPayment}>
          <Text style={styles.btnText}>Tiếp tục</Text>
        </Pressable>
      </View>
    </>
  );

  // ── Nội dung modal: QR Code SePay ──
  const renderQRPayment = () => {
    const transferContent = getTransferContent();
    const qrUrl = getQRUrl();

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => setShowQR(false)}>
          <Text style={styles.backBtnText}>← Quay lại</Text>
        </Pressable>

        {/* Gói đã chọn */}
        <View style={styles.selectedPackageCard}>
          <Text style={[styles.selectedPackageCoin, isWeb && styles.selectedPackageCoinWeb]}>{coinAmount} Xu</Text>
          <Text style={styles.selectedPackageVnd}>{amountVND.toLocaleString('vi-VN')} VND</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <Text style={styles.qrTitle}>Quét mã QR để thanh toán</Text>
          <View style={styles.qrContainer}>
            <Image
              source={{ uri: qrUrl }}
              style={[styles.qrImage, isWeb && styles.qrImageWeb]}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Thông tin chuyển khoản */}
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
              {amountVND.toLocaleString('vi-VN')} VND
            </Text>
          </View>
          <View style={styles.bankInfoRow}>
            <Text style={styles.bankInfoLabel}>Nội dung CK:</Text>
            <Text style={[styles.bankInfoValue, styles.bankInfoHighlight]} selectable>
              {transferContent}
            </Text>
          </View>
        </View>

        {/* Cảnh báo */}
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            Vui lòng nhập <Text style={styles.bold}>chính xác</Text> nội dung chuyển khoản để hệ thống tự động xác nhận.
          </Text>
          <Text style={styles.warningText}>
            Sau khi chuyển khoản thành công, xu sẽ được cộng <Text style={styles.bold}>ngay lập tức</Text>.
          </Text>
        </View>

        {/* Trạng thái chờ */}
        <View style={styles.waitingCard}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={styles.waitingText}>Đang chờ thanh toán...</Text>
          <Text style={styles.waitingSubText}>Hệ thống sẽ tự động cập nhật khi nhận được giao dịch</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, isWeb ? styles.containerWeb : styles.containerApp]}>
      <View style={[styles.contentWrap, isWeb && styles.contentWrapWeb]}>
      <View style={[styles.header, isWeb ? styles.headerWeb : styles.headerApp]}>
        <Text style={styles.title}>Ví của tôi</Text>
        <Text style={styles.balance}>{wallet?.balance || 0} Xu</Text>
        <Pressable style={styles.btnDeposit} onPress={() => setDepositModalVisible(true)}>
          <Text style={styles.btnText}>Nạp xu</Text>
        </Pressable>
      </View>

      <Text style={[styles.subTitle, isWeb && styles.subTitleWeb]}>Lịch sử giao dịch</Text>
      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
        style={isWeb ? styles.listWeb : undefined}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>Chưa có giao dịch nào</Text>}
      />
      </View>

      <Modal visible={depositModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isWeb && styles.modalContentWeb]}>
            {showQR ? renderQRPayment() : renderSelectPackage()}
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  containerWeb: { paddingVertical: 20, paddingHorizontal: 24 },
  containerApp: { padding: 16 },
  contentWrap: { flex: 1, width: '100%' },
  contentWrapWeb: { maxWidth: 980, alignSelf: 'center' },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#eceffd',
  },
  headerWeb: { paddingVertical: 24, borderRadius: 18 },
  headerApp: { paddingVertical: 20, borderRadius: 14 },
  title: { fontSize: 16, color: '#6b7280', fontWeight: '600' },
  balance: { fontSize: 44, fontWeight: '800', color: '#2563eb', marginVertical: 8, letterSpacing: 0.2 },
  btnDeposit: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, minWidth: 88, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  subTitle: { fontSize: 34, fontWeight: '800', marginBottom: 12, color: '#111827' },
  subTitleWeb: { marginTop: 2 },
  listWeb: { width: '100%' },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef1f7',
  },
  txItemWeb: { paddingVertical: 15 },
  txItemApp: { paddingVertical: 12 },
  txLeft: { flex: 1 },
  txRight: { alignItems: 'flex-end' },
  txType: { fontWeight: '800', fontSize: 18, color: '#111827' },
  txTypeWeb: { fontSize: 34 },
  txTypeApp: { fontSize: 17 },
  txDate: { color: '#9ca3af', fontSize: 12, marginTop: 4 },
  txAmount: { fontWeight: '800', fontSize: 20 },
  txAmountWeb: { fontSize: 42 },
  txAmountApp: { fontSize: 20 },
  txPositive: { color: '#4CAF50' },
  txNegative: { color: '#F44336' },
  txStatus: { color: '#9ca3af', fontSize: 12, marginTop: 4 },

  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.35)' },
  modalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 18,
    marginVertical: 12,
    padding: 22,
    borderRadius: 18,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#eceffd',
  },
  modalContentWeb: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 14, textAlign: 'center', color: '#111827' },
  modalTitleWeb: { fontSize: 24, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fafaff',
    color: '#111827',
  },
  packagesContainer: { marginBottom: 24 },
  packagesTitle: { fontSize: 14, color: '#6b7280', marginBottom: 12, fontWeight: '600' },
  packagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  packagesGridWeb: { gap: 10 },
  packageCard: {
    width: '48%',
    backgroundColor: '#f8f7ff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9e5ff',
    marginBottom: 8,
  },
  packageCardWeb: { width: '48.8%' },
  packageCardActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  packageCoin: { fontSize: 16, fontWeight: '800', color: '#334155' },
  packageVnd: { fontSize: 12, color: '#64748b', marginTop: 4 },
  rowBtn: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },

  // QR Payment styles
  backBtnText: { color: '#6d28d9', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  selectedPackageCard: {
    backgroundColor: '#fafaff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    marginBottom: 18,
  },
  selectedPackageCoin: { fontSize: 30, fontWeight: '800', color: '#111827' },
  selectedPackageCoinWeb: { fontSize: 32 },
  selectedPackageVnd: { fontSize: 15, fontWeight: '700', color: '#4338ca', marginTop: 4 },
  qrSection: { alignItems: 'center', marginBottom: 18 },
  qrTitle: { color: '#111827', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  qrContainer: { backgroundColor: '#fff', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ece8ff' },
  qrImage: { width: 220, height: 220 },
  qrImageWeb: { width: 230, height: 230 },
  bankInfoCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ece8ff',
    marginBottom: 14,
  },
  bankInfoTitle: { color: '#111827', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  bankInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bankInfoLabel: { color: '#6b7280', fontSize: 13 },
  bankInfoValue: { color: '#111827', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  bankInfoHighlight: { color: '#4338ca' },
  warningCard: {
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 14,
  },
  warningText: { color: '#854d0e', fontSize: 12, lineHeight: 20, marginBottom: 4 },
  bold: { fontWeight: '700' },
  waitingCard: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  waitingText: { color: '#6d28d9', fontSize: 14, fontWeight: '700', marginTop: 8 },
  waitingSubText: { color: '#8b5cf6', fontSize: 12, marginTop: 4, textAlign: 'center' },
});

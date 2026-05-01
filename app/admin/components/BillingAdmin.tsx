import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminService } from '@/src/api/services/admin.service';
import { uploadMediaToS3 } from '@/src/api/services/media.service';
import { StatCard } from '../_components/StatCard';
import { DataTable } from '../_components/DataTable';
import { ActionModal } from '../_components/ActionModal';

export default function BillingAdmin({ P, at, setToast }: any) {
  const [billingTab, setBillingTab] = useState<'overview' | 'gifts' | 'transactions'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [gifts, setGifts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any>({ visible: false, type: 'confirm' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [uploadingField, setUploadingField] = useState<'iconUrl' | 'animationUrl' | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (billingTab === 'overview') {
        const res = await adminService.getBillingStats();
        setStats(res.data || res);
      } else if (billingTab === 'gifts') {
        const res = await adminService.getGifts();
        setGifts(res.data || res);
      } else if (billingTab === 'transactions') {
        const res = await adminService.getTransactions({ page, limit: 20 });
        const d = res.data || res;
        setTransactions(d.items || d);
        setTotal(d.total || 0);
      }
    } catch (e) {
      console.error(e);
      setToast({ visible: true, message: 'Lỗi tải dữ liệu', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [billingTab, page]);

  const handleCreateGift = async () => {
    try {
      if (!modal.name || !modal.price || !modal.iconUrl) return alert("Vui lòng nhập đủ thông tin");
      await adminService.createGift({
        name: modal.name,
        price: Number(modal.price),
        iconUrl: modal.iconUrl,
        animationUrl: modal.animationUrl,
        status: modal.status || 'active'
      });
      setModal({ visible: false });
      setToast({ visible: true, message: 'Đã thêm quà tặng!', type: 'success' });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi thêm quà");
    }
  };

  const handleUpdateGift = async () => {
    try {
      await adminService.updateGift(modal.data._id, {
        name: modal.name,
        price: Number(modal.price),
        iconUrl: modal.iconUrl,
        animationUrl: modal.animationUrl,
        status: modal.status || 'active'
      });
      setModal({ visible: false });
      setToast({ visible: true, message: 'Đã cập nhật quà tặng!', type: 'success' });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Lỗi cập nhật quà");
    }
  };

  const handleDeleteGift = async (id: string) => {
    if (!window.confirm("Chắc chắn muốn xóa quà tặng này?")) return;
    try {
      await adminService.deleteGift(id);
      setToast({ visible: true, message: 'Đã xóa quà!', type: 'success' });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Lỗi xóa quà");
    }
  };

  const handleManualCoin = async () => {
    try {
      if (!modal.userId || !modal.amount) return alert("Nhập User ID và Số lượng xu");
      await adminService.manualCoinAdjust({
        userId: modal.userId,
        amount: Number(modal.amount),
        reason: modal.reason || 'Admin thao tác'
      });
      setModal({ visible: false });
      setToast({ visible: true, message: 'Thao tác thành công!', type: 'success' });
      if (billingTab === 'overview') loadData();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi cộng trừ xu");
    }
  };

  const handleGiftAssetUpload = async (field: 'iconUrl' | 'animationUrl', event: any) => {
    try {
      const file = event?.target?.files?.[0];
      if (!file) return;

      setUploadingField(field);
      const uploaded = await uploadMediaToS3([{
        uri: URL.createObjectURL(file),
        name: file.name || `${field}-${Date.now()}.png`,
        type: file.type || 'image/png',
        file,
      }]);

      const url = uploaded?.[0]?.url;
      if (!url) throw new Error('Không nhận được URL sau khi tải ảnh');

      setModal((prev: any) => ({ ...prev, [field]: url }));
      setToast({ visible: true, message: 'Tải ảnh thành công', type: 'success' });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Không thể tải ảnh lên');
    } finally {
      setUploadingField(null);
      if (event?.target) event.target.value = '';
    }
  };

  const Btn = ({ icon, label, color, onPress }: any) => (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: P.white, borderWidth: 1, borderColor: P.border }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ fontSize: 12, fontWeight: '600', color }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {['overview', 'gifts', 'transactions'].map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setBillingTab(t as any)}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
              backgroundColor: billingTab === t ? P.primary : P.white,
              borderWidth: 1, borderColor: billingTab === t ? P.primary : P.border
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: billingTab === t ? '#fff' : P.text }}>
              {t === 'overview' ? 'Tổng quan' : t === 'gifts' ? 'Quà tặng' : 'Giao dịch'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={P.primary} />
      ) : (
        <>
          {billingTab === 'overview' && stats && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: P.text }}>Thống kê Xu hệ thống</Text>
                <TouchableOpacity onPress={() => setModal({ visible: true, type: 'manual_coin' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Cộng / Trừ Xu</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <StatCard title="Tổng Xu Đang Lưu Hành" value={stats.totalCoins || 0} icon="wallet" color="#f59e0b" bgColor={P.warningBg} P={P} />
                <StatCard title="Số Ví Hệ Thống" value={stats.totalWallets || 0} icon="card" color={P.info} bgColor={P.infoBg} P={P} />
                <StatCard title="Tổng Giao Dịch" value={stats.totalTransactions || 0} icon="swap-horizontal" color={P.success} bgColor={P.successBg} P={P} />
              </View>
            </View>
          )}

          {billingTab === 'gifts' && (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: P.text }}>Danh sách Quà tặng</Text>
                <TouchableOpacity onPress={() => setModal({ visible: true, type: 'add_gift' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
                  <Ionicons name="gift" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Thêm quà mới</Text>
                </TouchableOpacity>
              </View>
              
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {gifts.map(g => (
                  <View key={g._id} style={{ width: 160, backgroundColor: P.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: P.border, alignItems: 'center' }}>
                    <Image source={{ uri: g.animationUrl || g.iconUrl }} style={{ width: 64, height: 64, marginBottom: 10 }} resizeMode="contain" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: P.text, marginBottom: 4 }}>{g.name}</Text>
                    <Text style={{ fontSize: 13, color: '#f59e0b', fontWeight: '700', marginBottom: 12 }}>{g.price} Xu</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => setModal({ visible: true, type: 'edit_gift', data: g, name: g.name, price: String(g.price), iconUrl: g.iconUrl, animationUrl: g.animationUrl, status: g.status })} style={{ padding: 6, backgroundColor: P.infoBg, borderRadius: 6 }}>
                        <Ionicons name="pencil" size={14} color={P.info} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteGift(g._id)} style={{ padding: 6, backgroundColor: P.dangerBg, borderRadius: 6 }}>
                        <Ionicons name="trash" size={14} color={P.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {billingTab === 'transactions' && (
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: P.text, marginBottom: 16 }}>Lịch sử giao dịch ({total})</Text>
              <DataTable
                data={transactions ?? []}
                columns={[
                  { key: 'userId', title: 'User ID', flex: 1.5, render: (v: string) => <Text style={{ fontSize: 12, color: P.textSec }}>{v ? v.substring(0,8) + '...' : '—'}</Text> },
                  { key: 'type', title: 'Loại', render: (v: string) => <Text style={{ fontSize: 12, fontWeight: '700', color: v === 'deposit' ? P.success : v === 'donate' ? P.danger : P.info }}>{(v || '').toUpperCase()}</Text> },
                  { key: 'coinAmount', title: 'Xu', render: (v: number, r: any) => <Text style={{ fontSize: 13, fontWeight: '700', color: r.type === 'donate' ? P.danger : P.success }}>{r.type === 'donate' ? '-' : '+'}{v}</Text> },
                  { key: 'createdAt', title: 'Thời gian', render: (v: string) => <Text style={{ fontSize: 12, color: P.textDim }}>{v ? new Date(v).toLocaleString() : '—'}</Text> },
                  { key: 'metadata', title: 'Ghi chú', flex: 2, render: (v: any) => <Text numberOfLines={1} style={{ fontSize: 11, color: P.textDim }}>{v ? JSON.stringify(v) : '—'}</Text> },
                ]}
                loading={loading}
                P={P}
              />
            </View>
          )}
        </>
      )}

      {/* Modals */}
      {modal.visible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <View style={{ backgroundColor: P.white, padding: 24, borderRadius: 16, width: 400, maxWidth: '90%' }}>
            {modal.type === 'add_gift' || modal.type === 'edit_gift' ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: P.text }}>{modal.type === 'add_gift' ? 'Thêm Quà Tặng' : 'Sửa Quà Tặng'}</Text>
                
                <Text style={{ fontSize: 13, color: P.textSec, marginBottom: 4 }}>Tên quà</Text>
                <TextInput style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, marginBottom: 12, color: P.text }} value={modal.name} onChangeText={t => setModal({ ...modal, name: t })} />
                
                <Text style={{ fontSize: 13, color: P.textSec, marginBottom: 4 }}>Giá (Xu)</Text>
                <TextInput style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, marginBottom: 12, color: P.text }} keyboardType="numeric" value={modal.price} onChangeText={t => setModal({ ...modal, price: t })} />
                
                <Text style={{ fontSize: 13, color: P.textSec, marginBottom: 4 }}>Icon URL</Text>
                <TextInput style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, marginBottom: 12, color: P.text }} value={modal.iconUrl} onChangeText={t => setModal({ ...modal, iconUrl: t })} />
                {Platform.OS === 'web' && (
                  <View style={{ marginBottom: 12 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, minWidth: 130, padding: '0 12px', borderRadius: 8, cursor: uploadingField ? 'not-allowed' : 'pointer', backgroundColor: '#ede9fe', color: '#6d28d9', fontSize: 12, fontWeight: 700, opacity: uploadingField ? 0.7 : 1 }}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={!!uploadingField}
                        onChange={(e) => handleGiftAssetUpload('iconUrl', e)}
                      />
                      {uploadingField === 'iconUrl' ? 'Đang tải ảnh...' : 'Tải ảnh icon'}
                    </label>
                    {!!modal.iconUrl && (
                      <View style={{ marginTop: 8, width: 60, height: 60, borderWidth: 1, borderColor: P.border, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                        <Image source={{ uri: modal.iconUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      </View>
                    )}
                  </View>
                )}
                
                <Text style={{ fontSize: 13, color: P.textSec, marginBottom: 4 }}>Animation URL (Không bắt buộc)</Text>
                <TextInput style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, marginBottom: 20, color: P.text }} value={modal.animationUrl} onChangeText={t => setModal({ ...modal, animationUrl: t })} />
                {Platform.OS === 'web' && (
                  <View style={{ marginBottom: 20 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, minWidth: 148, padding: '0 12px', borderRadius: 8, cursor: uploadingField ? 'not-allowed' : 'pointer', backgroundColor: '#f5f3ff', color: '#6d28d9', fontSize: 12, fontWeight: 700, opacity: uploadingField ? 0.7 : 1 }}>
                      <input
                        type="file"
                        accept="image/*,video/*,.gif,.webp"
                        style={{ display: 'none' }}
                        disabled={!!uploadingField}
                        onChange={(e) => handleGiftAssetUpload('animationUrl', e)}
                      />
                      {uploadingField === 'animationUrl' ? 'Đang tải tệp...' : 'Tải ảnh/animation'}
                    </label>
                    {!!modal.animationUrl && (
                      <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 12, color: P.textDim }}>
                        Đã chọn: {modal.animationUrl}
                      </Text>
                    )}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={() => setModal({ visible: false })} style={{ padding: 10 }}>
                    <Text style={{ color: P.textSec, fontWeight: '600' }}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={modal.type === 'add_gift' ? handleCreateGift : handleUpdateGift} style={{ backgroundColor: P.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Lưu</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : modal.type === 'manual_coin' ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: P.text }}>Cộng / Trừ Xu</Text>
                
                <Text style={{ fontSize: 13, color: P.textSec, marginBottom: 4 }}>User ID</Text>
                <TextInput style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, marginBottom: 12, color: P.text }} value={modal.userId} onChangeText={t => setModal({ ...modal, userId: t })} placeholder="Nhập User ID" />
                
                <Text style={{ fontSize: 13, color: P.textSec, marginBottom: 4 }}>Số lượng (+/-)</Text>
                <TextInput style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, marginBottom: 12, color: P.text }} keyboardType="numeric" value={modal.amount} onChangeText={t => setModal({ ...modal, amount: t })} placeholder="-50 hoặc 100" />
                
                <Text style={{ fontSize: 13, color: P.textSec, marginBottom: 4 }}>Lý do</Text>
                <TextInput style={{ borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, marginBottom: 20, color: P.text }} value={modal.reason} onChangeText={t => setModal({ ...modal, reason: t })} placeholder="Vd: Thưởng event" />

                <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={() => setModal({ visible: false })} style={{ padding: 10 }}>
                    <Text style={{ color: P.textSec, fontWeight: '600' }}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleManualCoin} style={{ backgroundColor: P.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Thực hiện</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

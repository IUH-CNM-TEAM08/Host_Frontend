import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView, Image, Platform, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from './Badge';

interface ActionModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'confirm' | 'prompt' | 'alert';
  mode?: 'default' | 'post' | 'user' | 'comments';
  inputValue?: string;
  onInputChange?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDeleteComment?: (id: string) => void;
  onWarnUser?: (userId: string, comment: string) => void;
  loading?: boolean;
  P: any;
  data?: Record<string, any>;
  comments?: any[];
}

const at = (vn: string, en: string) => vn;

export const ActionModal = ({
  visible, title, message, type = 'confirm', mode = 'default',
  inputValue, onInputChange, onConfirm, onCancel,
  onDeleteComment, onWarnUser, loading, P, data, comments = []
}: ActionModalProps) => {
  const isDark = P.white === '#1e293b';
  const [zoomImage, setZoomImage] = React.useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
  };

  const renderComments = () => (
    <View style={{ gap: 16 }}>
      {comments.length > 0 ? (
        comments.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: P.borderLight }}>
            <TouchableOpacity onPress={() => setZoomImage(c.author?.avatar || 'https://i.pravatar.cc/150')}>
              <Image source={{ uri: c.author?.avatar || 'https://i.pravatar.cc/150' }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: P.text }}>{c.author?.name || 'User'}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => onWarnUser?.(c.author?.id, c.content)} style={{ padding: 4 }}>
                    <Ionicons name="warning-outline" size={17} color={P.warning} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDeleteComment?.(c.id)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={17} color={P.danger} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: P.textSec, marginTop: 2 }}>{c.content}</Text>
              <Text style={{ fontSize: 11, color: P.textDim, marginTop: 4 }}>{formatDate(c.createdAt)}</Text>
            </View>
          </View>
        ))
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name="chatbox-ellipses-outline" size={40} color={P.border} />
          <Text style={{ color: P.textDim, marginTop: 12 }}>Chưa có bình luận nào</Text>
        </View>
      )}
    </View>
  );

  const renderPost = () => (
    <View style={{ gap: 12 }}>
      {data?.images?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {data.images.map((img: string, i: number) => (
            <TouchableOpacity key={i} onPress={() => setZoomImage(img)}>
              <Image source={{ uri: img }} style={{ width: 280, height: 200, borderRadius: 12, marginRight: 12 }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <Text style={{ fontSize: 15, lineHeight: 24, color: P.text }}>{data?.content}</Text>
      <View style={{ height: 1, backgroundColor: P.borderLight, marginVertical: 8 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: P.textDim }}>Tác giả: <Text style={{ fontWeight: '700', color: P.text }}>{data?.author?.name}</Text></Text>
        <Text style={{ color: P.textDim }}>Ngày đăng: <Text style={{ fontWeight: '700', color: P.text }}>{formatDate(data?.createdAt)}</Text></Text>
      </View>
    </View>
  );

  const renderUser = () => (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <TouchableOpacity onPress={() => setZoomImage(data?.avatar || 'https://i.pravatar.cc/150')}>
        <Image source={{ uri: data?.avatar || 'https://i.pravatar.cc/150' }} style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: P.borderLight }} />
      </TouchableOpacity>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: P.text }}>{data?.displayName || data?.name}</Text>
        <Text style={{ fontSize: 14, color: P.textSec }}>{data?.email || data?.phoneNumber}</Text>
      </View>
      <View style={{ width: '100%', gap: 12, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: P.bg, borderRadius: 12 }}>
          <Text style={{ color: P.textSec }}>Trạng thái</Text>
          <Badge text={data?.status || 'ACTIVE'} variant={data?.status === 'ACTIVE' ? 'success' : 'danger'} P={P} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: P.bg, borderRadius: 12 }}>
          <Text style={{ color: P.textSec }}>Ngày tham gia</Text>
          <Text style={{ fontWeight: '700', color: P.text }}>{formatDate(data?.createdAt)}</Text>
        </View>
      </View>
    </View>
  );

  const renderDefault = () => {
    const hideKeys = ['id', '_', 'password', 'conversationId', 'accountId', 'userId', 'ownerId', 'reporterId', 'targetId', 'postId', 'commentId', 'adminId', 'metadata'];
    const entries = Object.entries(data || {}).filter(([k]) => !hideKeys.some(s => k.toLowerCase() === s.toLowerCase() || k.startsWith('_')));

    const labelMap: any = {
      'adminName': at('Người thực hiện','Admin Name'),
      'action': at('Hành động','Action'),
      'targetType': at('Loại đối tượng','Target Type'),
      'targetName': at('Đối tượng','Target Name'),
      'details': at('Chi tiết thêm','Extra Details'),
      'createdAt': at('Thời gian','Time'),
      'amount': at('Số tiền','Amount'),
      'bankName': at('Ngân hàng','Bank'),
      'accountNumber': at('Số tài khoản','Account Number'),
      'accountName': at('Chủ tài khoản','Account Name'),
      'status': at('Trạng thái','Status'),
      'reason': at('Lý do','Reason'),
      'content': at('Nội dung','Content'),
      'email': at('Email','Email'),
      'phoneNumber': at('Số điện thoại','Phone'),
      'role': at('Vai trò','Role'),
      'displayName': at('Tên hiển thị','Name'),
      'type': at('Loại','Type'),
      'title': at('Tiêu đề','Title'),
      'message': at('Thông báo','Message'),
      'metadata': at('Dữ liệu đính kèm','Metadata'),
      'isRead': at('Trạng thái đọc','Is Read'),
    };

    const actionMap: any = {
      'APPROVE_OA': 'Phê duyệt OA', 'REJECT_OA': 'Từ chối OA', 'SUSPEND_OA': 'Tạm ngưng OA', 'DELETE_OA': 'Xóa OA',
      'LOCK_USER': 'Khóa tài khoản', 'UNLOCK_USER': 'Mở khóa tài khoản', 'WARN_USER': 'Cảnh báo',
      'DELETE_POST': 'Xóa bài viết', 'DELETE_COMMENT': 'Xóa bình luận', 'DISBAND_GROUP': 'Giải tán nhóm',
      'RESOLVE_REPORT': 'Xử lý báo cáo', 'APPROVE_WITHDRAWAL': 'Duyệt rút tiền', 'REJECT_WITHDRAWAL': 'Từ chối rút tiền',
      'LOGIN': 'Đăng nhập', 'BULK_LOCK_USERS': 'Khóa hàng loạt', 'BULK_DELETE_POSTS': 'Xóa bài viết hàng loạt'
    };

    return (
      <View style={{ gap: 2 }}>
        {entries.map(([k, v], i) => {
          let label = labelMap[k] || k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
          label = label.charAt(0).toUpperCase() + label.slice(1);
          
          let displayValue: any = v;

          // Special rendering for Image URLs
          if (typeof v === 'string' && (k.toLowerCase().includes('url') || k.toLowerCase().includes('picture') || k.toLowerCase().includes('avatar'))) {
            if (v.startsWith('http')) {
              return (
                <View key={i} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.borderLight }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: P.textDim, marginBottom: 8, textTransform: 'uppercase' }}>{label}</Text>
                  <TouchableOpacity onPress={() => setZoomImage(v)}>
                    <Image source={{ uri: v }} style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: P.borderLight }} />
                  </TouchableOpacity>
                </View>
              );
            }
          }

          // Special rendering for Withdrawal QR
          if (k.toLowerCase() === 'accountnumber' && data?.bankName) {
            const bankMap: any = { 'vietcombank': 'vcb', 'mb bank': 'mb', 'bidv': 'bidv', 'techcombank': 'tcb', 'acb': 'acb', 'vietinbank': 'vtb' };
            const bKey = Object.keys(bankMap).find(key => data.bankName.toLowerCase().includes(key)) || 'mb';
            const bankId = bankMap[bKey];
            const qrUrl = `https://img.vietqr.io/image/${bankId}-${v}-compact2.png?amount=${data.amount}&addInfo=Zala_Withdraw_${(data.id||'').substring(0,6)}&accountName=${encodeURIComponent(data.accountName || '')}`;
            
            return (
              <View key={i} style={{ paddingVertical: 20, alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderRadius: 16, marginVertical: 12, borderWidth: 1, borderColor: P.borderLight }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: P.textDim, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{at('Mã QR Thanh toán (VietQR)','VietQR Payment Code')}</Text>
                <TouchableOpacity onPress={() => setZoomImage(qrUrl)} style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 }}>
                  <Image source={{ uri: qrUrl }} style={{ width: 220, height: 220 }} resizeMode="contain" />
                </TouchableOpacity>
                <View style={{ marginTop: 16, alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: P.textDim }}>{data.bankName}</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: P.primary, letterSpacing: 1 }}>{v}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: P.text }}>{data.accountName}</Text>
                </View>
              </View>
            );
          }

          // Special rendering for Status or Action
          if (k === 'status' || k === 'action' || k.toLowerCase().includes('accountstatus')) {
            const val = k === 'action' ? (actionMap[v] || v) : v;
            return (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.borderLight }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: P.textDim }}>{label}</Text>
                <Badge text={String(val)} variant={String(v).includes('PENDING') || String(v).includes('LOCKED') ? 'warning' : String(v).includes('APPROVED') || String(v).includes('ACTIVE') || String(v).includes('RESOLVED') ? 'success' : 'danger'} P={P} />
              </View>
            );
          }

          // Format Dates
          if (typeof v === 'string' && (v.includes('T') && v.includes('Z'))) {
            displayValue = formatDate(v);
          }
          // Format Booleans
          if (typeof v === 'boolean') {
            if (k === 'isRead') displayValue = v ? at('Đã đọc','Read') : at('Chưa đọc','Unread');
            else displayValue = v ? at('Có','Yes') : at('Không','No');
          }
          // Format JSON strings or Objects
          let finalVal = v;
          if (typeof v === 'string' && v.trim().startsWith('{')) {
            try { finalVal = JSON.parse(v); } catch(e) {}
          }
          if (finalVal && typeof finalVal === 'object' && !Array.isArray(finalVal)) {
            return (
              <View key={i} style={{ marginTop: 16, padding: 16, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: 16, borderWidth: 1, borderColor: P.borderLight }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="layers-outline" size={16} color={P.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: P.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
                </View>
                <View style={{ gap: 10 }}>
                  {Object.entries(finalVal).map(([nk, nv], ni) => {
                    const mk: any = { 'type': 'apps-outline', 'postId': 'document-text-outline', 'commentId': 'chatbubble-outline', 'userId': 'person-outline', 'targetId': 'locate-outline' };
                    const label_vn: any = { 'type': at('Loại','Type'), 'postId': at('Bài viết','Post'), 'commentId': at('Bình luận','Comment'), 'userId': at('Người dùng','User'), 'targetId': at('Mã đối tượng','Target ID') };
                    const val_vn: any = { 'COMMENT': at('Bình luận','Comment'), 'POST': at('Bài viết','Post'), 'USER': at('Người dùng','User'), 'OA': 'Official Account' };
                    
                    const isId = typeof nv === 'string' && nv.length > 20;
                    const displayLabel = label_vn[nk] || nk;
                    const displayValue = val_vn[nv as string] || (isId ? `ID: ...${nv.slice(-6)}` : String(nv));

                    return (
                      <View key={ni} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name={mk[nk] || 'information-circle-outline'} size={14} color={P.textDim} />
                          <Text style={{ fontSize: 13, color: P.textSec }}>{displayLabel}</Text>
                        </View>
                        <View style={{ backgroundColor: isId ? P.borderLight : 'transparent', paddingHorizontal: isId ? 6 : 0, paddingVertical: isId ? 2 : 0, borderRadius: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: P.text }}>{displayValue}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }
          // Format Arrays
          if (Array.isArray(v)) {
            displayValue = v.length > 0 ? v.join(', ') : '—';
          }

          const isLong = String(displayValue).length > 40;

          return (
            <View key={i} style={{ 
              flexDirection: isLong ? 'column' : 'row', 
              justifyContent: 'space-between', 
              alignItems: isLong ? 'flex-start' : 'center', 
              paddingVertical: 14, 
              borderBottomWidth: 1, 
              borderBottomColor: P.borderLight,
              gap: isLong ? 6 : 0
            }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: P.textDim }}>{label}</Text>
              <Text style={{ 
                fontSize: 14, 
                color: P.text, 
                fontWeight: '700', 
                flex: isLong ? undefined : 1, 
                textAlign: isLong ? 'left' : 'right',
                lineHeight: 20
              }}>{String(displayValue || '—')}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 500, backgroundColor: P.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 }}>
          
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: P.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons 
                  name={mode === 'post' ? 'document-text' : mode === 'comments' ? 'chatbubbles' : mode === 'user' ? 'person' : 'information-circle'} 
                  size={20} color={P.primary} 
                />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '900', color: P.text }}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" size={24} color={P.textDim} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.65 }} showsVerticalScrollIndicator={false}>
            {message ? <Text style={{ fontSize: 14, color: P.textSec, lineHeight: 22, marginBottom: 20 }}>{message}</Text> : null}
            
            {loading ? (
              <View style={{ padding: 40 }}>
                <ActivityIndicator color={P.primary} />
              </View>
            ) : (
              mode === 'comments' ? renderComments() : 
              mode === 'post' ? renderPost() : 
              mode === 'user' ? renderUser() : renderDefault()
            )}

            {/* Input for Prompt */}
            {type === 'prompt' && (
              <View style={{ marginTop: 20, backgroundColor: P.bg, borderRadius: 12, borderWidth: 1, borderColor: P.border, padding: 12 }}>
                <TextInput
                  style={{ fontSize: 15, color: P.text, height: 44 }}
                  value={inputValue}
                  onChangeText={onInputChange}
                  placeholder={at('Nhập nội dung...','Type here...')}
                  placeholderTextColor={P.textDim}
                  autoFocus
                />
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            {type !== 'alert' && (
              <TouchableOpacity onPress={onCancel} style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: P.borderLight }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: P.textSec }}>{at('Hủy','Cancel')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={onConfirm} 
              disabled={loading} 
              style={{ paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: P.primary, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: P.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
            >
              {loading && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                {type === 'alert' ? at('Đóng','Close') : at('Xác nhận','Confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Image Zoom Modal */}
      <Modal visible={!!zoomImage} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setZoomImage(null)}
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {zoomImage && (
            <Image 
              source={{ uri: zoomImage }} 
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 }} 
              resizeMode="contain" 
            />
          )}
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setZoomImage(null)}
            style={{ position: 'absolute', inset: 0, zIndex: -1 }}
          />
        </View>
      </Modal>
    </Modal>
  );
};

export default ActionModal;

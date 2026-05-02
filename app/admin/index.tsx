import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert, Dimensions, RefreshControl, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@/src/contexts/user/UserContext';
import { adminService } from '@/src/api/services/admin.service';
import { useNotifications } from '@/src/contexts/NotificationContext';
import { useTranslation, useLocale } from '@/src/contexts/i18n/I18nContext';
import { Switch } from 'react-native';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';

// Internal Components (Local)
import { Badge } from './_components/Badge';
import { StatCard } from './_components/StatCard';
import { BarChart } from './_components/BarChart';
import { DonutChart } from './_components/DonutChart';
import { DataTable } from './_components/DataTable';
import { ActionModal } from './_components/ActionModal';
import { Pagination } from './_components/Pagination';
import { LineChart } from './_components/LineChart';

type Tab = 'dashboard'|'users'|'posts'|'conversations'|'messages'|'oa'|'withdrawals'|'notifications'|'reports'|'logs'|'settings';
// import { Badge } from './components/Badge';
// import { StatCard } from './components/StatCard';
// import { BarChart } from './components/BarChart';
// import { DonutChart } from './components/DonutChart';
// import { DataTable } from './components/DataTable';
// import { ActionModal } from './components/ActionModal';



 import BillingAdmin from './components/BillingAdmin';
// ── Dynamic Palette ──
const getP = (isDark: boolean) => ({
  primary: '#8b5cf6', primaryLight: '#a78bfa', primaryBg: isDark ? '#1e1b4b' : '#f5f3ff', primaryBorder: isDark ? '#312e81' : '#ede9fe',
  bg: isDark ? '#0f172a' : '#f8f7fc', white: isDark ? '#1e293b' : '#ffffff', sidebar: isDark ? '#1e293b' : '#ffffff',
  text: isDark ? '#f1f5f9' : '#1f2937', textSec: isDark ? '#94a3b8' : '#6b7280', textDim: isDark ? '#64748b' : '#9ca3af',
  border: isDark ? '#334155' : '#e5e7eb', borderLight: isDark ? '#1e293b' : '#f3f4f6',
  success: '#10b981', successBg: isDark ? '#064e3b' : '#ecfdf5',
  danger: '#ef4444', dangerBg: isDark ? '#450a0a' : '#fef2f2',
  warning: '#f59e0b', warningBg: isDark ? '#451a03' : '#fffbeb',
  info: '#3b82f6', infoBg: isDark ? '#172554' : '#eff6ff',
  purple: '#8b5cf6', purpleBg: isDark ? '#2e1065' : '#f5f3ff',
});

const getTABS = (at: (vi: string, en: string) => string): {key:Tab;label:string;icon:string;section:string}[] => [
  {key:'dashboard',label:at('Bảng điều khiển','Dashboard'),icon:'grid-outline',section:at('CHUNG','GENERAL')},
  {key:'users',label:at('Người dùng & Tài khoản','Users & Accounts'),icon:'people-outline',section:at('CHUNG','GENERAL')},
  {key:'posts',label:at('Bài viết','Posts'),icon:'document-text-outline',section:at('CHUNG','GENERAL')},
  {key:'conversations',label:at('Cuộc hội thoại','Conversations'),icon:'chatbubbles-outline',section:at('CHUNG','GENERAL')},
  {key:'oa',label:at('Official Accounts','Official Accounts'),icon:'business-outline',section:at('DUYỆT','APPROVAL')},
  {key:'withdrawals',label:at('Yêu cầu rút tiền','Withdrawal Requests'),icon:'cash-outline',section:at('DUYỆT','APPROVAL')},
  {key:'notifications',label:at('Thông báo hệ thống','System Notifications'),icon:'notifications-outline',section:at('QUẢN LÝ','MANAGE')},
  {key:'reports',label:at('Báo cáo vi phạm','Reports'),icon:'flag-outline',section:at('QUẢN LÝ','MANAGE')},
  {key:'logs',label:at('Nhật ký hoạt động','Audit Logs'),icon:'list-outline',section:at('QUẢN LÝ','MANAGE')},
  {key:'billing',label:at('Tài chính & Quà tặng','Billing & Gifts'),icon:'wallet-outline',section:at('QUẢN LÝ','MANAGE')},
  {key:'settings',label:at('Cài đặt','Settings'),icon:'settings-outline',section:at('QUẢN LÝ','MANAGE')},
];

/* ═══ MAIN ═══ */
export default function AdminPage() {
  const {user, logout}=useUser();
  const {notifications, unreadCount, markAllRead}=useNotifications();
  const {t}=useTranslation();
  const {locale, setLocale}=useLocale();
  const router=useRouter();

  const at = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [tab,setTab]=useState<Tab>('dashboard');
  const [showNotifs,setShowNotifs]=useState(false);
  const [isDark,setIsDark]=useState(false);
  const [timeRange,setTimeRange]=useState<'week'|'month'|'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(Math.ceil(new Date().getDate() / 7));
  const [toast,setToast]=useState<{visible:boolean;message:string;type:'success'|'danger'|'warning'}>({visible:false,message:'',type:'warning'});
  const P = getP(isDark);


  const [stats,setStats]=useState<any>(null);
  const [tableData,setTableData]=useState<any[]>([]);
  const [tableTotal,setTableTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [page,setPage]=useState(0);
  const [searchText,setSearchText]=useState('');
  const [filterStatus,setFilterStatus]=useState('ALL');
  const [filterRole,setFilterRole]=useState('ALL');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [modal,setModal]=useState<{visible:boolean;title:string;message:string;type:'confirm'|'prompt'|'alert';mode?:'default'|'post'|'user'|'comments';action?:(val?:any)=>void;inputValue?:string;data?:any}>({
    visible:false,title:'',message:'',type:'confirm'
  });
  const [actionLoading,setActionLoading]=useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isWide=Dimensions.get('window').width>800;

  // Admin dashboard is web-only. On native, redirect and skip all admin calls.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/contacts');
    }
  }, [router]);

  const handleExport = async () => {
    if (!stats) return;
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Zala_Admin_Report_${timeRange.toUpperCase()}_${timestamp}.xlsx`;

      // 1. Prepare Data Sections
      const systemStats = [
        ['Hệ thống', 'Giá trị'],
        ['Tổng người dùng', stats.totalUsers],
        ['Tổng bài viết', stats.totalPosts],
        ['Tổng hội thoại', stats.totalConversations],
        ['Tổng tin nhắn', stats.totalMessages],
        ['Tổng cuộc gọi', stats.totalCalls],
        ['Official Accounts', stats.totalOA || 0],
      ];

      const userStatus = [
        [],
        ['Trạng thái người dùng', 'Giá trị'],
        ['Đang trực tuyến', stats.onlineUsers],
        ['Tài khoản bị khóa', stats.lockedAccounts],
        ['Đăng ký mới hôm nay', stats.newUsersToday],
      ];

      const reportInfo = [
        [],
        ['Thông tin báo cáo'],
        ['Loại báo cáo', timeRange === 'week' ? 'Tuần' : timeRange === 'month' ? 'Tháng' : 'Năm'],
        ['Ngày xuất', new Date().toLocaleString()],
        ['Người xuất', user?.name || 'Administrator'],
      ];

      // Combine sections
      const fullData = [...systemStats, ...userStatus, ...reportInfo];

      // 2. Create Workbook
      const ws = XLSX.utils.aoa_to_sheet(fullData);
      
      // Auto-size columns (basic)
      const colWidths = [{ wch: 25 }, { wch: 20 }];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Thống kê");

      // 3. Save & Share
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
      } else {
        const directory = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
        const uri = directory + fileName;
        await FileSystem.writeAsStringAsync(uri, wbout, { encoding: 'base64' });
        await Sharing.shareAsync(uri);
      }
      
      setToast({visible:true, message: at('Đã xuất file excel thành công!','Excel report exported successfully!'), type:'success'});
      setTimeout(()=>setToast(prev=>({...prev,visible:false})), 3000);

    } catch (error) {
      console.error('Export Error:', error);
      alert('Không thể xuất file Excel. Vui lòng thử lại.');
    }
  };

  const handleExportUsers = async () => {
    if (!tableData || tab !== 'users') return;
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const data = tableData.map(u => ({
        'ID': u.id,
        'Họ tên': u.displayName || '—',
        'Email': u.email,
        'Vai trò': u.role || 'USER',
        'Trạng thái': u.accountStatus || '—',
        'Ngày tạo': u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
        'Đăng nhập cuối': u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách người dùng");
      
      const fileName = `Zala_Users_Export_${timestamp}.xlsx`;
      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
      } else {
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const directory = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
        const uri = directory + fileName;
        await FileSystem.writeAsStringAsync(uri, wbout, { encoding: 'base64' });
        await Sharing.shareAsync(uri);
      }
      setToast({visible:true, message: at('Xuất danh sách người dùng thành công!','Users list exported!'), type:'success'});
      setTimeout(()=>setToast(prev=>({...prev,visible:false})), 3000);
    } catch (e) { console.error(e); }
  };


  useEffect(()=>{
    // Role guard is handled in admin/_layout.tsx — only set page title here
    if (Platform.OS === 'web' && user) {
      document.title = `Zala Admin - ${user.name || 'Admin'}`;
    }
  },[user]);


  const TABS = React.useMemo(() => getTABS(at), [locale]);

  const isFetching = React.useRef(false);

  const load=useCallback(async(filterCategory?: string)=>{
    if (Platform.OS !== 'web' || isFetching.current) {
      if (Platform.OS !== 'web') {
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }
    
    isFetching.current = true;
    setLoading(true);
    try {
      if(tab==='dashboard'){
        const r=await adminService.getStats({
          range: timeRange,
          month: (timeRange === 'month' || timeRange === 'week') ? selectedMonth : undefined,
          year: (timeRange === 'month' || timeRange === 'year' || timeRange === 'week') ? selectedYear : undefined,
          week: timeRange === 'week' ? selectedWeek : undefined
        });
        setStats(r?.data??r);
      }
      else {
        const fn:any={
          users:adminService.getUsers,
          posts:adminService.getPosts,
          conversations:adminService.getConversations,
          oa:adminService.getOAs,
          notifications:adminService.getNotifications,
          withdrawals:adminService.getWithdrawals,
          reports:adminService.getReports,
          logs:adminService.getAdminLogs
        };
        const params: any = { 
          page, size: 7, category: filterCategory,
          search: searchText || undefined,
          status: filterStatus === 'ALL' ? undefined : filterStatus,
          role: filterRole === 'ALL' ? undefined : filterRole,
          type: tab === 'conversations' && filterStatus !== 'ALL' ? filterStatus : undefined
        };
        const r=await (fn as any)[tab]?.(params);const d=r?.data??r;
        if(Array.isArray(d)){setTableData(d);setTableTotal(d.length);}else{setTableData(d?.items||[]);setTableTotal(d?.total||0);}
      }
    }catch(e:any){
      console.error('Admin Load Error',e);
      if(e.response?.status === 401 || e.message?.includes('401')) {
        setToast({visible:true, message: at('Phiên đăng nhập hết hạn! Đang chuyển hướng...','Session expired! Redirecting...'), type:'danger'});
        setTimeout(()=>{
          logout();
          router.replace('/(auth)');
        }, 2000);
      }
    }finally{
      setLoading(false);
      setRefreshing(false);
      isFetching.current = false;
    }
  },[tab, page, timeRange, selectedMonth, selectedYear, selectedWeek, filterStatus, filterRole, searchText, logout, router, locale]);

  useEffect(()=>{
    setSelectedIds([]);
    load();
  },[tab, page, filterStatus, filterRole, searchText, timeRange, selectedMonth, selectedYear, selectedWeek]);


  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => { if(tab !== 'dashboard') load(); }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);
  
  // Real-time polling for specific counters
  useEffect(() => {
    let interval: any;
    if (tab === 'dashboard') {
      interval = setInterval(async () => {
        try {
          const r = await adminService.getRealtimeStats();
          setStats((prev: any) => prev ? ({ ...prev, ...r }) : prev);
        } catch (e) { /* ignore */ }
      }, 15000); // 15s
    }
    return () => clearInterval(interval);
  }, [tab]);

  const doAction=async(action:string,row:any)=>{
    const go=async(reason?:string)=>{
      setActionLoading(true);
      try{
        const m:any={
          lock:()=>adminService.lockAccount(row.id, reason),
          unlock:()=>adminService.unlockAccount(row.id),
          deletePost:()=>adminService.deletePost(row.id),
          disband:()=>adminService.disbandGroup(row.id),
          deleteMessage:()=>adminService.deleteMessage(row.id),
          deleteNotification:()=>adminService.deleteNotification(row.id),
          approveOA:()=>adminService.approveOA(row.id),
          rejectOA:()=>adminService.rejectOA(row.id,reason),
          suspendOA:()=>adminService.suspendOA(row.id),
          deleteOA:()=>adminService.deleteOA(row.id),
          approveWithdrawal:()=>adminService.approveWithdrawal(row.id),
          rejectWithdrawal:()=>adminService.rejectWithdrawal(row.id,reason),
          bulkLock:()=>adminService.bulkLockUsers(selectedIds, reason),
          bulkDeletePosts:()=>adminService.bulkDeletePosts(selectedIds),
          resolveReport:()=>adminService.updateReportStatus(row.id, 'RESOLVED'),
          dismissReport:()=>adminService.updateReportStatus(row.id, 'DISMISSED'),
        };
        await m[action]?.();
        
        const successMsgs: any = {
          lock: at('Đã khóa và đăng xuất tài khoản thành công!', 'Account locked and logged out!'),
          unlock: at('Đã mở khóa tài khoản thành công!', 'Account unlocked successfully!'),
          deletePost: at('Đã xóa bài viết thành công!', 'Post deleted successfully!'),
          approveOA: at('Đã duyệt Official Account!', 'OA approved!'),
          rejectOA: at('Đã từ chối đơn đăng ký OA!', 'OA rejected!'),
          disband: at('Đã giải tán nhóm thành công!', 'Group disbanded!'),
        };

        setToast({visible:true, message: successMsgs[action] || at('Thao tác thành công!','Action successful!'), type:'success'});
        setTimeout(()=>setToast(prev=>({...prev,visible:false})), 3000);

        setModal(prev=>({...prev,visible:false}));
        load();
      }catch(e:any){
        setModal({visible:true,title:at('Lỗi','Error'),message:e.message,type:'alert'});
      }finally{setActionLoading(false);}
    };

    if(action==='view'){
      const mode = tab === 'posts' ? 'post' : tab === 'users' ? 'user' : 'default';
      setModal({
        visible:true, title: mode === 'post' ? at('Xem trước bài viết','Post Preview') : mode === 'user' ? at('Thông tin người dùng','User Profile') : at('Chi tiết bản ghi','Record Details'),
        message: '',
        data: row,
        type:'alert',
        mode
      });
      return;
    }

    if(action==='viewComments'){
      setLoadingComments(true);
      setModal({visible:true, title:at('Quản lý bình luận','Comment Management'), message:'', type:'alert', mode:'comments', data: row});
      try {
        const r = await adminService.getComments(row.id);
        setComments(r?.data || r || []);
      } catch(e) { console.error(e); }
      finally { setLoadingComments(false); }
      return;
    }

    if(action==='deleteComment'){
      // Internal deletion logic
      setModal(prev => ({...prev, visible: false}));
      setModal({
        visible:true, title:at('Xác nhận xóa','Confirm Delete'),
        message:at('Bạn có chắc muốn xóa bình luận này?','Are you sure you want to delete this comment?'),
        type:'confirm',
        action: async () => {
          try {
            await adminService.deleteComment(row.commentId);
            setToast({visible:true, message:at('Đã xóa bình luận!','Comment deleted!'), type:'success'});
            // Refresh comments
            const r = await adminService.getComments(row.postId);
            setComments(r?.data || r || []);
          } catch(e:any){ alert(e.message); }
        }
      });
      return;
    }

    if(action==='broadcast'){
      setModal(prev => ({...prev, visible: false}));
      setModal({
        visible:true, title:at('Phát thông báo','Broadcast Notification'),
        message:at('Nhập nội dung thông báo hệ thống gửi đến tất cả người dùng:','Enter system notification message to send to all users:'),
        type:'prompt',
        inputValue:'',
        action: async (val: string) => {
          try {
            await adminService.broadcastNotification({
              title: at('Thông báo từ quản trị viên','Notification from Administrator'),
              message: val
            });
            setToast({visible:true, message:at('Đã phát thông báo thành công!','Broadcast sent successfully!'), type:'success'});
            load();
          } catch(e:any){ alert(e.message); }
        }
      });
      return;
    }

    if(action==='warnUser'){
      setModal(prev => ({...prev, visible: false}));
      setModal({
        visible:true, title:at('Cảnh báo người dùng','Warn User'),
        message:at('Nhập nội dung cảnh báo gửi đến người dùng này:','Enter warning message to send to this user:'),
        type:'prompt',
        inputValue:at('Bình luận của bạn vi phạm tiêu chuẩn cộng đồng: ','Your comment violates community standards: ') + (row.content||''),
        action: async (val: string) => {
          try {
            await adminService.warnUser(row.userId, val);
            setToast({visible:true, message:at('Đã gửi cảnh báo!','Warning sent!'), type:'success'});
          } catch(e:any){ alert(e.message); }
        }
      });
      return;
    }

    if(action==='lock'){
      setModal({
        visible:true,title:at('Khóa tài khoản','Lock Account'),
        message:at('Vui lòng nhập lý do khóa tài khoản này:','Please enter the reason for locking this account:'),
        type:'prompt',inputValue:at('Vi phạm tiêu chuẩn cộng đồng','Violation of community standards'),
        action:(val: string)=>go(val),
        data: undefined
      });
      return;
    }

    if(action==='rejectOA'){
      setModal({
        visible:true,title:at('Từ chối Official Account','Reject Official Account'),
        message:at('Vui lòng nhập lý do từ chối đơn đăng ký này:','Please enter the reason for rejecting this application:'),
        type:'prompt',inputValue:at('Thông tin doanh nghiệp không hợp lệ','Invalid business information'),
        action:()=>go(modal.inputValue),
        data: undefined
      });
      return;
    }

    const titleMap:any={
      lock:at('Khóa tài khoản','Lock Account'),
      unlock:at('Mở khóa','Unlock Account'),
      deletePost:at('Xóa bài viết','Delete Post'),
      disband:at('Giải tán nhóm','Disband Group'),
      deleteOA:at('Xóa OA','Delete OA'),
      approveOA:at('Duyệt OA','Approve OA'),
      suspendOA:at('Tạm ngưng OA','Suspend OA'),
      deleteNotification:at('Xóa thông báo','Delete Notification'),
      deleteMessage:at('Xóa tin nhắn','Delete Message'),
      removeFriend:at('Hủy kết bạn','Remove Friend')
    };
    const title=titleMap[action]||at('Xác nhận thao tác','Confirm Action');
    const msg=at(`Bạn có chắc chắn muốn ${title.toLowerCase()} "${row.displayName||row.name||row.id}"?`, `Are you sure you want to ${title.toLowerCase()} "${row.displayName||row.name||row.id}"?`);
    setModal({visible:true,title,message:msg,type:'confirm',action:()=>go(), data: undefined});
  };


  const Btn=({icon,label,color,onPress}:{icon:string;label?:string;color:string;onPress:()=>void})=>(
    <TouchableOpacity onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:label?4:0,paddingHorizontal:label?12:8,paddingVertical:6,borderRadius:8,backgroundColor:P.white,borderWidth:1,borderColor:P.border}}>
      <Ionicons name={icon as any} size={14} color={color} />{label&&<Text style={{fontSize:12,fontWeight:'600',color}}>{label}</Text>}
    </TouchableOpacity>);

  const cols=():any[]=>{
    switch(tab){
      case 'users':return[
        {key:'displayName',title:at('Tên hiển thị','Display Name'),flex:2,render:(v:string)=><Text style={{fontSize:13,color:P.text,fontWeight:'600'}}>{v||'—'}</Text>},
        {key:'email',title:'Email',flex:2},
        {key:'role',title:at('Quyền','Role'),render:(v:string)=><Badge text={v||'USER'} variant={v==='ADMIN'?'danger':'purple'} P={P}/>},
        {key:'accountStatus',title:at('Trạng thái','Status'),render:(v:string)=><Badge text={v||'—'} variant={v==='ACTIVE'?'success':v==='LOCKED'?'warning':'danger'} P={P}/>},
        {key:'_a',title:at('Hành động','Actions'),flex:2,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row',gap:6}}>
            <Btn icon="eye-outline" label={at("Xem","View")} color={P.info} onPress={()=>doAction('view',r)}/>
            {r.accountStatus==='LOCKED'
              ?<Btn icon="lock-open-outline" label={at("Mở khóa","Unlock")} color={P.success} onPress={()=>doAction('unlock',r)}/>
              :<Btn icon="lock-closed-outline" label={at("Khóa","Lock")} color={P.warning} onPress={()=>doAction('lock',r)}/>}
          </View>
        )},
      ];
      case 'posts':return[
        {key:'content',title:at('Nội dung','Content'),flex:3,render:(v:string)=><Text numberOfLines={2} style={{fontSize:13,color:P.text}}>{v||'—'}</Text>},
        {key:'author',title:at('Tác giả','Author'),render:(v:any)=><Text style={{fontSize:13,color:P.text}}>{v?.name||'—'}</Text>},
        {key:'visibility',title:at('Chế độ','Visibility'),render:(v:string)=><Badge text={v==='PUBLIC'?at('Công khai','Public'):at('Riêng tư','Private')} variant={v==='PUBLIC'?'info':'warning'} P={P}/>},
        {key:'isDeleted',title:at('Trạng thái','Status'),render:(v:boolean)=><Badge text={v?at('ĐÃ XÓA','DELETED'):at('HOẠT ĐỘNG','ACTIVE')} variant={v?'danger':'success'} P={P}/>},
        {key:'_a',title:'',flex:2.5,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row',gap:6}}>
            <Btn icon="eye-outline" label={at("Xem","View")} color={P.info} onPress={()=>doAction('view',r)}/>
            <Btn icon="chatbubbles-outline" label={at("Bình luận","Comments")} color={P.purple} onPress={()=>doAction('viewComments',r)}/>
            {!r.isDeleted && <Btn icon="close-circle-outline" label={at("Xóa","Delete")} color={P.danger} onPress={()=>doAction('deletePost',r)}/>}
          </View>
        )},
      ];

      case 'conversations':return[
        {key:'name',title:at('Hội thoại','Conversation'),flex:1.5,render:(v:string, r:any)=><Text style={{fontSize:13,color:P.text,fontWeight:'600'}}>{v||r.id?.substring(0,8)||'—'}</Text>},
        {key:'type',title:at('Loại','Type'),render:(v:string)=><Badge text={v==='GROUP'?at('Nhóm','Group'):at('Cá nhân','Private')} variant={v==='GROUP'?'purple':'info'} P={P}/>},
        {key:'memberCount',title:at('Thành viên','Members'), render:(v:any)=><Text style={{fontSize:13,color:P.text}}>{v||0}</Text>},
        {key:'messageCount',title:at('Số tin nhắn','Msgs'), render:(v:any)=><Badge text={`${v||0}`} variant="default" P={P}/>},
        {key:'_a',title:'',flex:1.5,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row',gap:6}}>
            <Btn icon="eye-outline" label={at("Xem","View")} color={P.info} onPress={()=>doAction('view',r)}/>
            {r.type==='GROUP' && <Btn icon="close-circle-outline" label={at("Giải tán","Disband")} color={P.danger} onPress={()=>doAction('disband',r)}/>}
          </View>
        )},
      ];

      case 'oa':return[
        {key:'name',title:at('Tên OA','OA Name'),flex:2,render:(v:string)=><Text style={{fontSize:13,color:P.text,fontWeight:'600'}}>{v||'—'}</Text>},
        {key:'category',title:at('Loại','Category'),render:(v:string)=><Badge text={v||'—'} variant='purple' P={P}/>},
        {key:'status',title:at('Trạng thái','Status'),render:(v:string)=><Badge text={v||'—'} variant={v==='APPROVED'?'success':(v==='PENDING' || v==='REJECTED')?'danger':'info'} P={P}/>},
        {key:'_a',title:at('Hành động','Actions'),flex:2.5,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row',gap:4,flexWrap:'wrap'}}>
            <Btn icon="eye-outline" label={at("Xem","View")} color={P.info} onPress={()=>doAction('view',r)}/>
            {r.status==='PENDING'&&<><Btn icon="checkmark-circle-outline" label={at("Duyệt","Approve")} color={P.success} onPress={()=>doAction('approveOA',r)}/><Btn icon="close-circle-outline" label={at("Từ chối","Reject")} color={P.danger} onPress={()=>doAction('rejectOA',r)}/></>}
            {r.status==='APPROVED'&&<Btn icon="pause-circle-outline" label={at("Tạm ngưng","Suspend")} color={P.warning} onPress={()=>doAction('suspendOA',r)}/>}
            {r.status==='SUSPENDED'&&<Btn icon="checkmark-circle-outline" label={at("Mở lại","Reactivate")} color={P.success} onPress={()=>doAction('approveOA',r)}/>}
            {r.status==='REJECTED'&&<Btn icon="checkmark-circle-outline" label={at("Duyệt lại","Re-approve")} color={P.success} onPress={()=>doAction('approveOA',r)}/>}
            <Btn icon="close-circle-outline" label={at("Xóa","Delete")} color={P.danger} onPress={()=>doAction('deleteOA',r)}/>
          </View>
        )},
      ];
      case 'withdrawals':return[
        {key:'accountName',title:at('Chủ tài khoản','Account Name'),flex:1.5,render:(v:string)=><Text style={{fontSize:13,color:P.text,fontWeight:'600'}}>{v||'—'}</Text>},
        {key:'amount',title:at('Số tiền','Amount'),render:(v:number)=><Text style={{fontSize:13,color:P.success,fontWeight:'700'}}>{v?.toLocaleString() || 0} đ</Text>},
        {key:'bankName',title:at('Ngân hàng','Bank'),render:(v:string)=><Text style={{fontSize:12,color:P.text}}>{v||'—'}</Text>},
        {key:'status',title:at('Trạng thái','Status'),render:(v:string)=><Badge text={v||'PENDING'} variant={v==='COMPLETED' || v==='APPROVED'?'success':v==='PENDING'?'warning':'danger'} P={P}/>},
        {key:'_a',title:at('Hành động','Actions'),flex:2,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row',gap:6}}>
            <Btn icon="eye-outline" label={at("Xem","View")} color={P.info} onPress={()=>doAction('view',r)}/>
            {r.status==='PENDING' && (
              <>
                <Btn icon="checkmark-circle-outline" label={at("Duyệt","Approve")} color={P.success} onPress={()=>doAction('approveWithdrawal',r)}/>
                <Btn icon="close-circle-outline" label={at("Từ chối","Reject")} color={P.danger} onPress={()=>doAction('rejectWithdrawal',r)}/>
              </>
            )}
          </View>
        )},
      ];
      case 'notifications':return[
        {key:'type',title:at('Loại','Type'),flex:1.2,render:(v:string, r:any)=>{
          const getIcon=(t:string)=>{
            switch(t){
              case 'USER_REGISTER': return {n:'person-add', c:P.success};
              case 'USER_LOCKED': return {n:'lock-closed', c:P.danger};
              case 'USER_VIOLATION': return {n:'warning', c:P.warning};
              case 'ABNORMAL_LOGIN': return {n:'shield-half', c:P.danger};
              case 'BUG_REPORT': return {n:'bug', c:P.info};
              case 'TOXIC_COMMENT': return {n:'chatbubble-ellipses', c:P.warning};
              case 'SPAM_ALERT': return {n:'mail-unread', c:P.danger};
              case 'STAFF_LOGIN': return {n:'business', c:P.primary};
              case 'ROLE_CHANGE': return {n:'key', c:P.purple || P.primary};
              case 'ADMIN_STATUS': return {n:'radio-outline', c:P.success};
              case 'PASSWORD_CHANGE': return {n:'finger-print', c:P.info};
              default: return {n:'notifications', c:P.textSec};
            }
          };
          const icon=getIcon(r.type);
          return <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Ionicons name={icon.n as any} size={16} color={icon.c} />
            <Text style={{fontSize:12,fontWeight:'600',color:P.text}}>{r.type || 'SYSTEM'}</Text>
          </View>
        }},
        {key:'title',title:at('Tiêu đề','Title'),flex:1.5,render:(v:any, r:any)=><Text style={{fontSize:13,color:P.text,fontWeight:'700'}}>{r.title || at('Cảnh báo hệ thống','System Alert')}</Text>},
        {key:'createdAt',title:at('Thời gian','Time'),render:(v:any)=><Text style={{fontSize:12,color:P.textDim}}>{v?new Date(v).toLocaleString():'—'}</Text>},
        {key:'_a',title:'',flex:1.8,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row',gap:6}}>
            <Btn icon="eye-outline" label={at("Xem","View")} color={P.info} onPress={()=>doAction('view',r)}/>
            <Btn icon="close-circle-outline" label={at("Xóa","Delete")} color={P.danger} onPress={()=>doAction('deleteNotification',r)}/>
          </View>
        )},
      ];
      case 'reports':return[
        {key:'targetType',title:at('Đối tượng','Target'),render:(v:string)=><Badge text={v} variant={v==='POST'?'info':v==='USER'?'purple':'default'} P={P}/>},
        {key:'reason',title:at('Lý do','Reason'),flex:2,render:(v:string)=><Text style={{fontSize:13,color:P.text}} numberOfLines={1}>{v}</Text>},
        {key:'status',title:at('Trạng thái','Status'),render:(v:string)=><Badge text={v} variant={v==='PENDING'?'warning':v==='RESOLVED'?'success':'danger'} P={P}/>},
        {key:'createdAt',title:at('Ngày báo','Date'),render:(v:any)=><Text style={{fontSize:12,color:P.textDim}}>{new Date(v).toLocaleDateString()}</Text>},
        {key:'_a',title:'',flex:2,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row',gap:6}}>
            <Btn icon="eye-outline" label={at("Xem","View")} color={P.info} onPress={()=>doAction('view',r)}/>
            {r.status==='PENDING' && (
              <>
                <Btn icon="checkmark-circle-outline" label={at("Xử lý","Resolve")} color={P.success} onPress={()=>doAction('resolveReport',r)}/>
                <Btn icon="close-circle-outline" label={at("Bỏ qua","Dismiss")} color={P.danger} onPress={()=>doAction('dismissReport',r)}/>
              </>
            )}
          </View>
        )},
      ];
      case 'logs':return[
        {key:'action',title:at('Hành động','Action'),render:(v:string)=>{
          const actionMap: any = {
            'APPROVE_OA': at('Phê duyệt OA','Approve OA'),
            'REJECT_OA': at('Từ chối OA','Reject OA'),
            'SUSPEND_OA': at('Tạm ngưng OA','Suspend OA'),
            'DELETE_OA': at('Xóa OA','Delete OA'),
            'LOCK_USER': at('Khóa tài khoản','Lock Account'),
            'UNLOCK_USER': at('Mở khóa tài khoản','Unlock Account'),
            'WARN_USER': at('Cảnh báo người dùng','Warn User'),
            'DELETE_POST': at('Xóa bài viết','Delete Post'),
            'DELETE_COMMENT': at('Xóa bình luận','Delete Comment'),
            'DISBAND_GROUP': at('Giải tán nhóm','Disband Group'),
            'RESOLVE_REPORT': at('Xử lý báo cáo','Resolve Report'),
            'APPROVE_WITHDRAWAL': at('Duyệt rút tiền','Approve Withdrawal'),
            'REJECT_WITHDRAWAL': at('Từ chối rút tiền','Reject Withdrawal'),
            'LOGIN': at('Đăng nhập hệ thống','System Login'),
            'BULK_LOCK_USERS': at('Khóa tài khoản hàng loạt','Bulk Lock'),
            'BULK_DELETE_POSTS': at('Xóa bài viết hàng loạt','Bulk Delete Posts'),
          };
          return <Badge text={actionMap[v] || v} variant="purple" P={P}/>
        }},
        {key:'adminName',title:at('Người thực hiện','Admin'),render:(v:string)=><Text style={{fontSize:13,color:P.text,fontWeight:'600'}}>{v}</Text>},
        {key:'targetId',title:at('Đối tượng','Target'),render:(_:any, r:any)=>(
          <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
            <Badge text={r.targetType || 'ID'} variant="outline" P={P} />
            <Text style={{fontSize:12,color:P.text,fontWeight:'500'}} numberOfLines={1}>{r.targetName || r.targetId || '—'}</Text>
          </View>
        )},
        {key:'createdAt',title:at('Thời gian','Time'),render:(v:any)=><Text style={{fontSize:12,color:P.textDim}}>{new Date(v).toLocaleString()}</Text>},
        {key:'_a',title:'',flex:1.5,render:(_:any,r:any)=>(
          <View style={{flexDirection:'row', justifyContent:'flex-start'}}>
            <Btn icon="eye-outline" label={at("Xem chi tiết","View Details")} color={P.info} onPress={()=>doAction('view',r)}/>
          </View>
        )},
      ];
      default:return[];
    }
  };

  const sections=[...new Set(TABS.map(t=>t.section))];
  const handleAdminLogout = () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(at('Bạn có chắc muốn đăng xuất?', 'Are you sure you want to log out?'))
      : true;
    if (!confirmed) return;
    logout();
    router.replace('/(auth)');
  };

  return <View style={{flex:1,backgroundColor:P.bg}}>
    {/* Top Bar */}
    <View style={{backgroundColor:P.white,paddingHorizontal:24,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:P.border, zIndex:100}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
        <View style={{width:36,height:36,borderRadius:10,backgroundColor:P.primary,alignItems:'center',justifyContent:'center', shadowColor:P.primary, shadowOpacity:0.3, shadowRadius:8, elevation:5}}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
        </View>
        <Text style={{fontSize:18,fontWeight:'800',color:P.primary,letterSpacing:-0.5}}>Zala - {user?.name || 'Admin'}</Text>
      </View>

      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{position:'relative'}}>
          <TouchableOpacity 
            onPress={()=>{setShowNotifs(!showNotifs); markAllRead();}}
            style={{width:36,height:36,borderRadius:18,backgroundColor:P.primaryBg,alignItems:'center',justifyContent:'center'}}
          >
            <Ionicons name="notifications-outline" size={20} color={P.primary} />
            {unreadCount > 0 && (
              <View style={{position:'absolute',top:2,right:2,width:10,height:10,borderRadius:5,backgroundColor:P.danger,borderWidth:2,borderColor:P.white}} />
            )}
          </TouchableOpacity>

          {/* Notification Dropdown Panel */}
          {showNotifs && (
            <View style={{
              position:'absolute', top:45, right:0, width:320, maxHeight:400, 
              backgroundColor:P.white, borderRadius:12, borderWidth:1, borderColor:P.border,
              shadowColor:'#000', shadowOpacity:0.1, shadowRadius:15, elevation:10, zIndex:1000
            }}>
              <View style={{padding:12, borderBottomWidth:1, borderBottomColor:P.border, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <Text style={{fontWeight:'700', color:P.text}}>{at("Thông báo","Notifications")}</Text>
                <Badge text={`${unreadCount} ${at("Mới","New")}`} variant="purple" P={P} />
              </View>
              <ScrollView style={{maxHeight:340}}>
                {notifications.length === 0 ? (
                  <Text style={{textAlign:'center', padding:20, color:P.textDim, fontSize:13}}>{at("Không có thông báo nào","No notifications")}</Text>
                ) : (
                  notifications.map((n:any, i:number) => {
                    const getIcon=(t:string)=>{
                      switch(t){
                        case 'USER_REGISTER': return {n:'person-add', c:P.success};
                        case 'USER_LOCKED': return {n:'lock-closed', c:P.danger};
                        case 'USER_VIOLATION': return {n:'warning', c:P.warning};
                        case 'ABNORMAL_LOGIN': return {n:'shield-half', c:P.danger};
                        case 'BUG_REPORT': return {n:'bug', c:P.info};
                        case 'TOXIC_COMMENT': return {n:'chatbubble-ellipses', c:P.warning};
                        case 'SPAM_ALERT': return {n:'mail-unread', c:P.danger};
                        case 'STAFF_LOGIN': return {n:'business', c:P.primary};
                        case 'ROLE_CHANGE': return {n:'key', c:P.purple || P.primary};
                        case 'ADMIN_STATUS': return {n:'radio-outline', c:P.success};
                        case 'PASSWORD_CHANGE': return {n:'finger-print', c:P.info};
                        default: return {n:'notifications', c:P.textSec};
                      }
                    };
                    const icon=getIcon(n.type);
                    return (
                      <TouchableOpacity key={i} style={{padding:12, borderBottomWidth:1, borderBottomColor:P.borderLight, backgroundColor: n.isRead ? P.white : P.primaryBg}}>
                        <View style={{flexDirection:'row', gap:10}}>
                          <View style={{width:32, height:32, borderRadius:16, backgroundColor: icon.c + '20', alignItems:'center', justifyContent:'center'}}>
                            <Ionicons name={icon.n as any} size={16} color={icon.c} />
                          </View>
                          <View style={{flex:1}}>
                            <Text style={{fontSize:13, color:P.text, fontWeight: n.isRead ? '400' : '600'}} numberOfLines={1}>{n.title || at('Cảnh báo hệ thống','System Alert')}</Text>
                            <Text style={{fontSize:12, color:P.textSec, marginTop:2}} numberOfLines={2}>{n.message}</Text>
                            <Text style={{fontSize:10, color:P.textDim, marginTop:4}}>{new Date(n.createdAt).toLocaleString()}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
              <TouchableOpacity onPress={() => {setTab('notifications'); setShowNotifs(false);}} style={{padding:10, alignItems:'center', borderTopWidth:1, borderTopColor:P.border}}>
                <Text style={{fontSize:12, color:P.primary, fontWeight:'600'}}>{at("Xem tất cả thông báo","View All Notifications")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          {user?.avatarUrl || user?.avatarURL ? (
            <Image source={{uri: user.avatarUrl || user.avatarURL}} style={{width:36,height:36,borderRadius:18,borderWidth:2,borderColor:P.primaryBorder}} />
          ) : (
            <View style={{width:36,height:36,borderRadius:18,backgroundColor:P.primaryBg,alignItems:'center',justifyContent:'center'}}>
              <Ionicons name="person" size={18} color={P.primary} />
            </View>
          )}
          <View>
            <Text style={{fontSize:13,fontWeight:'700',color:P.text}}>{user?.name || user?.displayName || 'Admin'}</Text>
            <Text style={{fontSize:11,color:P.textDim}}>{at("Quản trị viên","Administrator")}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleAdminLogout}
          style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:10,backgroundColor:P.dangerBg,borderWidth:1,borderColor:P.danger}}
        >
          <Ionicons name="log-out-outline" size={15} color={P.danger} />
          <Text style={{fontSize:12,fontWeight:'700',color:P.danger}}>{at("Đăng xuất","Logout")}</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={{flex:1,flexDirection:isWide?'row':'column'}}>
      {/* Sidebar */}
      <View style={{backgroundColor:P.sidebar,width:isWide?240:'100%',paddingVertical:isWide?20:0,
        flexDirection:isWide?'column':'row',flexWrap:isWide?'nowrap':'wrap',
        borderRightWidth:isWide?1:0,borderRightColor:P.border,borderBottomWidth:isWide?0:1,borderBottomColor:P.border}}>
        {isWide ? sections.map(sec=>(
          <View key={sec}>
            <Text style={{fontSize:11,fontWeight:'700',color:P.textDim,letterSpacing:1.2,paddingHorizontal:24,paddingTop:20,paddingBottom:8}}>{sec}</Text>
            {TABS.filter(t=>t.section===sec).map(t=>{
              const active=tab===t.key;
              return <TouchableOpacity key={t.key} onPress={()=>{setTab(t.key);setPage(0);}} style={{
                flexDirection:'row',alignItems:'center',gap:12,paddingVertical:11,paddingHorizontal:24,marginHorizontal:12,borderRadius:10,
                backgroundColor:active?P.primaryBg:'transparent',
              }}>
                <View style={{flex:1, flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
                  <View style={{flexDirection:'row', alignItems:'center', gap:12}}>
                    <Ionicons name={t.icon as any} size={18} color={active?P.primary:P.textSec} />
                    <Text style={{fontSize:14,fontWeight:active?'700':'500',color:active?P.primary:P.textSec}}>{t.label}</Text>
                  </View>
                  {t.key === 'notifications' && unreadCount > 0 && (
                    <View style={{backgroundColor:P.danger, minWidth:20, height:20, borderRadius:10, alignItems:'center', justifyContent:'center', paddingHorizontal:6}}>
                      <Text style={{fontSize:10, fontWeight:'800', color:'#fff'}}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>;
            })}
          </View>
        )) : TABS.map(t=>{
          const active=tab===t.key;
          return <TouchableOpacity key={t.key} onPress={()=>{setTab(t.key);setPage(0);}} style={{
            flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:14,
            borderBottomWidth:active?2:0,borderBottomColor:P.primary,
          }}>
            <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
              <Ionicons name={t.icon as any} size={16} color={active?P.primary:P.textSec} />
              <Text style={{fontSize:12,fontWeight:active?'700':'500',color:active?P.primary:P.textSec}}>{t.label}</Text>
              {t.key === 'notifications' && unreadCount > 0 && (
                <View style={{backgroundColor:P.danger, minWidth:16, height:16, borderRadius:8, alignItems:'center', justifyContent:'center', marginLeft:2}}>
                  <Text style={{fontSize:9, fontWeight:'800', color:'#fff'}}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>;
        })}

        {/* Back to Home - Wide sidebar */}
        {isWide && <View style={{marginTop:'auto',paddingHorizontal:12,paddingBottom:20}}>
          <TouchableOpacity
            onPress={()=>router.replace('/(main)')}
            style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:11,paddingHorizontal:12,borderRadius:10,backgroundColor:P.primaryBg,borderWidth:1,borderColor:P.primaryBorder}}
          >
            <Ionicons name="home-outline" size={18} color={P.primary} />
            <Text style={{fontSize:14,fontWeight:'600',color:P.primary}}>{at("Về trang chủ","Back to Home")}</Text>
          </TouchableOpacity>
        </View>}

        {/* Back to Home - Narrow/Mobile: shown as a tab item */}
        {!isWide && (
          <TouchableOpacity
            onPress={()=>router.replace('/(main)')}
            style={{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:14,borderBottomWidth:2,borderBottomColor:P.primary,backgroundColor:P.primaryBg}}
          >
            <Ionicons name="home-outline" size={16} color={P.primary} />
            <Text style={{fontSize:12,fontWeight:'700',color:P.primary}}>{at("Trang chủ","Home")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={{flex:1, backgroundColor: P.bg}}>
        {tab === 'dashboard' ? (
          <ScrollView style={{flex:1, padding:isWide?20:12}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={P.primary}/>}>
            <View style={{flexDirection:isWide?'row':'column', justifyContent:'space-between', alignItems:isWide?'center':'flex-start', marginBottom:20, gap:12}}>
              <View>
                <Text style={{fontSize:22, fontWeight:'800', color:P.text}}>{at("Bảng điều khiển","Dashboard")}</Text>
                <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                  <View style={{width:8, height:8, borderRadius:4, backgroundColor:P.success}} />
                  <Text style={{fontSize:13, fontWeight:'600', color:P.textDim}}>
                    {timeRange === 'week' ? at(`Tuần ${selectedWeek}, tháng ${selectedMonth}/${selectedYear}`, `Week ${selectedWeek}, ${selectedMonth}/${selectedYear}`) : 
                     timeRange === 'month' ? at(`Tháng ${selectedMonth}/${selectedYear}`, `Month ${selectedMonth}/${selectedYear}`) : 
                     at(`Năm ${selectedYear}`, `Year ${selectedYear}`)}
                  </Text>
                </View>
              </View>
              
              <View style={{flexDirection:'row', alignItems:'center', gap:12, flexWrap:'wrap', justifyContent:'flex-end'}}>
                {/* Period Selector (Week/Month/Year) */}
                <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                  {timeRange === 'week' && (
                    <View style={{flexDirection:'row', alignItems:'center', gap:4, backgroundColor:P.white, borderRadius:10, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:P.border}}>
                      <Text style={{fontSize:12, fontWeight:'600', color:P.textDim}}>{at("Tuần","Week")}</Text>
                      {[
                        {w:1, r:'1-7'},
                        {w:2, r:'8-14'},
                        {w:3, r:'15-21'},
                        {w:4, r:'22-28'},
                        {w:5, r:'29+'}
                      ].map(item => (
                        <TouchableOpacity key={item.w} onPress={()=>setSelectedWeek(item.w)} style={{paddingHorizontal:8, height:24, borderRadius:6, alignItems:'center', justifyContent:'center', backgroundColor:selectedWeek===item.w?P.primary:'transparent'}}>
                          <Text style={{fontSize:10, fontWeight:'700', color:selectedWeek===item.w?'#fff':P.text}}>{item.w} ({item.r})</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {(timeRange === 'month' || timeRange === 'week') && (
                    <View style={{backgroundColor:P.white, borderRadius:10, borderWidth:1, borderColor:P.border, overflow:'hidden'}}>
                      {Platform.OS === 'web' ? (
                        <select
                          value={selectedMonth}
                          onChange={(e: any)=>setSelectedMonth(parseInt(e.target.value))}
                          style={{
                            padding:8, fontSize:12, fontWeight:'700', border:'none', backgroundColor:'transparent', color:P.text, outline:'none', cursor:'pointer'
                          }}
                        >
                          {Array.from({length:12},(_,i)=>i+1).map(m => (
                            <option key={m} value={m}>{at(`Tháng ${m}`,`Month ${m}`)}</option>
                          ))}
                        </select>
                      ) : (
                        <Picker
                          selectedValue={selectedMonth}
                          onValueChange={(val: number) => setSelectedMonth(val)}
                          style={{height:40, width:130, color:P.text}}
                          dropdownIconColor={P.text}
                        >
                          {Array.from({length:12},(_,i)=>i+1).map(m => (
                            <Picker.Item key={m} label={at(`Tháng ${m}`,`Month ${m}`)} value={m} />
                          ))}
                        </Picker>
                      )}
                    </View>
                  )}

                  <View style={{backgroundColor:P.white, borderRadius:10, borderWidth:1, borderColor:P.border, overflow:'hidden'}}>
                    {Platform.OS === 'web' ? (
                      <select
                        value={selectedYear}
                        onChange={(e: any)=>setSelectedYear(parseInt(e.target.value))}
                        style={{
                          padding:8, fontSize:12, fontWeight:'700', border:'none', backgroundColor:'transparent', color:P.text, outline:'none', cursor:'pointer'
                        }}
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    ) : (
                      <Picker
                        selectedValue={selectedYear}
                        onValueChange={(val: number) => setSelectedYear(val)}
                        style={{height:40, width:100, color:P.text}}
                        dropdownIconColor={P.text}
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <Picker.Item key={y} label={`${y}`} value={y} />
                        ))}
                      </Picker>
                    )}
                  </View>
                </View>

                {/* Range Toggle */}
                <View style={{flexDirection:'row', backgroundColor:P.white, borderRadius:10, borderWidth:1, borderColor:P.border, padding:2}}>
                  {(['week','month','year'] as const).map(r => (
                    <TouchableOpacity key={r} onPress={()=>setTimeRange(r)} style={{paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor: timeRange === r ? P.primary : 'transparent'}}>
                      <Text style={{fontSize:12, fontWeight:'700', color: timeRange === r ? '#fff' : P.textSec}}>
                        {r === 'week' ? at("Tuần","Week") : r === 'month' ? at("Tháng","Month") : at("Năm","Year")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={handleExport} style={{flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:10, borderRadius:10, backgroundColor: P.success}}>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={{fontSize:13, fontWeight:'700', color:'#fff'}}>{at("Xuất Excel","Export Excel")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loading ? <ActivityIndicator size="large" color={P.primary} style={{marginTop:60}}/> : stats && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '700', color: P.text, marginBottom: 16, marginTop: 10 }}>{at('Tổng quan nền tảng','Platform Summary')}</Text>
                <View style={{flexDirection:'row', flexWrap:'wrap'}}>
                  <StatCard title={at("Người dùng","Users")} value={stats.totalUsers} icon="people" color={P.primary} bgColor={P.primaryBg} P={P} trend={{ value: 12, isUp: true }} />
                  <StatCard title={at("Bài viết","Posts")} value={stats.totalPosts} icon="document-text" color={P.info} bgColor={P.infoBg} P={P} trend={{ value: 5, isUp: true }} />
                  <StatCard title={at("Hội thoại","Conversations")} value={stats.totalConversations} icon="chatbubbles" color={P.purple} bgColor={P.purpleBg} P={P} />
                  <StatCard title="Official Accounts" value={stats.totalOA||0} icon="business" color={P.warning} bgColor={P.warningBg} P={P} />
                </View>

                <View style={{ marginTop: 20 }}>
                  {stats.growth && <LineChart data={stats.growth} P={P} at={at} />}
                </View>

                <Text style={{ fontSize: 16, fontWeight: '700', color: P.text, marginBottom: 16, marginTop: 30 }}>{at('Sức khỏe hệ thống','System Health')}</Text>
                <View style={{flexDirection:'row', flexWrap:'wrap'}}>
                  <StatCard title={at("Đang trực tuyến","Online Now")} value={stats.onlineUsers} icon="pulse" color={P.success} bgColor={P.successBg} P={P} />
                  <StatCard title={at("Tài khoản bị khóa","Locked")} value={stats.lockedAccounts} icon="lock-closed" color={P.danger} bgColor={P.dangerBg} P={P} />
                  <StatCard title={at("Đăng ký mới hôm nay","New Today")} value={stats.newUsersToday} icon="trending-up" color={P.warning} bgColor={P.warningBg} P={P} trend={{ value: stats.newUsersToday > 0 ? 100 : 0, isUp: true }} />
                  <StatCard title={at("Tin nhắn hệ thống","System Msgs")} value={stats.totalMessages} icon="mail" color={P.info} bgColor={P.infoBg} P={P} />
                </View>

                <Text style={{ fontSize: 16, fontWeight: '700', color: P.text, marginBottom: 16, marginTop: 30 }}>{at('Cần xử lý ngay','Action Required')}</Text>
                <View style={{flexDirection:'row', flexWrap:'wrap'}}>
                  <StatCard title={at("Báo cáo vi phạm","Violations")} value={stats.pendingReports||0} icon="warning" color={P.danger} bgColor={P.dangerBg} P={P} />
                  <StatCard title={at("Yêu cầu rút tiền","Withdrawals")} value={stats.pendingWithdrawals||0} icon="cash" color={P.success} bgColor={P.successBg} P={P} />
                  <StatCard title={at("Duyệt Official Account","OA Approvals")} value={stats.pendingOAs||0} icon="business" color={P.info} bgColor={P.infoBg} P={P} />
                  <StatCard title={at("Bài viết mới (24h)","New Posts")} value={stats.newPostsToday||0} icon="create" color={P.primary} bgColor={P.primaryBg} P={P} />
                </View>

                <View style={{flexDirection:'row', flexWrap:'wrap', marginTop:20, gap: 20}}>
                  <BarChart title={at("Phân bổ nội dung","Content Distribution")} P={P} data={[
                    {label:'Users',value:stats.totalUsers,color:P.primary},
                    {label:'Posts',value:stats.totalPosts,color:P.info},
                    {label:'Calls',value:stats.totalCalls,color:'#0891b2'},
                  ]} />
                  <DonutChart title={at("Trạng thái tài khoản","Account Status")} P={P} data={[
                    {label:at('Hoạt động','Active'),value:Math.max(0, stats.totalUsers - stats.lockedAccounts),color:P.success},
                    {label:at('Bị khóa','Locked'),value:stats.lockedAccounts||0,color:P.danger},
                  ]} />
                </View>
              </>
            )}
          </ScrollView>
        ) : tab === 'settings' ? (
          <ScrollView style={{flex:1, padding:20}}>
             <View style={{maxWidth:600}}>
              <View style={{backgroundColor:P.white,borderRadius:16,padding:24,borderWidth:1,borderColor:P.border,shadowColor:'#000',shadowOpacity:0.02,elevation:1}}>
                <Text style={{fontSize:18,fontWeight:'700',color:P.text,marginBottom:20}}>{at("Giao diện & Ngôn ngữ","Appearance & Language")}</Text>
                
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:16,borderBottomWidth:1,borderBottomColor:P.borderLight}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
                    <View style={{width:36,height:36,borderRadius:10,backgroundColor:P.primaryBg,alignItems:'center',justifyContent:'center'}}>
                      <Ionicons name="moon-outline" size={20} color={P.primary} />
                    </View>
                    <View>
                      <Text style={{fontSize:15,fontWeight:'600',color:P.text}}>{at("Chế độ tối","Dark Mode")}</Text>
                      <Text style={{fontSize:12,color:P.textDim}}>{at("Chuyển đổi giao diện sang tông màu tối","Switch to a dark color palette")}</Text>
                    </View>
                  </View>
                  <Switch value={isDark} onValueChange={setIsDark} trackColor={{false: P.border, true: P.primaryLight}} thumbColor={P.white} />
                </View>

                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:16}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
                    <View style={{width:36,height:36,borderRadius:10,backgroundColor:P.infoBg,alignItems:'center',justifyContent:'center'}}>
                      <Ionicons name="language-outline" size={20} color={P.info} />
                    </View>
                    <View>
                      <Text style={{fontSize:15,fontWeight:'600',color:P.text}}>{at("Ngôn ngữ hệ thống","System Language")}</Text>
                      <Text style={{fontSize:12,color:P.textDim}}>{at(`Hiện tại: ${locale === 'vi' ? 'Tiếng Việt' : 'English'}`, `Current: ${locale === 'vi' ? 'Tiếng Việt' : 'English'}`)}</Text>
                    </View>
                  </View>
                  <View style={{flexDirection:'row',backgroundColor:P.borderLight,borderRadius:10,padding:4}}>
                    <TouchableOpacity onPress={()=>setLocale('vi')} style={{paddingHorizontal:12,paddingVertical:6,borderRadius:8,backgroundColor:locale==='vi'?P.white:'transparent'}}>
                      <Text style={{fontSize:12,fontWeight:'600',color:locale==='vi'?P.primary:P.textSec}}>VI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>setLocale('en')} style={{paddingHorizontal:12,paddingVertical:6,borderRadius:8,backgroundColor:locale==='en'?P.white:'transparent'}}>
                      <Text style={{fontSize:12,fontWeight:'600',color:locale==='en'?P.primary:P.textSec}}>EN</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        ) : tab === 'billing' ? (
          <View style={{flex:1, padding:isWide?20:12}}>
            <BillingAdmin P={P} at={at} setToast={setToast} />
          </View>
        ) : (
          <View style={{flex:1, padding:isWide?20:12}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
            <View>
              <Text style={{fontSize:24,fontWeight:'800',color:P.text,letterSpacing:-0.3}}>{TABS.find(t=>t.key===tab)?.label}</Text>
              <Text style={{fontSize:13,color:P.textSec,marginTop:2}}>Tìm thấy {tableTotal} bản ghi</Text>
            </View>
            <View style={{flexDirection:isWide?'row':'column', gap:12, marginBottom:16, alignItems:isWide?'center':'stretch'}}>
              <View style={{flex:1, flexDirection:'row', alignItems:'center', backgroundColor:P.white, borderRadius:12, paddingHorizontal:12, borderWidth:1, borderColor:P.border}}>
                <Ionicons name="search-outline" size={18} color={P.textDim} />
                <TextInput style={{flex:1, paddingVertical:10, paddingHorizontal:10, fontSize:14, color:P.text}} placeholder={at("Tìm kiếm...","Search...")} value={searchText} onChangeText={setSearchText} />
              </View>

              {tab === 'users' && (
                <View style={{flexDirection:'row', gap:10}}>
                  <View style={{backgroundColor:P.white, borderRadius:12, borderWidth:1, borderColor:P.border, overflow:'hidden'}}>
                    <Picker selectedValue={filterStatus} onValueChange={setFilterStatus} style={{height:40, width:150, color:P.text, backgroundColor:P.white}}>
                      <Picker.Item label={at("Tất cả trạng thái","All Status")} value="ALL" />
                      <Picker.Item label="ACTIVE" value="ACTIVE" />
                      <Picker.Item label="LOCKED" value="LOCKED" />
                    </Picker>
                  </View>
                  <TouchableOpacity onPress={handleExportUsers} style={{paddingHorizontal:16, paddingVertical:10, borderRadius:12, backgroundColor:P.success, flexDirection:'row', alignItems:'center', gap:8}}>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={{fontSize:13, fontWeight:'700', color:'#fff'}}>Excel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {tab === 'conversations' && (
                <View style={{backgroundColor:P.white, borderRadius:12, borderWidth:1, borderColor:P.border, overflow:'hidden'}}>
                  <Picker selectedValue={filterStatus} onValueChange={setFilterStatus} style={{height:40, width:180, color:P.text, backgroundColor:P.white}}>
                    <Picker.Item label={at("Tất cả loại","All Types")} value="ALL" />
                    <Picker.Item label={at("Cá nhân","Private")} value="PRIVATE" />
                    <Picker.Item label={at("Nhóm","Group")} value="GROUP" />
                  </Picker>
                </View>
              )}

              {tab === 'notifications' && (
                <TouchableOpacity onPress={() => setModal({visible:true, title:at('Broadcast','Broadcast'), message:at('Gửi thông báo toàn hệ thống','Send global notification'), type:'prompt', action:()=>doAction('broadcast', {id:'all'})})} style={{paddingHorizontal:16, paddingVertical:10, borderRadius:12, backgroundColor:P.primary, flexDirection:'row', alignItems:'center', gap:8}}>
                  <Ionicons name="megaphone-outline" size={18} color="#fff" />
                  <Text style={{fontSize:13, fontWeight:'700', color:'#fff'}}>{at("Gửi Broadcast","Send Broadcast")}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => load()} style={{padding:10, borderRadius:10, backgroundColor:P.primaryBg}}><Ionicons name="refresh" size={20} color={P.primary} /></TouchableOpacity>
            </View>
          </View>

            {selectedIds.length > 0 && (
              <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:12, backgroundColor:P.primaryBg, borderRadius:12, marginBottom:16, borderWidth:1, borderColor:P.primary, borderStyle:'dashed'}}>
                <Text style={{fontSize:13, fontWeight:'600', color:P.primary}}>{selectedIds.length} {at("mục đã chọn","items selected")}</Text>
                <View style={{flexDirection:'row', gap:10}}>
                  {tab === 'users' && <Btn icon="lock-closed-outline" label={at("Khóa loạt","Bulk Lock")} color={P.warning} onPress={() => doAction('bulkLock', {id: 'selected'})} />}
                  {tab === 'posts' && <Btn icon="trash-outline" label={at("Xóa loạt","Bulk Delete")} color={P.danger} onPress={() => doAction('bulkDeletePosts', {id: 'selected'})} />}
                  <TouchableOpacity onPress={() => setSelectedIds([])}><Text style={{color:P.textSec, fontSize:12, fontWeight:'600', padding:8}}>{at("Hủy","Cancel")}</Text></TouchableOpacity>
                </View>
              </View>
            )}

            <ScrollView style={{flex:1}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} />}>
              <View style={{backgroundColor:P.white, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:P.border}}>
                <DataTable 
                  columns={cols()} 
                  data={tableData} 
                  loading={loading} 
                  P={P} 
                  selectable={tab === 'users' || tab === 'posts'}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                />
              </View>
              <Pagination 
                currentPage={page} 
                totalItems={tableTotal} 
                pageSize={7} 
                onPageChange={setPage} 
                P={P} 
                at={at}
              />
            </ScrollView>
          </View>
        )}
      </View>
    </View>

    <ActionModal 
      visible={modal.visible}
      title={modal.title}
      message={modal.message}
      type={modal.type}
      mode={modal.mode}
      inputValue={modal.inputValue}
      onInputChange={(v)=>setModal(prev=>({...prev,inputValue:v}))}
      onConfirm={()=>{
        if(modal.action) modal.action(modal.inputValue);
        else setModal(prev=>({...prev,visible:false}));
      }}
      onCancel={()=>setModal(prev=>({...prev,visible:false}))}
      onDeleteComment={(commentId) => doAction('deleteComment', {commentId, postId: modal.data?.id})}
      onWarnUser={(userId, content) => doAction('warnUser', {userId, content})}
      loading={actionLoading || loadingComments}
      P={P}
      data={modal.data}
      comments={comments}
      at={at}
    />

    {/* Floating Toast Notification */}
    {toast.visible && (
      <View style={{
        position:'absolute', top:20, right:20, zIndex:9999,
        backgroundColor: toast.type==='danger'?P.danger:toast.type==='warning'?P.warning:P.success,
        paddingHorizontal:20, paddingVertical:12, borderRadius:12,
        flexDirection:'row', alignItems:'center', gap:10,
        shadowColor:'#000', shadowOpacity:0.2, shadowRadius:10, elevation:10
      }}>
        <Ionicons name={toast.type==='danger'?'alert-circle':toast.type==='warning'?'warning':'checkmark-circle'} size={20} color="#fff" />
        <Text style={{color:'#fff', fontWeight:'700', fontSize:14}}>{toast.message}</Text>
        <TouchableOpacity onPress={()=>setToast(prev=>({...prev,visible:false}))} style={{marginLeft:10}}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    )}
  </View>;
}
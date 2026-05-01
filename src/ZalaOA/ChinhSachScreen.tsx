import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AnnouncementBanner from './components/AnnouncementBanner';
import NavBar from './components/NavBar';

const { width } = Dimensions.get('window');
const isWide = width > 768;

// ---- Sidebar menu items ----
const SIDEBAR_ITEMS = [
  { id: 'dang-ky', label: 'Chính sách về đăng ký và sử dụng tài khoản OA', active: true },
  { id: 'dat-ten', label: 'Chính sách về đặt tên OA' },
  { id: 'thong-tin', label: 'Chính sách về thông tin giới thiệu và hình ảnh OA' },
  { id: 'xac-thuc', label: 'Chính sách xác thực tài khoản' },
  { id: 'nhom-gmf', label: 'Chính sách về tính năng quản lý nhóm (GMF)' },
  { id: 'khoa-oa', label: 'Chính sách về việc khóa Official Account (gọi tắt là OA)' },
  { id: 'tien-ich', label: 'Chính sách phát triển Tiện ích (Extension)' },
  { id: 'duyet-tien-ich', label: 'Chính sách kiểm duyệt thông tin Tiện ích (Extension)' },
  { id: 'su-dung-tien-ich', label: 'Chính sách sử dụng Tiện ích (Extension)' },
  { id: 'tranh-chap', label: 'Chính sách xử lý tranh chấp thương hiệu' },
  { id: 'url', label: 'Chính sách đăng ký URL tùy biến' },
  { id: 'tuong-tac', label: 'Chính sách về tương tác của OA với người dùng' },
];

// ---- Table of contents ----
const TOC = [
  '1. Chính sách về đặt tên OA',
  '2. Chính sách về hình ảnh',
  '3. Chính sách về thông tin giới thiệu',
  '4. Chính sách xác thực tài khoản OA',
  '5. Chính sách về cập nhật thông tin tài khoản',
  '6. Chính sách về nội dung truyền đạt thông qua tài khoản OA',
  '7. Chính sách về khóa tài khoản Zala Official Account',
];

// ---- Policy content ----
const POLICY_SECTIONS = [
  {
    id: 'intro',
    title: 'Chính sách về đăng ký và sử dụng tài khoản OA',
    content: [
      {
        type: 'paragraph',
        text: 'Zala Official Account là tài khoản xác thực của doanh nghiệp trên nền tảng Zala nhằm cung cấp giải pháp giúp doanh nghiệp kết nối và tương tác với người dùng Zala.',
      },
      {
        type: 'paragraph',
        text: 'Sau đây là các quy định về việc đăng ký, xác thực và sử dụng tài khoản Zala Official Account (sau đây được nhắc đến dưới dạng viết tắt là: OA/ZOA/Zala OA).',
      },
      {
        type: 'note',
        text: 'Lưu ý: Quý Doanh nghiệp vui lòng đọc kỹ các quy định trong Chính sách này. Bằng cách đăng ký và sử dụng tài khoản OA, Quý Doanh nghiệp đồng ý rằng đã đọc, hiểu, chấp nhận và đồng ý với các điều khoản được quy định trong Chính sách. Quý Doanh nghiệp đồng thời đồng ý và xác nhận sẽ tuân thủ đối với các Quy định và Chính sách liên quan được đề cập tại các điều khoản trong Chính sách này.',
      },
    ],
  },
  {
    id: 'dat-ten',
    title: '1. Chính sách về đặt tên OA',
    content: [
      {
        type: 'paragraph',
        text: 'Tên OA cần được đặt theo định dạng sau: Tên OA = [Tiền tố] + [Tên chính] + [Hậu tố]\nTên chính bắt buộc phải là 1 trong 3 loại tên sau:',
      },
      {
        type: 'list',
        items: [
          'Tên OA theo tên doanh nghiệp, hoặc tên gian hàng/ cửa hàng/ địa điểm kinh doanh của doanh nghiệp;',
          'Tên OA theo tên thương hiệu/ nhãn hiệu đã được cấp văn bằng bảo hộ bởi Cục Sở hữu trí tuệ;',
          'Tên OA theo tên sản phẩm/ dịch vụ chính của doanh nghiệp.',
        ],
      },
    ],
  },
  {
    id: 'noi-dung',
    title: '6. Chính sách về nội dung truyền đạt thông qua tài khoản OA',
    content: [
      {
        type: 'list-check',
        items: [
          'Không xuyên tạc sự thật lịch sử, phủ nhận thành tựu cách mạng; xúc phạm dân tộc, danh nhân, anh hùng dân tộc;',
          'Không truyền đạt các nội dung khác bị cấm theo quy định của pháp luật;',
          'Liên kết được đính kèm trong tin nhắn hoặc nội dung OA phải rõ ràng, hợp pháp, không vi phạm pháp luật hoặc nội dung;',
          'Liên kết dẫn tới trang đích có thông tin chính thống, không chứa yếu tố gây hiểu lầm;',
          'Ưu tiên các liên kết thuộc hệ sinh thái đáng tin cậy hoặc đã được kiểm duyệt;',
          'Đối với liên kết đến ứng dụng gốc (native app), chỉ chấp nhận các liên kết thuộc ứng dụng trong hệ sinh thái chính thức của Zalo;',
          'Tuân thủ các quy định của nền tảng Zala, các quy định của Zala Official Account và các chính sách liên quan khác.',
        ],
      },
    ],
  },
  {
    id: 'khoa-tai-khoan',
    title: '7. Chính sách về khóa tài khoản Zala Official Account',
    content: [
      {
        type: 'paragraph',
        text: 'Chúng tôi sẽ tiến hành ngưng cung cấp dịch vụ hoặc một phần dịch vụ đối với Quý Doanh nghiệp không tuân thủ quy định hoặc có các hành vi gây ảnh hưởng tiêu cực đến người dùng cuối.',
      },
      {
        type: 'paragraph',
        text: 'Chi tiết Chính sách về khóa tài khoản tham khảo tại đây.',
      },
      {
        type: 'divider',
        text: '',
      },
      {
        type: 'paragraph',
        text: 'Nếu có thắc mắc khác, vui lòng cung cấp OA ID (lấy tại đây) và gửi email hoặc chat với chúng tôi để được phản hồi sớm nhất.',
      },
    ],
  },
];

export default function ChinhSachScreen() {
  const [activeSection, setActiveSection] = useState('dang-ky');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const renderContent = (content: any[]) =>
    content.map((block, i) => {
      if (block.type === 'paragraph') {
        return (
          <Text key={i} className="text-sm text-gray-700 leading-6 mb-4">
            {block.text}
          </Text>
        );
      }
      if (block.type === 'note') {
        return (
          <View key={i} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg mb-4">
            <Text className="text-xs text-yellow-800 leading-5">{block.text}</Text>
          </View>
        );
      }
      if (block.type === 'list') {
        return (
          <View key={i} className="mb-4 gap-2">
            {block.items.map((item: string, j: number) => (
              <View key={j} className="flex-row items-start gap-2">
                <Text className="text-gray-500 text-sm mt-0.5">{j + 1}.</Text>
                <Text className="flex-1 text-sm text-gray-700 leading-6">{item}</Text>
              </View>
            ))}
          </View>
        );
      }
      if (block.type === 'list-check') {
        return (
          <View key={i} className="mb-4 gap-3">
            {block.items.map((item: string, j: number) => (
              <View key={j} className="flex-row items-start gap-2">
                <Text className="text-gray-500 text-sm mt-0.5">•</Text>
                <Text className="flex-1 text-sm text-gray-700 leading-6">{item}</Text>
              </View>
            ))}
          </View>
        );
      }
      if (block.type === 'divider') {
        return <View key={i} className="border-t border-gray-200 my-4" />;
      }
      return null;
    });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AnnouncementBanner />
      <NavBar />

      {/* Hero banner */}
      <View className="bg-[#EBF3FF] py-6 px-6 items-center">
        <Text className="text-2xl font-black text-gray-900 uppercase tracking-wide">
          CHÍNH SÁCH
        </Text>
      </View>

      {/* Mobile sidebar toggle */}
      {!isWide && (
        <TouchableOpacity
          className="flex-row items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50"
          onPress={() => setSidebarOpen(!sidebarOpen)}
        >
          <Ionicons name={sidebarOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#0068FF" />
          <Text className="text-[#0068FF] text-sm font-semibold flex-1" numberOfLines={1}>
            {SIDEBAR_ITEMS.find(s => s.id === activeSection)?.label ?? 'Chọn chính sách'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Main content area */}
      <View className="flex-1 flex-row">
        {/* ---- Sidebar ---- */}
        {(isWide || sidebarOpen) && (
          <View
            className="border-r border-gray-200 bg-white"
            style={{ width: isWide ? 220 : '100%' }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {SIDEBAR_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    setActiveSection(item.id);
                    setSidebarOpen(false);
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }}
                  className={`px-4 py-3 border-b border-gray-50 ${
                    activeSection === item.id ? 'border-l-4 border-l-[#0068FF] bg-blue-50' : ''
                  }`}
                >
                  <Text
                    className={`text-xs leading-5 ${
                      activeSection === item.id
                        ? 'text-[#0068FF] font-semibold'
                        : 'text-gray-600'
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---- Main content + TOC ---- */}
        {(!sidebarOpen || isWide) && (
          <View className="flex-1 flex-row">
            {/* Content */}
            <ScrollView
              ref={scrollRef}
              className="flex-1 px-5 py-6"
              showsVerticalScrollIndicator={false}
            >
              {POLICY_SECTIONS.map((section) => (
                <View key={section.id} className="mb-8">
                  <Text className="text-lg font-black text-gray-900 mb-4 leading-7">
                    {section.title}
                  </Text>
                  {renderContent(section.content)}
                </View>
              ))}
              <View className="h-16" />
            </ScrollView>

            {/* TOC - only on wide screens */}
            {isWide && (
              <View className="border-l border-gray-200 px-4 py-6" style={{ width: 220 }}>
                <Text className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wide">
                  Mục lục
                </Text>
                {TOC.map((item, i) => (
                  <TouchableOpacity key={i} className="mb-3">
                    <Text className="text-xs text-gray-500 leading-5 hover:text-[#0068FF]">
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

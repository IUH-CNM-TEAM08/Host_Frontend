// @ts-nocheck
/**
 * ChatInputBar — Ô nhập tin nhắn + ghi âm + emoji + sticker + menu đính kèm + nút gửi.
 * Tách từ ChatArea.tsx, giữ nguyên logic + UI.
 */
import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Image,
  Animated,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import EmojiPicker from "../EmojiPicker";
import StickerPicker from "../StickerPicker";
import { Shadows } from "@/src/styles/Shadow";

type ChatInputBarProps = {
  // State
  newMessage: string;
  inputHeight: number;
  inputRef: React.RefObject<any>;
  cursorPosition: number;
  isRecordingVoice: boolean;
  voiceRecordingSeconds: number;
  recordingWaveform: number[];
  isModelChecked: boolean;
  isModelEmoji: boolean;
  showStickerPicker: boolean;
  showMentionSuggestions: boolean;
  filteredMembers: any[];
  mentionSelectedIndex: number;
  replyingTo: any;
  pendingAttachments: any[];
  peerMessageBlockedMe: boolean;
  canSendMessage: boolean;
  mobileBottomSafeOffset: number;
  selectedChat: any;
  showVoiceSheet: boolean;
  isModelSticker: boolean;
  isFetchingLocation: boolean;
  scaleAnimation: Animated.Value;
  groupChat: any;
  // Setters
  setNewMessage: (msg: string | ((prev: string) => string)) => void;
  setInputHeight: (h: number) => void;
  setCursorPosition: (pos: number) => void;
  setMentionSelectedIndex: (idx: number | ((prev: number) => number)) => void;
  // Handlers
  handleTextChange: (text: string) => void;
  handleSendMessage: () => void;
  handleSelectFile: () => void;
  handleSelectImage: () => void;
  handleSelectVideo: () => void;
  handleStickerSelect: (sticker: any) => void;
  toggleModelChecked: () => void;
  toggleModelEmoji: () => void;
  toggleStickerPicker: () => void;
  toggleModelVote: () => void;
  cancelReply: () => void;
  cancelRecording: () => void;
  stopAndSendVoiceRecording: () => void;
  onSelectMention: (member: any) => void;
  getSenderDisplayLabel: (id: string) => string;
  setShowVoiceSheet: (show: boolean) => void;
  setShowBgPicker: (show: boolean) => void;
  handleSendCurrentLocation: () => void;
  handleShareLocation: () => void;
  handleCreateAppointmentQuick: () => void;
  toggleModelSticker: () => void;
};

export default function ChatInputBar(props: ChatInputBarProps) {
  const {
    newMessage, inputHeight, inputRef, cursorPosition,
    isRecordingVoice, voiceRecordingSeconds, recordingWaveform,
    isModelChecked, isModelEmoji, showStickerPicker,
    showMentionSuggestions, filteredMembers, mentionSelectedIndex,
    replyingTo, pendingAttachments, peerMessageBlockedMe, canSendMessage,
    mobileBottomSafeOffset, selectedChat, showVoiceSheet,
    isModelSticker, isFetchingLocation, scaleAnimation, groupChat,
    setNewMessage, setInputHeight, setCursorPosition, setMentionSelectedIndex,
    handleTextChange, handleSendMessage, handleSelectFile,
    handleSelectImage, handleSelectVideo, handleStickerSelect,
    toggleModelChecked, toggleModelEmoji, toggleStickerPicker,
    toggleModelVote, cancelReply, cancelRecording, stopAndSendVoiceRecording,
    onSelectMention, getSenderDisplayLabel, setShowVoiceSheet,
    setShowBgPicker, handleSendCurrentLocation, handleShareLocation,
    handleCreateAppointmentQuick, toggleModelSticker,
  } = props;

  const { width: viewportWidth } = useWindowDimensions();

  // GIPHY sticker: lưu URL cần gửi
  const giphyPendingRef = React.useRef<string | null>(null);
  const [giphyPreview, setGiphyPreview] = React.useState<string | null>(null);

  const handleSendGiphySticker = React.useCallback((url: string) => {
    giphyPendingRef.current = url;
    setGiphyPreview(url);
  }, []);

  // Effect: khi giphyPreview được set, gửi tin nhắn
  React.useEffect(() => {
    if (giphyPendingRef.current) {
      const url = giphyPendingRef.current;
      giphyPendingRef.current = null;
      setNewMessage(url);
      // Delay để đảm bảo state đã cập nhật
      const timer = setTimeout(() => {
        handleSendMessage();
        setGiphyPreview(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [giphyPreview]);

  return (
       <View
             className="border-t border-gray-200 p-4"
             style={{ paddingBottom: mobileBottomSafeOffset }}
           >
             {/* GIPHY Sticker Preview - hiện nhanh rồi auto gửi */}
             {giphyPreview && (
               <View style={{
                 marginBottom: 8,
                 padding: 8,
                 borderRadius: 12,
                 backgroundColor: '#f9fafb',
                 borderWidth: 1,
                 borderColor: '#e5e7eb',
                 flexDirection: 'row',
                 alignItems: 'center',
                 gap: 10,
               }}>
                 <Image
                   source={{ uri: giphyPreview }}
                   style={{ width: 60, height: 60, borderRadius: 8 }}
                   resizeMode="contain"
                 />
                 <Text style={{ fontSize: 12, color: '#6b7280' }}>Đang gửi sticker...</Text>
               </View>
             )}
             {isRecordingVoice && (
               <View
                 style={{
                   marginBottom: 8,
                   paddingHorizontal: 12,
                   paddingVertical: 8,
                   borderRadius: 12,
                   backgroundColor: "#FEF2F2",
                   borderWidth: 1,
                   borderColor: "#FECACA",
                   flexDirection: "row",
                   alignItems: "center",
                   justifyContent: "space-between",
                 }}
               >
                 <View
                   style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                 >
                   <Ionicons name="mic" size={16} color="#DC2626" />
                   <Text
                     style={{ marginLeft: 8, color: "#B91C1C", fontWeight: "600" }}
                   >
                     Đang ghi âm {voiceRecordingSeconds}s
                   </Text>
                   <View
                     style={{
                       marginLeft: 10,
                       flexDirection: "row",
                       alignItems: "flex-end",
                       gap: 2,
                       height: 22,
                       flexShrink: 1,
                     }}
                   >
                     {recordingWaveform.map((bar, idx) => (
                       <View
                         key={`rec-wave-${idx}`}
                         style={{
                           width: 2,
                           height: bar,
                           borderRadius: 2,
                           backgroundColor: "#EF4444",
                           opacity: 0.95,
                         }}
                       />
                     ))}
                   </View>
                 </View>
                 <TouchableOpacity
                   onPress={() => void stopAndSendVoiceRecording()}
                   style={{
                     backgroundColor: "#DC2626",
                     borderRadius: 999,
                     paddingHorizontal: 10,
                     paddingVertical: 4,
                   }}
                 >
                   <Text
                     style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}
                   >
                     Dừng & gửi
                   </Text>
                 </TouchableOpacity>
               </View>
             )}
             <View className="flex-row items-center position-relative">
               {/* Nút ➕ mở popup chọn loại file (giữ nguyên như cũ) */}
               <View className="relative">
                 <TouchableOpacity className="p-2" onPress={toggleModelChecked}>
                   <Ionicons name="add-circle-outline" size={24} color="#666" />
                 </TouchableOpacity>
   
                 {/* Badge đỏ khi có file trong queue */}
                 {pendingAttachments.length > 0 && (
                   <View
                     style={{
                       position: "absolute",
                       top: 2,
                       right: 2,
                       backgroundColor: "#3b82f6",
                       borderRadius: 8,
                       minWidth: 16,
                       height: 16,
                       alignItems: "center",
                       justifyContent: "center",
                       paddingHorizontal: 3,
                     }}
                   >
                     <Text
                       style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}
                     >
                       {pendingAttachments.length}
                     </Text>
                   </View>
                 )}
   
                 {/* Popup chọn loại tệp — giống cũ */}
                 {isModelChecked && (
                   <View className="absolute bottom-full left-0 bg-white z-50">
                     <Animated.View
                       style={{
                         transform: [
                           {
                             translateY: scaleAnimation.interpolate({
                               inputRange: [0, 1],
                               outputRange: [30, 0],
                             }),
                           },
                         ],
                         opacity: scaleAnimation.interpolate({
                           inputRange: [0, 1],
                           outputRange: [0, 1],
                         }),
                       }}
                     >
                       <View
                         className="bg-white rounded-lg p-4 w-[220px]"
                         style={Shadows.md}
                       >
                         <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">
                           Đính kèm
                         </Text>
   
                         {/* Hình ảnh / Video */}
                         <TouchableOpacity
                           className="flex-row items-center mb-2"
                           onPress={() => {
                             toggleModelChecked();
                             handleSelectFile();
                           }}
                         >
                           <Ionicons name="image-outline" size={24} color="#666" />
                           <Text className="ml-2 text-gray-800">
                             Hình ảnh/Video
                           </Text>
                         </TouchableOpacity>
   
                         {/* File */}
                         <TouchableOpacity
                           className="flex-row items-center mb-2"
                           onPress={() => {
                             toggleModelChecked();
                             handleSelectFile();
                           }}
                         >
                           <Ionicons
                             name="file-tray-full-outline"
                             size={24}
                             color="#666"
                           />
                           <Text className="ml-2 text-gray-800">File</Text>
                         </TouchableOpacity>
   
                         <TouchableOpacity
                           className="flex-row items-center mb-2"
                           disabled={isFetchingLocation}
                           onPress={() => {
                             toggleModelChecked();
                             handleShareLocation();
                           }}
                         >
                           {isFetchingLocation ? (
                             <ActivityIndicator
                               size="small"
                               color="#2563eb"
                               style={{ width: 24, height: 24 }}
                             />
                           ) : (
                             <Ionicons
                               name="location-outline"
                               size={24}
                               color="#2563eb"
                             />
                           )}
                           <Text className="ml-2 text-gray-800">
                             {isFetchingLocation
                               ? "Đang lấy vị trí..."
                               : "Chia sẻ vị trí"}
                           </Text>
                         </TouchableOpacity>
   
                         <TouchableOpacity
                           className="flex-row items-center mb-2"
                           style={{
                             opacity:
                               groupChat.isAdminOrMod ||
                               groupChat.isAllowMemberCreateNote
                                 ? 1
                                 : 0.5,
                           }}
                           onPress={() => {
                             if (
                               !groupChat.isAdminOrMod &&
                               !groupChat.isAllowMemberCreateNote
                             ) {
                               Alert.alert(
                                 "Quyền hạn",
                                 "Quản trị viên đã tắt quyền tạo lịch hẹn đối với thành viên.",
                               );
                               return;
                             }
                             toggleModelChecked();
                             handleCreateAppointmentQuick();
                           }}
                         >
                           <Ionicons
                             name="calendar-outline"
                             size={24}
                             color="#2563eb"
                           />
                           <Text className="ml-2 text-gray-800">Tạo lịch hẹn</Text>
                         </TouchableOpacity>
   
                         <TouchableOpacity
                           className="flex-row items-center"
                           onPress={() => {
                             toggleModelChecked();
                             setShowVoiceSheet(true);
                           }}
                         >
                           <Ionicons
                             name="mic-outline"
                             size={24}
                             color="#666"
                           />
                           <Text className="ml-2 text-gray-800">
                             Ghi âm thoại
                           </Text>
                         </TouchableOpacity>
   
                         {/* Đổi ảnh nền */}
                         <TouchableOpacity
                           className="flex-row items-center mt-2"
                           onPress={() => {
                             toggleModelChecked();
                             setShowBgPicker(true);
                           }}
                         >
                           <Ionicons
                             name="image-outline"
                             size={24}
                             color="#7c3aed"
                           />
                           <Text
                             className="ml-2"
                             style={{ color: "#7c3aed", fontWeight: "600" }}
                           >
                             Đổi ảnh nền
                           </Text>
                         </TouchableOpacity>
                       </View>
                     </Animated.View>
                   </View>
                 )}
               </View>
   
               <View className="relative">
                 <TouchableOpacity className="p-2" onPress={toggleModelSticker}>
                   <Ionicons name="apps" size={24} color="#666" />
                 </TouchableOpacity>
                 {isModelSticker && (
                   <View
                     className="absolute bottom-full bg-white z-50 left-0 rounded-lg overflow-hidden border border-gray-200"
                     style={Shadows.xl}
                   >
                     <StickerPicker
                       setMessage={setNewMessage}
                       toggleModelSticker={toggleModelSticker}
                       onSendGiphySticker={handleSendGiphySticker}
                     />
                   </View>
                 )}
               </View>
   
               <View className="relative">
                 <TouchableOpacity
                   className="p-2"
                   onPress={() => {
                     if (
                       !groupChat.isAdminOrMod &&
                       !groupChat.isAllowMemberCreatePoll
                     ) {
                       Alert.alert(
                         "Quyền hạn",
                         "Quản trị viên đã tắt quyền tạo bình chọn đối với thành viên.",
                       );
                       return;
                     }
                     toggleModelVote();
                   }}
                   style={{
                     opacity:
                       groupChat.isAdminOrMod || groupChat.isAllowMemberCreatePoll
                         ? 1
                         : 0.5,
                   }}
                 >
                   <Ionicons name="bar-chart-outline" size={24} color="#666" />
                 </TouchableOpacity>
               </View>
   
               <View className="flex-1 bg-gray-100 rounded-full mx-2 px-4 py-2 relative">
                 {showMentionSuggestions && filteredMembers.length > 0 && (
                   <View
                     className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-lg mb-2 overflow-hidden"
                     style={[Shadows.lg, { maxHeight: 200, width: Math.min(250, viewportWidth - 40) }]}
                   >
                     <ScrollView keyboardShouldPersistTaps="handled">
                       {filteredMembers.map((item: any, idx) => (
                         <TouchableOpacity
                           key={item.id}
                           className={`flex-row items-center p-3 border-b border-gray-50 ${idx === mentionSelectedIndex ? "bg-blue-50" : "active:bg-gray-100"}`}
                           onPress={() => onSelectMention(item)}
                         >
                           <Image
                             source={{
                               uri:
                                 item.avatar ||
                                 `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`,
                             }}
                             className="w-8 h-8 rounded-full"
                           />
                           <View className="ml-3">
                             <Text className="text-gray-900 font-semibold text-sm">
                               {item.name}
                             </Text>
                             {item.nickname && (
                               <Text className="text-gray-500 text-xs italic">
                                 ({item.nickname})
                               </Text>
                             )}
                           </View>
                         </TouchableOpacity>
                       ))}
                     </ScrollView>
                   </View>
                 )}
                 <TextInput
                   className="text-base text-gray-800"
                   placeholder="Nhập tin nhắn..."
                   value={newMessage}
                   onChangeText={handleTextChange}
                   onSelectionChange={(event) =>
                     setCursorPosition(event.nativeEvent.selection.start)
                   }
                   onKeyPress={(e: any) => {
                     if (showMentionSuggestions && filteredMembers.length > 0) {
                       if (e.nativeEvent.key === "ArrowDown") {
                         setMentionSelectedIndex(
                           (prev) => (prev + 1) % filteredMembers.length,
                         );
                         return;
                       }
                       if (e.nativeEvent.key === "ArrowUp") {
                         setMentionSelectedIndex(
                           (prev) =>
                             (prev - 1 + filteredMembers.length) %
                             filteredMembers.length,
                         );
                         return;
                       }
                       if (e.nativeEvent.key === "Enter") {
                         e.preventDefault();
                         onSelectMention(filteredMembers[mentionSelectedIndex]);
                         return;
                       }
                     }
   
                     if (
                       Platform.OS === "web" &&
                       e.nativeEvent.key === "Enter" &&
                       !e.nativeEvent.shiftKey
                     ) {
                       e.preventDefault();
                       void handleSendMessage();
                     }
                   }}
                   multiline
                   numberOfLines={1}
                   placeholderTextColor="#666"
                   style={{
                     borderWidth: 0,
                     height: Math.max(24, Math.min(inputHeight, 72)),
                     paddingVertical: 0,
                     lineHeight: 20,
                     textAlignVertical: "center",
                     ...(Platform.OS === "android"
                       ? { includeFontPadding: false }
                       : {}),
                   }}
                   onContentSizeChange={(event) => {
                     const { height } = event.nativeEvent.contentSize;
                     setInputHeight(height > 24 ? height : 24);
                   }}
                 />
               </View>
   
               <View className="relative">
                 <TouchableOpacity className="p-2" onPress={toggleModelEmoji}>
                   <Ionicons name="happy-outline" size={24} color="#666" />
                 </TouchableOpacity>
                 {isModelEmoji && (
                   <View
                     className="absolute bottom-full bg-white z-50 right-0 rounded-lg overflow-hidden border border-gray-200"
                     style={[Shadows.xl, { width: Math.min(300, viewportWidth - 32) }]}
                   >
                     <EmojiPicker
                       setMessage={setNewMessage}
                       toggleModelEmoji={toggleModelEmoji}
                     />
                   </View>
                 )}
               </View>
   
               <TouchableOpacity
                 className={`p-3 rounded-full ${
                   (newMessage.trim() || pendingAttachments.length > 0) &&
                   !peerMessageBlockedMe
                     ? ""
                     : "bg-gray-200"
                 }`}
                 onPress={handleSendMessage}
                 disabled={
                   peerMessageBlockedMe ||
                   !groupChat.canSendMessage ||
                   (!newMessage.trim() && pendingAttachments.length === 0)
                 }
                 style={[
                   (newMessage.trim() || pendingAttachments.length > 0) &&
                     !peerMessageBlockedMe &&
                     Shadows.md,
                   {
                     backgroundColor:
                       (newMessage.trim() || pendingAttachments.length > 0) &&
                       !peerMessageBlockedMe
                         ? "#6d28d9"
                         : undefined,
                     transform: [
                       {
                         scale:
                           (newMessage.trim() || pendingAttachments.length > 0) &&
                           !peerMessageBlockedMe
                             ? 1
                             : 0.95,
                       },
                     ],
                   },
                 ]}
               >
                 <Ionicons
                   name="send"
                   size={20}
                   color={
                     (newMessage.trim() || pendingAttachments.length > 0) &&
                     !peerMessageBlockedMe
                       ? "#FFF"
                       : "#999"
                   }
                 />
               </TouchableOpacity>
             </View>
           </View>
  );
}

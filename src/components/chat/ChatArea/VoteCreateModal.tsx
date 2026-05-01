// @ts-nocheck
/**
 * VoteCreateModal — Modal tạo bình chọn (Zala vote).
 * Tách từ ChatArea.tsx, giữ nguyên logic + UI.
 * State vote nằm hoàn toàn bên trong component.
 */
import React, { useState, useMemo } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

type VoteCreateModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Callback khi user nhấn "Tạo bình chọn" — trả về data đã validate */
  onSubmit: (data: {
    question: string;
    options: string[];
    allowMultiple: boolean;
    deadlineDate: string;
    deadlineTime: string;
  }) => void;
};

export default function VoteCreateModal({
  visible,
  onClose,
  onSubmit,
}: VoteCreateModalProps) {
  const [voteQuestion, setVoteQuestion] = useState("");
  const [voteOptions, setVoteOptions] = useState([""]);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [voteDeadlineDate, setVoteDeadlineDate] = useState("");
  const [voteDeadlineTime, setVoteDeadlineTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());

  const addVoteOption = () => setVoteOptions([...voteOptions, ""]);

  const handleVoteOptionChange = (index: number, value: string) => {
    const newOptions = [...voteOptions];
    newOptions[index] = value;
    setVoteOptions(newOptions);
  };

  const removeVoteOption = (index: number) => {
    if (voteOptions.length <= 1) return;
    setVoteOptions(voteOptions.filter((_, i) => i !== index));
  };

  const setQuickDeadline = (hours: number) => {
    const future = new Date();
    future.setHours(future.getHours() + hours);
    const day = future.getDate().toString().padStart(2, "0");
    const month = (future.getMonth() + 1).toString().padStart(2, "0");
    const year = future.getFullYear();
    setVoteDeadlineDate(`${day}/${month}/${year}`);
    const h = future.getHours().toString().padStart(2, "0");
    const m = future.getMinutes().toString().padStart(2, "0");
    setVoteDeadlineTime(`${h}:${m}`);
  };

  /** Helper: format Date → "dd/mm/yyyy" */
  const formatDateStr = (d: Date) => {
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setTempSelectedDate(selectedDate);
      setVoteDeadlineDate(formatDateStr(selectedDate));
    }
  };

  const onTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      // Sync giờ vào tempSelectedDate (giữ ngày đã chọn)
      const next = new Date(tempSelectedDate);
      next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

      // Auto-advance: nếu datetime kết hợp < hiện tại → tăng 1 ngày
      if (next <= new Date()) {
        next.setDate(next.getDate() + 1);
      }

      setTempSelectedDate(next);
      setVoteDeadlineDate(formatDateStr(next));
      const hours = selectedTime.getHours().toString().padStart(2, "0");
      const minutes = selectedTime.getMinutes().toString().padStart(2, "0");
      setVoteDeadlineTime(`${hours}:${minutes}`);
    }
  };

  // Web: tính min date = hôm nay (yyyy-mm-dd)
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const handleCreate = () => {
    if (!voteQuestion.trim()) return;
    const filteredOptions = voteOptions.filter((opt) => opt.trim());
    if (filteredOptions.length < 2) return;

    onSubmit({
      question: voteQuestion,
      options: filteredOptions,
      allowMultiple: allowMultipleVotes,
      deadlineDate: voteDeadlineDate,
      deadlineTime: voteDeadlineTime,
    });

    // Reset
    setVoteQuestion("");
    setVoteOptions([""]);
    setVoteDeadlineDate("");
    setVoteDeadlineTime("");
    setAllowMultipleVotes(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center">
      <View className="bg-white rounded-2xl p-5 w-[90%] max-w-md">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-xl font-semibold">Tạo bình chọn</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Vote Question */}
        <View className="mb-5">
          <Text className="text-gray-500 mb-2">Chủ đề bình chọn</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 min-h-[45px] text-base"
            placeholder="Đặt câu hỏi bình chọn"
            value={voteQuestion}
            onChangeText={setVoteQuestion}
            multiline
            maxLength={200}
          />
          <Text className="text-right text-gray-500 mt-1">
            {voteQuestion.length}/200
          </Text>
        </View>

        {/* Vote Options */}
        <View className="mb-5">
          <Text className="text-gray-500 mb-2">Các lựa chọn</Text>
          {voteOptions.map((option, index) => (
            <View key={`option-${index}`} className="flex-row items-center mb-3">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg p-3 min-h-[45px] text-base"
                placeholder={`Lựa chọn ${index + 1}`}
                value={option}
                onChangeText={(text) => handleVoteOptionChange(index, text)}
              />
              {voteOptions.length > 1 && (
                <TouchableOpacity onPress={() => removeVoteOption(index)} className="ml-2 p-2">
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity className="flex-row items-center mb-5" onPress={addVoteOption}>
            <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
            <Text className="ml-2 text-blue-500">Thêm lựa chọn</Text>
          </TouchableOpacity>

          {/* Deadline */}
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-500">Thời gian hết hạn (không bắt buộc)</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity onPress={() => setQuickDeadline(1)} className="bg-blue-50 px-2 py-1 rounded">
                <Text className="text-blue-600 text-xs font-medium">+1 giờ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setQuickDeadline(24)} className="bg-blue-50 px-2 py-1 rounded">
                <Text className="text-blue-600 text-xs font-medium">+24 giờ</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row gap-2 mb-2">
            <View className="flex-1 relative">
              {Platform.OS === "web" ? (
                <View className="flex-row items-center border border-gray-300 rounded-lg bg-white p-2">
                  <Ionicons name="calendar-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                  <input
                    type="date"
                    min={todayStr}
                    value={voteDeadlineDate ? voteDeadlineDate.split("/").reverse().join("-") : ""}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "14px", color: voteDeadlineDate ? "#000" : "#9ca3af" }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [y, m, d] = val.split("-");
                        onDateChange({}, new Date(parseInt(y), parseInt(m) - 1, parseInt(d)));
                      } else {
                        setVoteDeadlineDate("");
                      }
                    }}
                  />
                </View>
              ) : (
                <TouchableOpacity className="w-full border border-gray-300 rounded-lg p-3 justify-center" onPress={() => setShowDatePicker(true)}>
                  <Text style={{ color: voteDeadlineDate ? "#000" : "#9ca3af" }}>{voteDeadlineDate || "Chọn ngày"}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-1 relative">
              {Platform.OS === "web" ? (
                <View className="flex-row items-center border border-gray-300 rounded-lg bg-white p-2">
                  <Ionicons name="time-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                  <input
                    type="time"
                    value={voteDeadlineTime || ""}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "14px", color: voteDeadlineTime ? "#000" : "#9ca3af" }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [h, min] = val.split(":");
                        const d = new Date(tempSelectedDate || new Date());
                        d.setHours(parseInt(h));
                        d.setMinutes(parseInt(min));
                        onTimeChange({}, d);
                      } else {
                        setVoteDeadlineTime("");
                      }
                    }}
                  />
                </View>
              ) : (
                <TouchableOpacity className="w-full border border-gray-300 rounded-lg p-3 justify-center" onPress={() => setShowTimePicker(true)}>
                  <Text style={{ color: voteDeadlineTime ? "#000" : "#9ca3af" }}>{voteDeadlineTime || "Chọn giờ"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Mobile Pickers */}
          {Platform.OS !== "web" && showDatePicker && (
            <DateTimePicker value={tempSelectedDate} mode="date" display="default" onChange={onDateChange} minimumDate={new Date()} />
          )}
          {Platform.OS !== "web" && showTimePicker && (
            <DateTimePicker value={tempSelectedDate} mode="time" is24Hour={true} display="default" onChange={onTimeChange} />
          )}
        </View>

        <View className="flex-row items-center mb-5">
          <Switch
            value={allowMultipleVotes}
            onValueChange={setAllowMultipleVotes}
            trackColor={{ false: "#d1d5db", true: "#bfdbfe" }}
            thumbColor={allowMultipleVotes ? "#3B82F6" : "#9ca3af"}
          />
          <Text className="ml-2 text-gray-700">Cho phép chọn nhiều lựa chọn</Text>
        </View>

        {/* Footer */}
        <View className="flex-row justify-end mt-2">
          <TouchableOpacity className="px-5 py-2 mr-2 rounded-lg bg-gray-100" onPress={onClose}>
            <Text className="font-medium text-gray-700">Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity className="px-5 py-2 rounded-lg bg-blue-500" onPress={handleCreate}>
            <Text className="font-medium text-white">Tạo bình chọn</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SocketService from '@/src/api/socketCompat';

interface VoteOption {
  id: string;
  text: string;
  votes: string[];
}

interface VoteData {
  question: string;
  options: VoteOption[];
  multiple: boolean;
  closed?: boolean;
  creatorId?: string;
  deadline?: string | null; // ISO string
}

interface VoteMessageContentProps {
  messageId: string;
  voteData: VoteData | string;
  userId: string;
  conversationId: string;
  participants: any[];
  userInfos?: Record<string, any>;
}

/** Tính khoảng thời gian còn lại, trả về chuỗi dạng "2h 15m" hoặc "Hết hạn" */
function formatCountdown(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Hết hạn';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const VoteMessageContent: React.FC<VoteMessageContentProps> = ({
  messageId,
  voteData,
  userId,
  conversationId,
  participants = [],
  userInfos = {}
}) => {
  const [vote, setVote] = useState<VoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userVoted, setUserVoted] = useState<boolean>(false);
  const [countdownText, setCountdownText] = useState('');
  const [showAddOption, setShowAddOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState('');
  const socketService = SocketService.getInstance();
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper: safely parse voteData (handles object, JSON string, double-encoded JSON)
  const safeParseVoteData = (data: VoteData | string): VoteData | null => {
    if (!data) return null;
    // Already an object with expected shape
    if (typeof data === 'object' && data !== null && 'options' in data) {
      return data as VoteData;
    }
    if (typeof data === 'string') {
      // Try direct parse
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && 'options' in parsed) return parsed;
        // Double-encoded: parse again
        if (typeof parsed === 'string') {
          const parsed2 = JSON.parse(parsed);
          if (parsed2 && typeof parsed2 === 'object' && 'options' in parsed2) return parsed2;
        }
      } catch {
        // Not valid JSON → ignore silently, show empty state
      }
    }
    return null;
  };

  // Kiểm tra bình chọn đã đóng hoặc hết hạn
  const isVoteClosed = (v: VoteData | null): boolean => {
    if (!v) return false;
    if (v.closed) return true;
    if (v.deadline && new Date(v.deadline).getTime() < Date.now()) return true;
    return false;
  };

  // Cập nhật user voted status
  const updateUserVotedState = (v: VoteData) => {
    const hasVoted = v.options.some(option =>
      option.votes && option.votes.includes(userId)
    );
    setUserVoted(hasVoted);
  };

  useEffect(() => {
    // Parse vote data safely
    const parsed = safeParseVoteData(voteData);
    if (parsed) {
      setVote(parsed);
      updateUserVotedState(parsed);
    } else if (voteData) {
      console.warn('VoteMessageContent: could not parse voteData, showing placeholder.', voteData);
    }

    // Set up socket listeners
    const handleVoteUpdated = (data: { conversationId: string, vote: any }) => {
      if (!data?.vote || (data.vote.id !== messageId && data.vote._id !== messageId)) {
        return;
      }
      const updatedVote = safeParseVoteData(data.vote.content);
      if (updatedVote) {
        setVote(updatedVote);
        updateUserVotedState(updatedVote);
      }
    };

    const handleVoteResult = (data: { conversationId: string, vote: any }) => {
      if (!data?.vote || (data.vote.id !== messageId && data.vote._id !== messageId)) {
        return;
      }
      const updatedVote = safeParseVoteData(data.vote.content);
      if (updatedVote) {
        setVote(updatedVote);
        updateUserVotedState(updatedVote);
      }
    };

    const handleVoteClosed = (data: { conversationId: string, vote: any }) => {
      if (!data?.vote || (data.vote.id !== messageId && data.vote._id !== messageId)) return;
      const updatedVote = safeParseVoteData(data.vote.content);
      if (updatedVote) {
        setVote(updatedVote);
        updateUserVotedState(updatedVote);
      }
    };

    const handleVoteOptionAdded = (data: { conversationId: string, vote: any }) => {
      if (!data?.vote || (data.vote.id !== messageId && data.vote._id !== messageId)) return;
      const updatedVote = safeParseVoteData(data.vote.content);
      if (updatedVote) {
        setVote(updatedVote);
        updateUserVotedState(updatedVote);
      }
    };

    const handleVoteError = (error: { message: string }) => {
      setError(error.message);
      setLoading(false);
    };

    socketService.onVoteUpdated(handleVoteUpdated);
    socketService.onVoteResult(handleVoteResult);
    socketService.onVoteClosed(handleVoteClosed);
    socketService.onVoteOptionAdded(handleVoteOptionAdded);
    socketService.onVoteError(handleVoteError);

    // Request the latest vote data
    socketService.getVote({ conversationId, voteId: messageId });

    return () => {
      socketService.removeVoteUpdatedListener(handleVoteUpdated);
      socketService.removeVoteResultListener(handleVoteResult);
      socketService.removeVoteClosedListener(handleVoteClosed);
      socketService.removeVoteOptionAddedListener(handleVoteOptionAdded);
      socketService.removeVoteErrorListener(handleVoteError);
    };
  }, [messageId, conversationId, voteData]);

  // Countdown timer cho deadline
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!vote?.deadline) {
      setCountdownText('');
      return;
    }
    const updateCountdown = () => {
      setCountdownText(formatCountdown(vote.deadline!));
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 30000); // Mỗi 30s
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [vote?.deadline]);

  const handleVote = (optionId: string) => {
    if (isVoteClosed(vote)) return;

    // For non-multiple votes, allow clicking ONLY if it's to toggle (unvote) or switch
    if (!vote?.multiple && userVoted) {
        // We let the backend handle the logic (toggle if same, switch if different)
    }

    setLoading(true);
    socketService.submitVote({
      conversationId,
      voteId: messageId,
      optionId
    });
    // Reset loading after a short delay
    setTimeout(() => setLoading(false), 1000);
  };

  const handleCloseVote = () => {
    socketService.closeVote({ conversationId, voteId: messageId });
  };

  const handleAddOption = () => {
    if (!newOptionText.trim()) return;
    socketService.addVoteOption({
      messageId,
      optionText: newOptionText.trim(),
      conversationId,
    });
    setNewOptionText('');
    setShowAddOption(false);
  };

  const getTotalVotes = () => {
    if (!vote) return 0;
    return vote.options.reduce((total, option) =>
      total + (option.votes ? option.votes.length : 0), 0
    );
  };

  const getPercentage = (votes: number) => {
    const total = getTotalVotes();
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  if (error) {
    return (
      <View style={{ padding: 12, borderRadius: 8, backgroundColor: '#fef2f2' }}>
        <Text style={{ color: '#ef4444', fontSize: 13 }}>Lỗi: {error}</Text>
      </View>
    );
  }

  if (!vote) {
    if (voteData) {
      return (
        <View style={{ padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="bar-chart-outline" size={16} color="#9ca3af" />
            <Text style={{ color: '#9ca3af', fontSize: 13 }}>Bình chọn đang tải...</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  const totalVotes = getTotalVotes();
  const closed = isVoteClosed(vote);
  const isCreator = vote.creatorId === userId;

  return (
    <View style={{ width: '100%', padding: 12, borderRadius: 12, backgroundColor: '#f9fafb' }}>
      {/* Question */}
      <Text style={{ fontWeight: '600', fontSize: 15, marginBottom: 4 }}>{vote.question}</Text>

      {/* Status badges */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {closed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
            <Ionicons name="lock-closed" size={12} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600', marginLeft: 3 }}>Đã đóng</Text>
          </View>
        )}
        {vote.deadline && !closed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fefce8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
            <Ionicons name="time-outline" size={12} color="#d97706" />
            <Text style={{ color: '#d97706', fontSize: 11, fontWeight: '500', marginLeft: 3 }}>
              Còn {countdownText}
            </Text>
          </View>
        )}
        {vote.deadline && closed && !vote.closed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
            <Ionicons name="time-outline" size={12} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '500', marginLeft: 3 }}>Hết hạn</Text>
          </View>
        )}
      </View>

      {/* Options */}
      {vote.options.map((option, index) => {
        const votesCount = option.votes ? option.votes.length : 0;
        const percentage = getPercentage(votesCount);
        const isSelected = option.votes && option.votes.includes(userId);
        const isExpiredOrClosed = closed;

        return (
          <TouchableOpacity
            key={option.id || index}
            onPress={() => !isExpiredOrClosed && handleVote(option.id)}
            disabled={isExpiredOrClosed || loading}
            style={{
              marginBottom: 8,
              borderRadius: 10,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isSelected ? '#3B82F6' : '#e5e7eb',
              opacity: isExpiredOrClosed && !isSelected ? 0.6 : 1,
              backgroundColor: isExpiredOrClosed && !isSelected ? '#f3f4f6' : 'transparent',
            }}
          >
            <View style={{ position: 'relative', width: '100%' }}>
              {/* Background progress bar */}
              <View
                style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${percentage}%`,
                  backgroundColor: isSelected ? (isExpiredOrClosed ? '#e0e7ff' : '#dbeafe') : (isExpiredOrClosed ? '#f3f4f6' : '#f9fafb'),
                }}
              />

              {/* Option content */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, zIndex: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={isExpiredOrClosed ? "#9ca3af" : "#3B82F6"} style={{ marginRight: 8 }} />
                  )}
                  <Text style={{ 
                    fontWeight: isSelected ? '600' : '400', 
                    color: isExpiredOrClosed ? '#6b7280' : '#111827',
                  }}>
                    {option.text}
                  </Text>
                </View>

                {(userVoted || isExpiredOrClosed) && (
                  <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '500' }}>{percentage}% ({votesCount})</Text>
                )}
              </View>

              {/* Voter Avatars */}
              {option.votes && option.votes.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 4, zIndex: 10 }}>
                  {option.votes.slice(0, 5).map((voterId, i) => {
                    const voterInfo = participants.find(p => p.id === voterId || p.userId === voterId);
                    return (
                      <View 
                        key={`${voterId}-${i}`} 
                        style={{ 
                          width: 18, height: 18, borderRadius: 9, 
                          backgroundColor: '#e5e7eb', borderWidth: 1, borderColor: '#fff' 
                        }}
                      >
                        <Image 
                          source={{ 
                            uri: userInfos[voterId]?.avatar || userInfos[voterId]?.avatarURL || voterInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfos[voterId]?.name || voterInfo?.name || 'U')}&background=random` 
                          }}
                          style={{ width: '100%', height: '100%', borderRadius: 9 }}
                        />
                      </View>
                    );
                  })}
                  {option.votes.length > 5 && (
                    <Text style={{ fontSize: 10, color: '#9ca3af' }}>+{option.votes.length - 5}</Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Thêm lựa chọn mới */}
      {!closed && (
        showAddOption ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
            <TextInput
              style={{
                flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
              }}
              placeholder="Nhập lựa chọn mới..."
              placeholderTextColor="#9ca3af"
              value={newOptionText}
              onChangeText={setNewOptionText}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleAddOption}
              style={{ marginLeft: 8, backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Thêm</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowAddOption(false); setNewOptionText(''); }} style={{ marginLeft: 4, padding: 6 }}>
              <Ionicons name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowAddOption(true)}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 6 }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#3B82F6" />
            <Text style={{ color: '#3B82F6', fontSize: 13, marginLeft: 4 }}>Thêm lựa chọn</Text>
          </TouchableOpacity>
        )
      )}

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Text style={{ color: '#6b7280', fontSize: 12 }}>
          {totalVotes} lượt bình chọn
          {vote.multiple && <Text> · Chọn nhiều</Text>}
        </Text>

        {/* Nút đóng bình chọn — chỉ creator thấy */}
        {isCreator && !closed && (
          <TouchableOpacity
            onPress={handleCloseVote}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
            }}
          >
            <Ionicons name="lock-closed-outline" size={14} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '500', marginLeft: 4 }}>Đóng</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default VoteMessageContent;
/**
 * TranslatedText
 * Hiển thị nút "Dịch" bên dưới tin nhắn nhận được.
 * Chỉ dịch khi người dùng nhấn nút — không tự động dịch.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslateMessage } from '@/src/hooks/useTranslateMessage';

interface TranslatedTextProps {
    content: string;
    type: string;
    isSender: boolean;
}

const URL_REGEX = /https?:\/\/|www\./i;
const LETTER_REGEX = /[a-zA-Z\u00C0-\u024F]/;
const VIETNAMESE_DIACRITICS_REGEX =
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

function shouldShowTranslateButton(rawContent: string): boolean {
    const text = String(rawContent ?? '').trim();
    if (!text || text.length < 2) return false;
    if (URL_REGEX.test(text)) return false;
    if (!LETTER_REGEX.test(text)) return false;
    if (VIETNAMESE_DIACRITICS_REGEX.test(text)) return false;
    return true;
}

export default function TranslatedText({ content, type, isSender }: TranslatedTextProps) {
    // Chỉ hiện nút với tin nhắn nhận được (không phải tin mình gửi)
    if (isSender) return null;
    // Chỉ với text message
    if (type !== 'text') return null;
    const text = (content || '').trim();
    if (!shouldShowTranslateButton(text)) return null;

    return <TranslateButton content={text} isSender={isSender} />;
}

/** Component con để có thể gọi hook (hooks phải ở component level) */
function TranslateButton({ content, isSender }: { content: string; isSender: boolean }) {
    const [triggered, setTriggered] = useState(false);
    const { translation, isTranslating } = useTranslateMessage(
        triggered ? content : '',
        triggered ? 'text' : '',
        isSender,
    );

    // Sau khi đã có kết quả dịch → hiển thị kết quả, không còn nút
    if (triggered && isTranslating) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                <ActivityIndicator size={10} color="#9ca3af" />
                <Text style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
                    Đang dịch...
                </Text>
            </View>
        );
    }

    if (triggered && translation) {
        return (
            <View
                style={{
                    marginTop: 5,
                    paddingTop: 5,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(0,0,0,0.08)',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 4,
                }}
            >
                <Ionicons
                    name="language-outline"
                    size={11}
                    color="#6B7280"
                    style={{ marginTop: 1 }}
                />
                <Text
                    style={{
                        fontSize: 12,
                        color: '#4B5563',
                        fontStyle: 'italic',
                        flex: 1,
                        lineHeight: 16,
                    }}
                >
                    {translation}
                </Text>
            </View>
        );
    }

    if (triggered && !isTranslating && !translation) {
        // API trả về null — tin đã là tiếng Việt hoặc không dịch được
        return null;
    }

    // Mặc định: hiển thị nút Dịch nhỏ
    return (
        <TouchableOpacity
            onPress={() => setTriggered(true)}
            style={{
                marginTop: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                alignSelf: 'flex-start',
            }}
            activeOpacity={0.7}
        >
            <Ionicons name="language-outline" size={11} color="#9ca3af" />
            <Text style={{ fontSize: 11, color: '#9ca3af' }}>Dịch</Text>
        </TouchableOpacity>
    );
}

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Locale, useLocale } from '@/src/contexts/i18n/I18nContext';

interface LangOption {
    code: Locale;
    flag: string;
    label: string;
    sublabel: string;
}

const LANG_OPTIONS: LangOption[] = [
    { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt', sublabel: 'Vietnamese' },
    { code: 'en', flag: '🇺🇸', label: 'English', sublabel: 'Tiếng Anh' },
];

export default function LanguageSwitcher() {
    const { locale, setLocale, t } = useLocale();

    return (
        <View>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
                {t('settings.languageDesc')}
            </Text>
            <View style={{ gap: 10 }}>
                {LANG_OPTIONS.map((option) => {
                    const isActive = locale === option.code;
                    return (
                        <TouchableOpacity
                            key={option.code}
                            onPress={() => setLocale(option.code)}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 14,
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor: isActive ? '#2563EB' : '#E5E7EB',
                                backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF',
                            }}
                        >
                            {/* Flag */}
                            <Text style={{ fontSize: 28, marginRight: 14 }}>
                                {option.flag}
                            </Text>

                            {/* Labels */}
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: '600',
                                        color: isActive ? '#1D4ED8' : '#111827',
                                    }}
                                >
                                    {option.label}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: isActive ? '#3B82F6' : '#9CA3AF',
                                        marginTop: 2,
                                    }}
                                >
                                    {option.sublabel}
                                </Text>
                            </View>

                            {/* Checkmark khi active */}
                            {isActive && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={22}
                                    color="#2563EB"
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

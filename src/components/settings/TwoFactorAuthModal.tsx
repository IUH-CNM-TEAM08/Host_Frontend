import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Modal, Platform, Text, TouchableOpacity, View} from 'react-native';
import Toast from '@/src/components/ui/Toast';
import FormInput from '@/src/components/ui/FormInput';
import Button from '@/src/components/ui/Button';
import QRCodeDisplay from '../ui/QRCodeDisplay';
import {ApiEndpoints} from '@/src/constants/ApiConstant';
import {authService as AuthService} from '@/src/api/services/auth.service';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';

interface TwoFactorAuthModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function TwoFactorAuthModal({visible, onClose}: TwoFactorAuthModalProps) {
    const { t } = useTranslation();
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState(''); // Placeholder for content
    const [showVerification, setShowVerification] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });

    useEffect(() => {
        // Chỉ fetch QR khi modal đang mở
        if (!visible) return;

        fetch(ApiEndpoints.API_2FA + '/generate')
            .then((response) => {
                if (response.ok) {
                    response.json().then((data) => {
                        setContent(data.base32 || 'null');
                    });
                } else {
                    console.error('Failed to fetch 2FA QR content');
                }
            })
            .catch((error) => {
                console.error('Error fetching 2FA QR:', error);
            });
    }, [visible]); // ← chỉ chạy khi visible thay đổi

    useEffect(() => {
        // Chỉ fetch trạng thái 2FA khi modal đang mở
        if (!visible) return;

        const fetch2FAStatus = async () => {
            try {
                const response = await AuthService.get2FAStatus();
                setIsEnabled(!!(response as any).enabled);
            } catch (error) {
                console.error('Error fetching 2FA status:', error);
            }
        };

        fetch2FAStatus();
    }, [visible]); // ← chỉ chạy khi visible thay đổi

    const handleToggle2FA = async () => {
        setShowVerification(true);
    };

    const handleVerifyAndToggle = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setToast({
                visible: true,
                message: t('twoFactorAuth.codeRequired'),
                type: 'error'
            });
            return;
        }

        setLoading(true);
        try {
            // TODO: Implement API call to verify 2FA code and toggle 2FA
            const result = !isEnabled ? await AuthService.enable2FA({
                secret: content,
                otp: verificationCode
            }) : await AuthService.disable2FA({otp: verificationCode});

            if (!result.success) {
                setToast({
                    visible: true,
                    message: t('twoFactorAuth.invalidCode'),
                    type: 'error'
                });
                return;
            }
            // If the API call is successful, toggle the 2FA state
            setIsEnabled(!isEnabled);
            setToast({
                visible: true,
                message: isEnabled ? t('twoFactorAuth.disabledSuccess') : t('twoFactorAuth.enabledSuccess'),
                type: 'success'
            });

            setShowVerification(false);
            setVerificationCode('');

            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            setToast({
                visible: true,
                message: t('common.unknownError'),
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancelVerification = () => {
        setShowVerification(false);
        setVerificationCode('');
    };

    return (
        <>
            <Modal visible={visible} transparent={true} animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1"
                >
                    <View className="flex-1 justify-center bg-black/50">
                        <View className="bg-white rounded-3xl mx-4">
                            <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
                                <TouchableOpacity onPress={onClose}>
                                    <Text className="text-blue-500 text-lg">
                                        {t('common.cancel')}
                                    </Text>
                                </TouchableOpacity>
                                <Text className="text-lg font-semibold">
                                    {t('twoFactorAuth.title')}
                                </Text>
                                <View style={{width: 40}}/>
                            </View>

                            {!showVerification ? (
                                <View className="p-4 space-y-6">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-base text-gray-700">
                                            {t('twoFactorAuth.status')}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={handleToggle2FA}
                                            disabled={loading}
                                            className={`w-14 h-8 rounded-full ${
                                                isEnabled
                                                    ? "bg-blue-500"
                                                    : "bg-gray-300"
                                            } p-1`}
                                        >
                                            <View
                                                className={`w-6 h-6 rounded-full bg-white shadow transform transition-transform ${
                                                    isEnabled
                                                        ? "translate-x-6"
                                                        : "translate-x-0"
                                                }`}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <Text className="text-sm text-gray-500">
                                        {isEnabled
                                            ? t('twoFactorAuth.enabledDesc')
                                            : t('twoFactorAuth.disabledDesc')}
                                    </Text>
                                </View>
                            ) : (
                                <View className="p-4 space-y-6">
                                    {!isEnabled ? (
                                        <View>
                                            <QRCodeDisplay
                                                value={"otpauth://totp/zala?secret=" + content}
                                                size={150}
                                            />
                                        </View>
                                    ) : null}
                                    <Text className="text-base text-gray-700 text-center">
                                        {isEnabled
                                            ? t('twoFactorAuth.enterCodeToDisable')
                                            : t('twoFactorAuth.scanInstructions') + '\n\nKey: ' + content}
                                    </Text>

                                    <FormInput
                                        icon="key-outline"
                                        placeholder={t('twoFactorAuth.codePlaceholder')}
                                        value={verificationCode}
                                        onChangeText={(text) =>
                                            setVerificationCode(
                                                text.slice(0, 6)
                                            )
                                        }
                                        editable={!loading}
                                        keyboardType="numeric"
                                    />

                                    <View className="flex-row space-x-3">
                                        <Button
                                            title={t('common.cancel')}
                                            onPress={handleCancelVerification}
                                            variant="outline"
                                            className="flex-1"
                                        />
                                        <Button
                                            title={t('common.confirm')}
                                            onPress={handleVerifyAndToggle}
                                            loading={loading}
                                            className="flex-1"
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={() => setToast((prev) => ({...prev, visible: false}))}
            />
        </>
    );
} 
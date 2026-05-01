import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from '@/src/components/ui/Toast';
import GradientBackground from '@/src/components/auth/GradientBackground';
import AppLogo from '@/src/components/auth/AppLogo';
import AuthHeader from '@/src/components/auth/AuthHeader';
import FormInput from '@/src/components/ui/FormInput';
import Button from '@/src/components/ui/Button';
import TextLink from '@/src/components/ui/TextLink';
import {authService as AuthService} from '@/src/api/services/auth.service';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

export default function VerifyResetCode() {
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const {t} = useTranslation();

    const [email, setEmail] = useState<string>('');
    const params = useLocalSearchParams();

    useEffect(() => {
        if (params.email) {
            setEmail(params.email as string);
        } else {
            setToast({
                visible: true,
                message: t('auth.emailNotFound'),
                type: 'error'
            });
            setTimeout(() => router.back(), 1500);
        }
        console.log('Email from params:', email);
    }, [params?.email]);

    const validateForm = () => {
        if (!verificationCode) {
            setToast({ visible: true, message: t('auth.otpSent'), type: 'error' });
            return false;
        }
        if (verificationCode.length !== 6) {
            setToast({ visible: true, message: t('auth.loginError'), type: 'error' });
            return false;
        }
        return true;
    };

    const handleVerifyCode = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            setToast({ visible: true, message: t('auth.loginSuccess'), type: 'success' });

            // Navigate to new password screen after 2 seconds
            setTimeout(() => {
                router.push({
                    pathname: '/(auth)/reset-password',
                    params: {email, otp: verificationCode}
                });
            }, 2000);
        } catch (error) {
            setToast({ visible: true, message: t('auth.loginError'), type: 'error' });
            console.error('Verification error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{flexGrow: 1}}
                    keyboardShouldPersistTaps="handled"
                >
                    <View
                        className="flex-1 justify-end items-center px-4 pb-6"
                        style={{paddingTop: Math.max(insets.top, 20)}}
                    >
                        <View className="w-full max-w-[100%] sm:max-w-[420px]">
                            <AppLogo/>

                            <View className="mt-4">
                                <AuthHeader
                                    title={t('auth.otp')}
                                    subtitle={t('auth.otpSent')}
                                />

                                <View className="mt-4 space-y-3">
                                    <FormInput
                                        icon="key-outline"
                                        placeholder={t('auth.otp')}
                                        value={verificationCode}
                                        onChangeText={(text) => setVerificationCode(text.slice(0, 6))}
                                        editable={!loading}
                                        keyboardType="numeric"
                                    />

                                    <Button
                                        title={t('common.confirm')}
                                        onPress={handleVerifyCode}
                                        loading={loading}
                                        className="mt-2"
                                    />

                                    <TextLink
                                        href="./forgot-password"
                                        text={t('common.retry')}
                                        linkText={t('common.retry')}
                                        className="mt-4"
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={() => setToast(prev => ({...prev, visible: false}))}
            />
        </GradientBackground>
    );
} 
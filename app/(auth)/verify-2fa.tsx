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
import {useUser} from '@/src/contexts/user/UserContext';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

export default function Verify2FA() {
    const {login, user} = useUser();
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const {t} = useTranslation();

    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const params = useLocalSearchParams();

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    useEffect(() => {
        if (params.email) {
            setEmail(params.email as string);
        } else {
            setToast({
                visible: true,
                message: t('auth.emailNotFound'),
                type: "error",
            });
            setTimeout(() => router.back(), 1500);
        }
    }, [params?.email]);

    useEffect(() => {
        if (params.password) {
            setPassword(params.password as string);
        } else {
            setToast({
                visible: true,
                message: t('auth.passwordRequired'),
                type: 'error'
            });
            setTimeout(() => router.back(), 1500);
        }
    }, [params?.password]);

    const handleResendOTP = async () => {
        if (countdown > 0) return;

        setResendLoading(true);
        try {
            // TOTP lấy mã trực tiếp từ authenticator, không cần resend OTP qua email.
            setToast({
                visible: true,
                message: t('twoFactorAuth.enterCodeToDisable'),
                type: 'success',
            });
            setCountdown(60);
        } catch (error) {
            setToast({
                visible: true,
                message: t('auth.loginError'),
                type: 'error'
            });
        } finally {
            setResendLoading(false);
        }
    };

    const validateForm = () => {
        if (!verificationCode) {
            setToast({ visible: true, message: t('auth.twoFactorCode'), type: 'error' });
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
            const response = await login(
                {
                    email,
                    password: password,
                    otp: verificationCode
                }
            );

            if (!response.success) {
                setToast({ visible: true, message: t('auth.loginFailed'), type: 'error' });
                return;
            }

            setToast({ visible: true, message: t('auth.loginSuccess'), type: 'success' });

            setTimeout(() => {
                router.replace('/(main)');
            }, 2000);
        } catch (error) {
            setToast({ visible: true, message: t('auth.loginError'), type: 'error' });
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
                                    title={t('twoFactorAuth.title')}
                                        subtitle={t('twoFactorAuth.scanInstructions')}
                                />

                                <View className="mt-4 space-y-3">
                                    <FormInput
                                        icon="key-outline"
                                        placeholder={t('auth.twoFactorCode')}
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

                                    <View className="flex-row justify-center mt-4">
                                        <TextLink
                                            href="/(auth)/verify-2fa"
                                            text={t('common.retry')}
                                            linkText={countdown > 0 ? `${t('common.retry')} (${countdown}s)` : t('common.retry')}
                                        />
                                    </View>

                                    <TextLink
                                        href="/"
                                        text={t('common.back')}
                                        linkText={t('auth.login')}
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
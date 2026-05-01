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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

export default function VerifyAccount() {
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const {t} = useTranslation();

    const [email, setEmail] = useState<string>("");
    const [regData, setRegData] = useState<any>(null);
    const params = useLocalSearchParams();

    const firstParam = (v: unknown) => (Array.isArray(v) ? v[0] : v);

    useEffect(() => {
        const loadParams = async () => {
            console.log('[verify-account] params', params);
            const nextEmail = firstParam(params.email) as string | undefined;
            if (nextEmail) {
                setEmail(nextEmail);
                setRegData({
                    name: firstParam(params.name),
                    gender: firstParam(params.gender),
                    password: firstParam(params.password),
                    dob: firstParam(params.dob),
                });
                return;
            }
            
            // Khôi phục từ AsyncStorage nếu params rỗng (trường hợp load lại trang hoặc lỡ đóng app)
            try {
                const savedStr = await AsyncStorage.getItem('pending_registration');
                if (savedStr) {
                    const saved = JSON.parse(savedStr);
                    if (saved.email) {
                        console.log('[verify-account] loaded from AsyncStorage', saved);
                        setEmail(saved.email);
                        setRegData(saved);
                        return;
                    }
                }
            } catch (e) {
                console.error('Failed to load pending_registration', e);
            }

            setToast({
                visible: true,
                message: t('auth.emailNotFound'),
                type: "error",
            });
        };
        loadParams();
    }, [params?.email]);

    const validateForm = () => {
        if (!verificationCode) {
            setToast({ visible: true, message: t('auth.otpSent'), type: 'error' });
            return false;
        }
        if (verificationCode.length !== 6) {
            setToast({
                visible: true,
                message: t('auth.otpLength'),
                type: 'error'
            });
            return false;
        }
        return true;
    };

    const handleVerifyCode = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const verifyResponse: any = await AuthService.verifyRegisterOtp(email, verificationCode);
            if (!verifyResponse?.success) {
                setToast({ visible: true, message: verifyResponse?.message || t('auth.loginFailed'), type: 'error' });
                return;
            }

            const payload = {
                email,
                displayName: regData?.name || firstParam(params.name),
                gender: (() => {
                    const g = regData?.gender || firstParam(params.gender) as string | undefined;
                    return typeof g === 'string' ? g.toUpperCase() : undefined;
                })(),
                password: regData?.password || firstParam(params.password) as string | undefined,
                dateOfBirth: regData?.dob || firstParam(params.dob) as string | undefined,
            };

            const response: any = await AuthService.register(payload);

            console.log('Register verification response:', response);

            if (!response.success) {
                setToast({ visible: true, message: t('auth.loginFailed'), type: 'error' });
                return;
            }

            setToast({ visible: true, message: t('auth.loginSuccess'), type: 'success' });
            
            // Xóa dữ liệu tạm sau khi đăng ký thành công
            await AsyncStorage.removeItem('pending_registration');

            // Navigate to main screen after 2 seconds
            setTimeout(() => {
                router.replace('/(auth)');
            }, 2000);
        } catch (error) {
            setToast({ visible: true, message: t('auth.loginError'), type: 'error' });
            console.error('2FA verification error:', error);
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
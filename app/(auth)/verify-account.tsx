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

    const [email, setEmail] = useState<string>("");
    const params = useLocalSearchParams();

    useEffect(() => {
        if (params.email) {
            setEmail(params.email as string);
        } else {
            setToast({
                visible: true,
                message: "Không tìm thấy thông tin email",
                type: "error",
            });
            setTimeout(() => router.back(), 1500);
        }
    }, [params?.email]);

    const validateForm = () => {
        if (!verificationCode) {
            setToast({
                visible: true,
                message: 'Vui lòng nhập mã xác thực 2FA',
                type: 'error'
            });
            return false;
        }
        if (verificationCode.length !== 6) {
            setToast({
                visible: true,
                message: 'Mã xác thực 2FA phải có 6 chữ số',
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
                setToast({
                    visible: true,
                    message: verifyResponse?.message || 'Mã xác thực không hợp lệ',
                    type: 'error'
                });
                return;
            }

            const response: any = await AuthService.register({
                email,
                displayName: params.name,
                gender: typeof params.gender === 'string' ? params.gender.toUpperCase() : undefined,
                password: params.password,
                dateOfBirth: params.dob,
            });

            console.log('Register verification response:', response);

            if (!response.success) {
                setToast({
                    visible: true,
                    message: 'Mã xác thực không hợp lệ',
                    type: 'error'
                });
                return;
            }

            setToast({
                visible: true,
                message: 'Xác thực 2FA thành công!',
                type: 'success'
            });

            // Navigate to main screen after 2 seconds
            setTimeout(() => {
                router.replace('/(auth)');
            }, 2000);
        } catch (error) {
            setToast({
                visible: true,
                message: 'Có lỗi xảy ra, vui lòng thử lại sau',
                type: 'error'
            });
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
                                    title="Xác thực tài khoản"
                                    subtitle={'Nhập mã xác thực đã được gửi đến\nemail của bạn'}
                                />

                                <View className="mt-4 space-y-3">
                                    <FormInput
                                        icon="key-outline"
                                        placeholder="Mã xác thực"
                                        value={verificationCode}
                                        onChangeText={(text) => setVerificationCode(text.slice(0, 6))}
                                        editable={!loading}
                                        keyboardType="numeric"
                                    />

                                    <Button
                                        title="Xác nhận"
                                        onPress={handleVerifyCode}
                                        loading={loading}
                                        className="mt-2"
                                    />

                                    <TextLink
                                        href="/"
                                        text="Quay lại đăng nhập"
                                        linkText="Tại đây"
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
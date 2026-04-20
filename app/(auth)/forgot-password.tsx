import React, {useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, View} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from '@/src/components/ui/Toast';
import GradientBackground from '@/src/components/auth/GradientBackground';
import AppLogo from '@/src/components/auth/AppLogo';
import AuthHeader from '@/src/components/auth/AuthHeader';
import FormInput from '@/src/components/ui/FormInput';
import Button from '@/src/components/ui/Button';
import TextLink from '@/src/components/ui/TextLink';
import {authService as AuthService} from '@/src/api/services/auth.service';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const validateForm = () => {
        if (!email) {
            setToast({
                visible: true,
                message: 'Vui lòng nhập email',
                type: 'error'
            });
            return false;
        }
        return true;
    };

    const handleResetPassword = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const result: any = await AuthService.forgotPassword(email.trim());

            console.log('Password reset response:', email, result);
            if (!result.success) {
                setToast({
                    visible: true,
                    message: result.message || 'Có lỗi xảy ra, vui lòng thử lại sau',
                    type: 'error'
                });
                return;
            }
            setToast({
                visible: true,
                message: 'Mã xác thực đã được gửi đến email của bạn',
                type: 'success'
            });

            // Navigate to verification screen after 2 seconds
            setTimeout(() => {
                router.push({
                    pathname: '/(auth)/verify-reset-code',
                    params: {email: email.trim()}
                });
            }, 2000);
        } catch (error) {
            setToast({
                visible: true,
                message: 'Có lỗi xảy ra, vui lòng thử lại sau',
                type: 'error'
            });
            console.error('Reset password error:', error);
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
                                    title="Quên mật khẩu"
                                    subtitle={'Nhập email để nhận mã xác thực\nvà đặt lại mật khẩu của bạn'}
                                />

                                <View className="mt-4 space-y-3">
                                    <FormInput
                                        icon="mail-outline"
                                        placeholder="Email"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!loading}
                                        keyboardType="email-address"
                                    />

                                    <Button
                                        title="Gửi mã xác thực"
                                        onPress={handleResetPassword}
                                        loading={loading}
                                        className="mt-2"
                                    />

                                    <TextLink
                                        href="/"
                                        text="Đã nhớ mật khẩu?"
                                        linkText="Đăng nhập"
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
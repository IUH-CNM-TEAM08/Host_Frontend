import React, {useEffect, useState} from "react";
import {KeyboardAvoidingView, Platform, ScrollView, Text, View,} from "react-native";
import {router, useLocalSearchParams} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import FormInput from "@/src/components/ui/FormInput";
import Toast from "@/src/components/ui/Toast";
import GradientBackground from "@/src/components/auth/GradientBackground";
import AppLogo from "@/src/components/auth/AppLogo";
import AuthHeader from "@/src/components/auth/AuthHeader";
import Button from "@/src/components/ui/Button";
import {authService as AuthService} from "@/src/api/services/auth.service";
import {useTranslation} from "@/src/contexts/i18n/I18nContext";

export default function ResetPasswordScreen() {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({
        visible: false,
        message: "",
        type: "success" as "success" | "error",
    });
    const insets = useSafeAreaInsets();
    const {t} = useTranslation();

    const [email, setEmail] = useState<string>("");
    const [otp, setOtp] = useState<string>("");
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
        console.log("Email from params:", email);
    }, [params?.email]);

    useEffect(() => {
        if (params.otp) {
            setOtp(params.otp as string);
        } else {
            // Xử lý khi không có phone
            setToast({
                visible: true,
                message: "Không tìm thấy OTP",
                type: "error",
            });
            setTimeout(() => router.back(), 1500);
        }
        console.log("OTP from params:", otp);
    }, [params?.otp]);

    const validateForm = () => {
        if (!newPassword || !confirmPassword) {
            setToast({ visible: true, message: t('auth.passwordRequired'), type: 'error' });
            return false;
        }

        if (newPassword !== confirmPassword) {
            setToast({ visible: true, message: t('auth.passwordMismatch'), type: 'error' });
            return false;
        }

        if (newPassword.length < 6) {
            setToast({ visible: true, message: t('auth.loginError'), type: 'error' });
            return false;
        }

        return true;
    };

    const handleResetPassword = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const result: any = await AuthService.resetPassword(email, otp, newPassword);

            if (!result.success) {
                setToast({ visible: true, message: result.message || t('auth.loginError'), type: 'error' });
                return;
            }

            setToast({ visible: true, message: t('auth.loginSuccess'), type: 'success' });

            setTimeout(() => {
                router.replace("/");
            }, 1500);
        } catch (error) {
            setToast({ visible: true, message: t('auth.loginError'), type: 'error' });
            console.error("Reset password error:", error);
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
                                    title="Đặt lại mật khẩu"
                                    subtitle={`Nhập mật khẩu mới cho tài khoản ${email}`}
                                />

                                <View className="mt-4 space-y-3">
                                    <FormInput
                                        icon="lock-closed-outline"
                                        placeholder={t('auth.newPassword')}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry
                                        editable={!loading}
                                    />

                                    <FormInput
                                        icon="lock-closed-outline"
                                        placeholder={t('auth.confirmPassword')}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                        editable={!loading}
                                    />

                                    <Text className="text-sm text-gray-500 mt-2">
                                        Mật khẩu phải có ít nhất 8 ký tự và bao gồm chữ, số và ký tự
                                        đặc biệt
                                    </Text>

                                    <Button
                                        title={t('auth.resetPassword')}
                                        onPress={handleResetPassword}
                                        loading={loading}
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
                onHide={() => setToast((prev) => ({...prev, visible: false}))}
            />
        </GradientBackground>
    );
}

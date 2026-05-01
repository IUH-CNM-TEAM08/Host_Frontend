import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, useWindowDimensions, View} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from '@/src/components/ui/Toast';
import GradientBackground from '@/src/components/auth/GradientBackground';
import AppLogo from '@/src/components/auth/AppLogo';
import AuthHeader from '@/src/components/auth/AuthHeader';
import FormInput from '@/src/components/ui/FormInput';
import Button from '@/src/components/ui/Button';
import TextLink from '@/src/components/ui/TextLink';
import Divider from '@/src/components/ui/Divider';
import {useUser} from '@/src/contexts/user/UserContext';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';
import {useLocale} from '@/src/contexts/i18n/I18nContext';
import WhatsNewModal from '@/src/components/ui/WhatsNewModal';
import {Ionicons} from '@expo/vector-icons';

export default function Login() {
    const {login, user} = useUser();
    const {t} = useTranslation();
    const { locale, setLocale } = useLocale();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [delayRedirectAfterLogin, setDelayRedirectAfterLogin] = useState(false);
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });
    const router = useRouter();
    const {width} = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width >= 768;
    // useSafeAreaInsets is used to get the insets of the device
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (user) {
            if (delayRedirectAfterLogin) return;
            if (user.role === 'ADMIN') {
                router.replace("/admin");
            } else {
                router.replace("/(main)");
            }
        }
    }, [user, delayRedirectAfterLogin]);

    const validateForm = () => {
        if (!email) {
            setToast({
                visible: true,
                message: t('auth.email') + ' ' + t('common.error').toLowerCase(),
                type: 'error'
            });
            return false;
        }
        if (!password) {
            setToast({
                visible: true,
                message: t('auth.loginError'),
                type: 'error'
            });
            return false;
        }
        return true;
    };

    const handleLogin = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            console.log('Attempting login with:', email, password);
            const result = await login({email: email.trim(), password});
            console.log('Login result:', result);

            if (result.success) {
                setDelayRedirectAfterLogin(true);
                setToast({
                    visible: true,
                    message: t('auth.loginSuccess'),
                    type: 'success'
                });
                setTimeout(() => {
                    const role = result.data?.role || user?.role;
                    if (role === 'ADMIN') {
                        router.replace('/admin');
                        return;
                    }
                    router.replace('/(main)');
                }, 1200);
            } else {
                if (result.errorCode == 203) {
                    setToast({
                        visible: true,
                        message: t('auth.twoFactorCode'),
                        type: 'success'
                    });

                    setTimeout(() => {
                        router.push(
                            {
                                pathname: '/(auth)/verify-2fa',
                                params: {
                                    email: email.trim(),
                                    password: password
                                }
                            }
                        );
                    }, 2000);
                    return;
                }
                if (result.errorCode == 207) {
                    setToast({
                        visible: true,
                        message: t('auth.otpSent'),
                        type: 'success'
                    });
                    setTimeout(() => {
                        router.push(
                            {
                                pathname: '/(auth)/verify-account',
                                params: {
                                    email: email.trim(),
                                }
                            }
                        );
                    }, 2000);
                    return;
                }
                setToast({
                    visible: true,
                    message: result.message || t('auth.loginFailed'),
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Login error:', error);
            setToast({
                visible: true,
                message: t('auth.loginError'),
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQrCodeLogin = () => {
        // Handle QR code login here
        console.log('QR code login pressed');
        router.push('/qrcode');
    }

    const handleToggleLanguage = async () => {
        const next = locale === 'vi' ? 'en' : 'vi';
        await setLocale(next);
    };

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                enabled={Platform.OS === "ios"}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{flexGrow: 1, paddingBottom: Math.max(insets.bottom + 20, 24)}}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                    <View
                        className="flex-1 justify-start items-center px-4 pt-8 sm:justify-center sm:px-6 md:px-8 lg:px-10"
                        style={{paddingTop: Math.max(insets.top + 20, 40)}}
                    >
                        <View className="w-full max-w-[100%] sm:max-w-[420px]">
                            <AppLogo/>

                            <View className="mt-4 sm:mt-6">
                                <View className="items-end mb-2">
                                    <TouchableOpacity
                                        onPress={handleToggleLanguage}
                                        activeOpacity={0.75}
                                        className="px-3 py-1.5 rounded-full bg-white/70 border border-purple-200"
                                    >
                                        <Text className="text-xs font-semibold text-purple-700">
                                            {locale === 'vi' ? 'EN' : 'VI'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <AuthHeader
                                    title={t('auth.login')}
                                    subtitle={t('auth.login')}
                                />

                                <View className="mt-4">
                                    <View style={{ marginBottom: 12 }}>
                                        <FormInput
                                            icon="mail-outline"
                                            placeholder={t('auth.email')}
                                            value={email}
                                            onChangeText={setEmail}
                                            editable={!loading}
                                            keyboardType="email-address"
                                        />
                                    </View>

                                    <View style={{ marginBottom: 12 }}>
                                        <FormInput
                                            icon="lock-closed-outline"
                                            placeholder={t('auth.password')}
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry
                                            showTogglePassword
                                            editable={!loading}
                                            onEnterPress={!loading ? handleLogin : undefined}
                                        />
                                    </View>

                                    <TouchableOpacity
                                        className="self-end"
                                        activeOpacity={0.6}
                                        onPress={() => router.push('/forgot-password')}
                                    >
                                        <Text className="text-purple-600 font-medium text-xs sm:text-sm py-2">
                                            {t('auth.forgotPassword')}
                                        </Text>
                                    </TouchableOpacity>

                                    <Button
                                        title={t('auth.login')}
                                        onPress={handleLogin}
                                        loading={loading}
                                        className="mt-2"
                                    />

                                    {isDesktopWeb && (
                                        <>
                                            <Divider text={t('common.or')} className="mt-3"/>
                                            <Button
                                                title={t('qr.confirmLoginTitle')}
                                                onPress={handleQrCodeLogin}
                                                variant="outline"
                                                icon="qr-code-outline"
                                                className="mt-2"
                                            />
                                            {/* Nút Đăng ký OA - chỉ web */}
                                            <TouchableOpacity
                                                onPress={() => router.push('/(auth)/zalaoa' as any)}
                                                activeOpacity={0.85}
                                                style={{
                                                    marginTop: 12,
                                                    borderRadius: 12,
                                                    overflow: 'hidden',
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    paddingVertical: 12,
                                                    paddingHorizontal: 16,
                                                    backgroundColor: '#7C3AED',
                                                    gap: 8,
                                                    shadowColor: '#7C3AED',
                                                    shadowOffset: { width: 0, height: 4 },
                                                    shadowOpacity: 0.3,
                                                    shadowRadius: 8,
                                                    elevation: 4,
                                                }}
                                            >
                                                {/* Zala OA logo badge */}
                                                <View style={{
                                                    backgroundColor: 'rgba(255,255,255,0.25)',
                                                    borderRadius: 6,
                                                    paddingHorizontal: 6,
                                                    paddingVertical: 2,
                                                }}>
                                                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>OA</Text>
                                                </View>
                                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                                                    Đăng ký Zala Official Account
                                                </Text>
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {/* Tính năng phát triển */}
                                    {/* <Button
                                        title="Đăng nhập bằng hình ảnh"
                                        onPress={() => router.push('/image-auth')}
                                        variant="outline"
                                        icon="images-outline"
                                        className="mt-2"
                                    /> */}

                                    <TextLink
                                        href="/register"
                                        text={t('auth.register')}
                                        linkText={t('auth.register')}
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

            {/* What's New floating button */}
            <View
                style={{
                    position: 'absolute',
                    bottom: Math.max(insets.bottom + 16, 24),
                    right: 20,
                    zIndex: 100,
                }}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    onPress={() => setShowWhatsNew(true)}
                    activeOpacity={0.85}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#7c3aed',
                        borderRadius: 99,
                        paddingVertical: 9,
                        paddingHorizontal: 16,
                        shadowColor: '#7c3aed',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        elevation: 6,
                    }}
                >
                    {/* info icon */}
                    {Platform.OS === 'web' ? (
                        <Ionicons name="information-circle-outline" size={16} color="#ffffff" />
                    ) : null}
                    <Text style={{
                        color: '#ffffff',
                        fontWeight: '700',
                        fontSize: 12,
                        letterSpacing: 0.3,
                    }}>
                        Có gì mới v2.0
                    </Text>
                </TouchableOpacity>
            </View>

            <WhatsNewModal visible={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
        </GradientBackground>
    );
}
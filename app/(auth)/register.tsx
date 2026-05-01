import React, {useState} from 'react';
import {KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from '@/src/components/ui/Toast';
import GradientBackground from '@/src/components/auth/GradientBackground';
import AppLogo from '@/src/components/auth/AppLogo';
import AuthHeader from '@/src/components/auth/AuthHeader';
import FormInput from '@/src/components/ui/FormInput';
import Button from '@/src/components/ui/Button';
import TextLink from '@/src/components/ui/TextLink';
import {Picker} from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {authService as AuthService} from '@/src/api/services/auth.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

export default function Register() {
    // Value
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
    const [dob, setDob] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showGenderPicker, setShowGenderPicker] = useState(false);

    // State
    const [loading, setLoading] = useState(false);

    // Toast
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });

    // Router
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const {t} = useTranslation();

    const getGenderLabel = (value: string) => {
        switch (value) {
            case 'male':   return t('gender.male');
            case 'female': return t('gender.female');
            case 'other':  return t('gender.other');
            default:       return t('auth.selectGender');
        }
    };

    // Validate form
    const validateForm = () => {
        if (!email.trim()) {
            setToast({ visible: true, message: t('auth.emailRequired'), type: 'error' });
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setToast({ visible: true, message: 'Email không đúng định dạng', type: 'error' });
            return false;
        }

        if (!name.trim() || name.trim().length < 2) {
            setToast({ visible: true, message: 'Tên hiển thị phải từ 2 ký tự trở lên', type: 'error' });
            return false;
        }

        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        if (age < 12) {
            setToast({ visible: true, message: 'Bạn phải ít nhất 12 tuổi để đăng ký', type: 'error' });
            return false;
        }

        if (!password) {
            setToast({ visible: true, message: t('auth.passwordRequired'), type: 'error' });
            return false;
        }

        // Mật khẩu ít nhất 8 ký tự, 1 hoa, 1 thường, 1 số, 1 ký tự đặc biệt
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
        if (!passwordRegex.test(password)) {
            setToast({ visible: true, message: 'Mật khẩu phải từ 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt', type: 'error' });
            return false;
        }

        if (password !== confirmPassword) {
            setToast({ visible: true, message: t('auth.passwordMismatch'), type: 'error' });
            return false;
        }
        return true;
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setDob(selectedDate);
        }
    };

    const handleRegister = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const result: any = await AuthService.sendRegisterOtp(email.trim());
            console.log('[register] sendRegisterOtp result:', result);

            if (result.errorCode === 400) {
                setToast({ visible: true, message: t('auth.emailExists'), type: 'error' });
                return;
            }

            if (!result.success) {
                setToast({ visible: true, message: result.message || t('common.unknownError'), type: 'error' });
                return;
            }

            setToast({ visible: true, message: t('auth.registerSuccess'), type: 'success' });

            // Đợi toast hiển thị xong rồi chuyển trang
            setTimeout(() => {
                const regData = {
                    email: email.trim(),
                    name,
                    gender,
                    password,
                    dob: dob.toISOString().split('T')[0],
                };
                
                console.log('[register] saving to AsyncStorage & navigating with:', regData);
                AsyncStorage.setItem('pending_registration', JSON.stringify(regData)).then(() => {
                    router.push({
                        pathname: '/(auth)/verify-account',
                        params: regData
                    });
                }).catch((err) => {
                    console.error('Failed to save to AsyncStorage', err);
                    router.push({
                        pathname: '/(auth)/verify-account',
                        params: regData
                    });
                });
            }, 2000);
        } catch (error) {
            setToast({ visible: true, message: t('common.unknownError'), type: 'error' });
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
                                    title={t('auth.register')}
                                    subtitle={t('auth.registerSuccess')}
                                />

                                <View className="mt-4 space-y-3">
                                    <FormInput
                                        icon="mail-outline"
                                        placeholder={t('auth.email')}
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        editable={!loading}
                                    />

                                    <FormInput
                                        icon="person-outline"
                                        placeholder={t('auth.displayName')}
                                        value={name}
                                        onChangeText={setName}
                                        editable={!loading}
                                    />

                                    {Platform.OS === 'web' ? (
                                        <View className="border border-gray-300 rounded-lg px-4 py-3">
                                            <select
                                                value={gender}
                                                onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                                                className="w-full bg-transparent outline-none text-base"
                                                disabled={loading}
                                            >
                                                <option value="male">{t('gender.male')}</option>
                                                <option value="female">{t('gender.female')}</option>
                                                <option value="other">{t('gender.other')}</option>
                                            </select>
                                        </View>
                                    ) : Platform.select({
                                        native: (
                                            <>
                                                <TouchableOpacity
                                                    onPress={() => setShowGenderPicker(true)}
                                                    className="bg-white border border-gray-300 rounded-lg h-14 justify-center px-4"
                                                >
                                                    <Text className="text-base text-black">
                                                        {getGenderLabel(gender)}
                                                    </Text>
                                                </TouchableOpacity>

                                                <Modal
                                                    visible={showGenderPicker}
                                                    transparent={true}
                                                    animationType="slide"
                                                >
                                                    <View className="flex-1 justify-end bg-black/50">
                                                        <View className="bg-white w-full p-4">
                                                            <View
                                                                className="flex-row justify-between items-center mb-4">
                                                                <TouchableOpacity
                                                                    onPress={() => setShowGenderPicker(false)}>
                                                    <Text className="text-blue-500 text-lg">{t('common.cancel')}</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity
                                                                    onPress={() => setShowGenderPicker(false)}>
                                                                    <Text className="text-blue-500 text-lg">{t('chatArea.done')}</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                            <Picker
                                                                selectedValue={gender}
                                                                onValueChange={(value: 'male' | 'female' | 'other') => setGender(value)}
                                                                enabled={!loading}
                                                            >
                                                                <Picker.Item label={t('gender.male')} value="male" color='black'/>
                                                                <Picker.Item label={t('gender.female')} value="female" color='black'/>
                                                                <Picker.Item label={t('gender.other')} value="other" color='black'/>
                                                            </Picker>
                                                        </View>
                                                    </View>
                                                </Modal>
                                            </>
                                        ),
                                        default: null
                                    })}

                                    {Platform.OS === 'web' ? (
                                        <View className="border border-gray-300 rounded-lg px-4 py-3">
                                            <input
                                                type="date"
                                                value={dob.toISOString().split('T')[0]}
                                                onChange={(e) => setDob(new Date(e.target.value))}
                                                className="w-full bg-transparent outline-none text-base"
                                                disabled={loading}
                                                max={new Date().toISOString().split('T')[0]}
                                            />
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => setShowDatePicker(true)}
                                            className="bg-white border border-gray-300 rounded-lg h-14 justify-center px-4 relative"
                                        >
                                            <Text
                                                className="text-base text-black">{dob.toLocaleDateString('vi-VN')}</Text>
                                            <View className="absolute inset-0 justify-center items-center">
                                                {showDatePicker && (
                                                    <DateTimePicker
                                                        value={dob}
                                                        mode="date"
                                                        display="default"
                                                        onChange={handleDateChange}
                                                        maximumDate={new Date()}
                                                    />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    <FormInput
                                        icon="lock-closed-outline"
                                        placeholder={t('auth.password')}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        showTogglePassword
                                        editable={!loading}
                                    />

                                    <FormInput
                                        icon="lock-closed-outline"
                                        placeholder={t('auth.confirmPassword')}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                        showTogglePassword
                                        editable={!loading}
                                    />

                                    <Button
                                        title={t('auth.register')}
                                        onPress={handleRegister}
                                        loading={loading}
                                        className="mt-2"
                                    />

                                    <TextLink
                                        href="/"
                                        text={t('auth.login') + '?'}
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
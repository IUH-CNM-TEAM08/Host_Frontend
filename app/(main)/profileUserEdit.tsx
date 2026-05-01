import React, {useState} from "react";
import {Platform, ScrollView, Text, TouchableOpacity, View} from "react-native";
import FormInput from "@/src/components/ui/FormInput";
import RadioButton from "@/src/components/profile/RadioButton";
import ModalHeader from "@/src/components/profile/ModelHeader";
import {formatDate} from "@/src/utils/DateTime";
import {User} from "@/src/models/User";
import DateTimePicker from '@react-native-community/datetimepicker';
import {useTranslation} from "@/src/contexts/i18n/I18nContext";

type ProfileEditProps = {
    editUser: Partial<User> | null;
    onSave: () => void;
    onCancel: () => void;
    onChangeUser: (user: Partial<User>) => void;
};

export default function ProfileUserEdit({
                                            editUser,
                                            onSave,
                                            onCancel,
                                            onChangeUser
                                        }: ProfileEditProps) {
    const {t} = useTranslation();
    const [showDatePicker, setShowDatePicker] = useState(false);
    const dob = editUser?.dob ? formatDate(editUser.dob) : formatDate(Date.now());

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate && event.type !== 'dismissed') {
            onChangeUser({...editUser, dob: selectedDate.toISOString().slice(0, 10)});
        }
    };

    return (
        <View className="flex-1 bg-white">
            <ModalHeader
                title={t('profile.updateProfile')}
                leftText={t('common.cancel')}
                rightText={t('common.update')}
                onLeftPress={onCancel}
                onRightPress={onSave}
            />

            <ScrollView className="p-4 bg-white">
                {/* Display Name */}
                <View className="mb-4">
                    <Text className="text-gray-600 mb-1">{t('profile.displayName')}</Text>
                    <FormInput
                        icon="person-outline"
                        placeholder={t('profile.displayNamePlaceholder')}
                        value={editUser?.name || ''}
                        onChangeText={(text) => onChangeUser({...editUser, name: text})}
                    />
                </View>

                <Text className="text-gray-600 mb-2">{t('profile.personalInfo')}</Text>

                {/* Gender */}
                <View className="mb-4">
                    <View className="flex-row mb-2">
                        <RadioButton
                            label={t('gender.male')}
                            selected={editUser?.gender === 'male'}
                            onPress={() => onChangeUser({...editUser, gender: 'male'})}
                        />
                        <RadioButton
                            label={t('gender.female')}
                            selected={editUser?.gender === 'female'}
                            onPress={() => onChangeUser({...editUser, gender: 'female'})}
                        />
                        <RadioButton
                            label={t('gender.other')}
                            selected={editUser?.gender === 'other'}
                            onPress={() => onChangeUser({...editUser, gender: 'other'})}
                        />
                    </View>
                </View>

                {/* Date of Birth */}
                <View className="mb-4">
                    <Text className="text-gray-600 mb-2">{t('profile.dateOfBirth')}</Text>
                    {Platform.OS === 'web' ? (
                        <View className="border border-gray-300 rounded-lg px-4 py-3">
                            <input
                                type="date"
                                value={editUser?.dob ? new Date(editUser.dob).toISOString().split('T')[0] : ''}
                                onChange={(e) => onChangeUser({...editUser, dob: e.target.value})}
                                className="w-full bg-transparent outline-none text-base"
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                className="border border-gray-300 rounded-lg p-3"
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text>{dob}</Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={editUser?.dob ? new Date(editUser.dob) : new Date()}
                                    mode="date"
                                    display="default"
                                    onChange={handleDateChange}
                                    maximumDate={new Date()}
                                />
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
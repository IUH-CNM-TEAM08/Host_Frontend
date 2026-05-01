import React from 'react'
import {Platform} from 'react-native'
import SettingsMobile from '@/src/components/settings/SettingsMobile'
import SettingsDesktop from '@/src/components/settings/SettingsDesktop'

export default function Settings() {
    if (Platform.OS === 'web') {
        return <SettingsDesktop />;
    }
    return <SettingsMobile />;
}
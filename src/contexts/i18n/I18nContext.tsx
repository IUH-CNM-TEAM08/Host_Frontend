import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/src/constants/StorageKeyConstant';

// ─── Locale type ──────────────────────────────────────────────────────────────
export type Locale = 'vi' | 'en';

// ─── Lazy load locale JSON ────────────────────────────────────────────────────
const locales: Record<Locale, () => Record<string, any>> = {
    vi: () => require('@/src/locales/vi.json'),
    en: () => require('@/src/locales/en.json'),
};

// ─── Dot-notation key lookup ──────────────────────────────────────────────────
/**
 * Tra cứu theo dot-notation: t('settings.title') → 'Cài đặt'
 * Fallback: nếu key miss → trả về key gốc (không crash)
 */
function lookup(dict: Record<string, any>, key: string): string {
    const parts = key.split('.');
    let current: any = dict;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') return key;
        current = current[part];
    }
    if (typeof current === 'string') return current;
    return key;
}

// ─── Context type ─────────────────────────────────────────────────────────────
interface I18nContextType {
    locale: Locale;
    setLocale: (locale: Locale) => Promise<void>;
    t: (key: string) => string;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const I18nContext = createContext<I18nContextType>({
    locale: 'vi',
    setLocale: async () => {},
    t: (key) => key,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
interface I18nProviderProps {
    children: ReactNode;
}

export const I18nProvider = ({ children }: I18nProviderProps) => {
    const [locale, setLocaleState] = useState<Locale>('vi');
    const [dict, setDict] = useState<Record<string, any>>(locales['vi']());

    // Đọc ngôn ngữ đã lưu khi app khởi động
    useEffect(() => {
        AsyncStorage.getItem(StorageKeys.LANGUAGE)
            .then((saved) => {
                const lang: Locale = saved === 'en' ? 'en' : 'vi';
                setLocaleState(lang);
                setDict(locales[lang]());
            })
            .catch(() => {
                // Fallback mặc định tiếng Việt
                setLocaleState('vi');
                setDict(locales['vi']());
            });
    }, []);

    // Đổi ngôn ngữ + lưu vào AsyncStorage
    const setLocale = useCallback(async (lang: Locale) => {
        try {
            await AsyncStorage.setItem(StorageKeys.LANGUAGE, lang);
        } catch {
            // ignore storage error
        }
        setLocaleState(lang);
        setDict(locales[lang]());
    }, []);

    // Hàm dịch dot-notation
    const t = useCallback(
        (key: string): string => lookup(dict, key),
        [dict]
    );

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
/** Hook lấy toàn bộ context (locale, setLocale, t) */
export const useLocale = () => useContext(I18nContext);

/** Hook tiện lợi chỉ lấy hàm t() */
export const useTranslation = () => {
    const { t } = useContext(I18nContext);
    return { t };
};

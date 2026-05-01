import React, { useState, useCallback, useEffect } from 'react'
import {
    Image,
    ImageSourcePropType,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
    ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '@/src/styles/Shadow';
import { STICKER_PACKS } from "./stickerAssets";

/* ─── GIPHY config ─── */
const GIPHY_API_KEY = "pWQXUVmyIAkQDvRczFcT2t3kPzjncYiO";
const DEFAULT_STICKER_QUERY = "hello";

interface Category {
    id: string;
    icon: string;
    name: string;
    color: string;
    stickers: {
        [key: string]: ImageSourcePropType;
    };
}

interface GiphyStickerItem {
    id: string;
    preview: string;
    original: string;
    width?: number;
    height?: number;
}

interface StickerPickerProps {
    setMessage: React.Dispatch<React.SetStateAction<string>>;
    toggleModelSticker: () => void;
    onSendGiphySticker?: (url: string) => void;
}

const STICKER_CATEGORIES = [
    {
        id: 'Pets',
        icon: '🐾',
        name: 'Pets',
        color: '#FFB6C1', // Light Pink
        stickers: STICKER_PACKS.pets
    },
    {
        id: 'Christmas',
        icon: '🎄',
        name: 'Christmas',
        color: '#FF4500', // Orange Red
        stickers: STICKER_PACKS.christmas
    },
    {
        id: 'Home',
        icon: '🏡',
        name: 'Home',
        color: '#FFD700', // Gold
        stickers: STICKER_PACKS.home
    },
    {
        id: 'Love',
        icon: '❤️',
        name: 'Love',
        color: '#FF69B4', // Hot Pink
        stickers: STICKER_PACKS.pets
    },
    {
        id: 'celebrating',
        icon: '🎉',
        name: 'Celebrating',
        color: '#90EE90', // Light Green
        stickers: STICKER_PACKS.christmas
    },
    {
        id: 'active',
        icon: '⚡',
        name: 'Active',
        color: '#87CEEB', // Sky Blue
        stickers: STICKER_PACKS.home
    },
];

const STICKER_SIZE = 56;
const STICKER_SPACING = 8;

export default function StickerPicker({ setMessage, toggleModelSticker, onSendGiphySticker }: StickerPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const { width } = useWindowDimensions();

    /* ─── Tab: 'local' = sticker cũ, 'giphy' = GIPHY online ─── */
    const [activeTab, setActiveTab] = useState<'local' | 'giphy'>('local');

    /* ─── GIPHY state ─── */
    const [stickerItems, setStickerItems] = useState<GiphyStickerItem[]>([]);
    const [stickerLoading, setStickerLoading] = useState(false);
    const [stickerError, setStickerError] = useState('');
    const [giphySearch, setGiphySearch] = useState('');

    const isMobile = Platform.OS !== 'web' || width < 768;
    const containerWidth = isMobile ? Math.min(width * 0.85, 260) : Math.min(width * 0.3, 280);

    /* ─── Fetch GIPHY stickers ─── */
    const fetchStickers = useCallback(async (rawQuery = DEFAULT_STICKER_QUERY) => {
        const query = String(rawQuery || "").trim() || DEFAULT_STICKER_QUERY;
        setStickerLoading(true);
        setStickerError("");

        try {
            const url = `https://api.giphy.com/v1/stickers/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=24&offset=0&rating=g&lang=en`;
            const data = await fetch(url).then((res) => res.json());
            const items = Array.isArray(data?.data)
                ? data.data
                    .map((item: any) => {
                        const media = item?.images || {};
                        const preview =
                            media?.fixed_height_small?.url ||
                            media?.fixed_height?.url ||
                            media?.original?.url ||
                            "";
                        const original = media?.original?.url || preview;
                        if (!preview || !original) return null;

                        return {
                            id: String(item?.id || ""),
                            preview,
                            original,
                            width: Number(media?.original?.width || 0) || undefined,
                            height: Number(media?.original?.height || 0) || undefined,
                        };
                    })
                    .filter(Boolean)
                : [];
            setStickerItems(items);
        } catch (error) {
            console.error("Error loading GIPHY stickers:", error);
            setStickerError("Không tải được sticker");
            setStickerItems([]);
        } finally {
            setStickerLoading(false);
        }
    }, []);

    // Load GIPHY stickers khi chuyển tab
    useEffect(() => {
        if (activeTab === 'giphy' && stickerItems.length === 0) {
            fetchStickers();
        }
    }, [activeTab]);

    // Debounce search GIPHY
    useEffect(() => {
        if (activeTab !== 'giphy') return;
        const timer = setTimeout(() => {
            fetchStickers(giphySearch || DEFAULT_STICKER_QUERY);
        }, 500);
        return () => clearTimeout(timer);
    }, [giphySearch]);

    /* ─── Local sticker logic (giữ nguyên) ─── */
    const filteredCategories = STICKER_CATEGORIES.filter(category =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const leftColumn = filteredCategories.filter((_, i) => i % 2 === 0);
    const rightColumn = filteredCategories.filter((_, i) => i % 2 === 1);

    const renderCategoryButton = (category: Category) => (
        <TouchableOpacity
            key={category.id}
            className="mb-2 px-3 py-2 rounded-lg flex-1"
            style={{ backgroundColor: category.color + '15' }}
            onPress={() => setSelectedCategory(category)}
        >
            <View className="flex-row items-center justify-start space-x-2">
                <Text className="text-base">{category.icon}</Text>
                <Text className="text-sm font-medium text-gray-700" numberOfLines={1}>
                    {category.name}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const renderStickers = () => {
        if (!selectedCategory) return null;

        return (
            <View className="p-2">
                <View className="flex-row items-center mb-3">
                    <TouchableOpacity
                        onPress={() => setSelectedCategory(null)}
                        className="mr-2"
                    >
                        <Ionicons name="arrow-back" size={20} color="#666" />
                    </TouchableOpacity>
                    <Text className="text-base font-medium text-gray-800">{selectedCategory.name}</Text>
                </View>
                <View className="flex-row flex-wrap justify-between">
                    {Object.entries(selectedCategory.stickers).map(([key, path], index) => (
                        <TouchableOpacity
                            key={key}
                            style={{
                                width: STICKER_SIZE,
                                height: STICKER_SIZE,
                                margin: STICKER_SPACING / 2,
                            }}
                            onPress={() => {
                                setMessage(prev => prev + `[sticker:${key}]`);
                                toggleModelSticker();
                            }}
                        >
                            <Image
                                source={path}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                }}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    /* ─── Render GIPHY tab ─── */
    const renderGiphyTab = () => (
        <View style={{ padding: 8 }}>
            {/* Search bar */}
            <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#f3f4f6', borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8,
            }}>
                <Ionicons name="search-outline" size={14} color="#666" />
                <TextInput
                    style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#1f2937' }}
                    placeholder="Tìm sticker GIPHY..."
                    value={giphySearch}
                    onChangeText={setGiphySearch}
                    placeholderTextColor="#999"
                />
                {giphySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setGiphySearch('')}>
                        <Ionicons name="close-circle" size={16} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Loading */}
            {stickerLoading && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <ActivityIndicator size="small" color="#6d28d9" />
                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>Đang tải...</Text>
                </View>
            )}

            {/* Error */}
            {stickerError && !stickerLoading && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ color: '#ef4444', fontSize: 12 }}>{stickerError}</Text>
                    <TouchableOpacity onPress={() => fetchStickers(giphySearch)} style={{ marginTop: 6 }}>
                        <Text style={{ color: '#6d28d9', fontSize: 12, fontWeight: '600' }}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Grid */}
            {!stickerLoading && !stickerError && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 6 }}>
                    {stickerItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 8,
                                overflow: 'hidden',
                                backgroundColor: '#f9fafb',
                            }}
                            onPress={() => {
                                if (onSendGiphySticker) {
                                    onSendGiphySticker(item.original);
                                    toggleModelSticker(); // Đóng picker sau khi set preview
                                } else {
                                    setMessage(item.original);
                                    toggleModelSticker();
                                }
                            }}
                        >
                            <Image
                                source={{ uri: item.preview }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Empty */}
            {!stickerLoading && !stickerError && stickerItems.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>Không tìm thấy sticker</Text>
                </View>
            )}

            {/* Powered by GIPHY */}
            <View style={{ alignItems: 'center', marginTop: 8, opacity: 0.5 }}>
                <Text style={{ fontSize: 10, color: '#9ca3af' }}>Powered by GIPHY</Text>
            </View>
        </View>
    );

    return (
        <View
            style={{
                width: containerWidth,
                backgroundColor: 'white',
                borderRadius: 8,
                ...Shadows.lg
            }}>

            {/* ─── Tab bar: Local / GIPHY ─── */}
            <View style={{
                flexDirection: 'row',
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
            }}>
                <TouchableOpacity
                    onPress={() => { setActiveTab('local'); setSelectedCategory(null); }}
                    style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                        borderBottomWidth: 2,
                        borderBottomColor: activeTab === 'local' ? '#6d28d9' : 'transparent',
                    }}
                >
                    <Text style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: activeTab === 'local' ? '#6d28d9' : '#9ca3af',
                    }}>
                        🎨 Sticker
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('giphy')}
                    style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                        borderBottomWidth: 2,
                        borderBottomColor: activeTab === 'giphy' ? '#6d28d9' : 'transparent',
                    }}
                >
                    <Text style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: activeTab === 'giphy' ? '#6d28d9' : '#9ca3af',
                    }}>
                        ✨ GIPHY
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ─── Content ─── */}
            <ScrollView style={{ maxHeight: 300 }}>
                {activeTab === 'giphy' ? renderGiphyTab() : (
                    <>
                        {/* Search Bar local - Chỉ hiển thị khi không có category được chọn */}
                        {!selectedCategory && (
                            <View className="p-2 border-b border-gray-200">
                                <View className="flex-row items-center bg-gray-100 rounded-lg px-2 py-1">
                                    <Ionicons name="search-outline" size={14} color="#666" />
                                    <TextInput
                                        className="flex-1 ml-2 text-sm text-gray-800"
                                        placeholder="Search"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholderTextColor="#666"
                                    />
                                </View>
                            </View>
                        )}
                        {selectedCategory ? renderStickers() : (
                            <View className="p-2">
                                <View className="flex-row space-x-2">
                                    <View className="flex-1 space-y-2">
                                        {leftColumn.map(renderCategoryButton)}
                                    </View>
                                    <View className="flex-1 space-y-2">
                                        {rightColumn.map(renderCategoryButton)}
                                    </View>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}
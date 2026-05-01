import React, {useEffect, useRef} from 'react';
import {Animated, Platform, StatusBar, StyleSheet, Text} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

interface ToastProps {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onHide: () => void;
    duration?: number;
    showIcon?: boolean;
}

const Toast = ({
                   visible,
                   message,
                   type,
                   onHide,
                   duration = 2000,
                   showIcon = true
               }: ToastProps) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(duration),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => onHide());
        }
    }, [visible, duration]);

    if (!visible) return null;

    const getToastStyle = () => {
        switch (type) {
            case 'success':
                return styles.success;
            case 'error':
                return styles.error;
            case 'warning':
                return styles.warning;
            case 'info':
                return styles.info;
            default:
                return styles.info;
        }
    };

    const getIconName = (): keyof typeof Ionicons.glyphMap => {
        switch (type) {
            case 'success':
                return 'checkmark-circle-outline';
            case 'error':
                return 'alert-circle-outline';
            case 'warning':
                return 'warning-outline';
            case 'info':
                return 'information-circle-outline';
            default:
                return 'information-circle-outline';
        }
    };

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.container,
                isWeb ? styles.webContainer : styles.mobileContainer,
                {opacity},
                getToastStyle(),
                {zIndex: 9999},
            ]}
        >
            {showIcon && (
                <Ionicons
                    name={getIconName()}
                    size={20}
                    color="white"
                    style={styles.icon}
                />
            )}
            <Text style={styles.message}>{message}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    webContainer: {
        top: 30,
        right: 30,
        width: 'auto',
        minWidth: 280,
        maxWidth: 450,
        // Glassmorphism effect for web
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
    },
    mobileContainer: {
        top: (StatusBar.currentHeight || 0) + 20,
        left: 20,
        right: 20,
    },
    success: {
        backgroundColor: Platform.OS === 'web' ? 'rgba(16, 185, 129, 0.9)' : '#10b981',
    },
    error: {
        backgroundColor: Platform.OS === 'web' ? 'rgba(239, 68, 68, 0.9)' : '#ef4444',
    },
    warning: {
        backgroundColor: Platform.OS === 'web' ? 'rgba(245, 158, 11, 0.9)' : '#f59e0b',
    },
    info: {
        backgroundColor: Platform.OS === 'web' ? 'rgba(59, 130, 246, 0.9)' : '#3b82f6',
    },
    icon: {
        marginRight: 12,
    },
    message: {
        color: 'white',
        fontSize: 15,
        fontWeight: '600',
        flexShrink: 1,
        letterSpacing: 0.3,
    }
});

export default Toast;
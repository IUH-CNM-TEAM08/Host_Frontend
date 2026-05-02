import 'dotenv/config';

export default {
    expo: {
        name: "thach",
        slug: "thach",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./resources/assets/images/icon.png",
        scheme: "zala",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        ios: {
            bundleIdentifier: "com.thachtaki.thach",
            infoPlist: {
                NSPhotoLibraryUsageDescription: "Ứng dụng cần quyền truy cập thư viện ảnh để chọn ảnh nhóm.",
                // HTTP tới IP LAN (backend dev) — không có thì iOS có thể chặn, axios báo Network Error.
                NSAppTransportSecurity: {
                    NSAllowsLocalNetworking: true,
                },
            }
        },
        android: {
            package: "com.thachtaki.thach",
            adaptiveIcon: {
                foregroundImage: "./resources/assets/images/adaptive-icon.png",
                backgroundColor: "#ffffff"
            },
            usesCleartextTraffic: true
        },
        web: {
            bundler: "metro",
            output: "static",
            favicon: "./resources/assets/images/favicon.png"
        },
        plugins: [
            "./plugins/withReactNativeCameraFix",
            "expo-router",
            [
                "expo-splash-screen",
                {
                    "image": "./resources/assets/images/splash-icon.png",
                    "imageWidth": 200,
                    "resizeMode": "contain",
                    "backgroundColor": "#ffffff"
                }
            ],
            [
                "expo-camera",
                {
                    "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera",
                    "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone",
                    "recordAudioAndroid": true
                }
            ],
            [
                "expo-image-picker",
                {
                    "photosPermission": "The app accesses your photos to let you share them with your friends."
                }
            ]
        ],
        experiments: {
            typedRoutes: true
        },
        extra: {
            HOST_BE: process.env.HOST_BE,
            PORT_BE: process.env.PORT_BE,
            eas: {
                projectId: "06f447ea-f1dc-47ad-9f46-01bcc8c488e7",
            },
        },
    },
};

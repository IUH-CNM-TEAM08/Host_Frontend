import {ImageSourcePropType} from "react-native";

type URI = string | null | undefined;

const validateImageURL = async (uri: URI, fallbackImage: any): Promise<ImageSourcePropType> => {
    try {
        if (!uri || !uri.startsWith("http")) return fallbackImage;
        // Không gửi HEAD bằng axios để tránh interceptor tự gắn Authorization,
        // gây preflight CORS 403 với ảnh public từ S3.
        return {uri};
    } catch (error) {
        if (__DEV__) console.warn("Failed to validate image URL:", uri);
        return fallbackImage;
    }
};

const validateAvatar = async (uri: string | null | undefined): Promise<ImageSourcePropType> => {
    return validateImageURL(uri, require("@/resources/assets/profile/avatar.png"));
};

const validateCover = async (uri: string | null | undefined): Promise<ImageSourcePropType> => {
    return validateImageURL(uri, require("@/resources/assets/profile/cover.png"));
};

const validateGroupAvatar = async (uri: string | null | undefined): Promise<ImageSourcePropType> => {
    return validateImageURL(uri, require("@/resources/assets/profile/cover.png"));
};

export {validateAvatar, validateCover, validateGroupAvatar};

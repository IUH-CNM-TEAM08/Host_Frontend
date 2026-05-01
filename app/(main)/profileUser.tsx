import React, {useCallback, useEffect, useRef, useState} from "react";
import {
    Animated,
    Dimensions,
    ImageSourcePropType,
    Modal,
    Pressable,
    View
} from "react-native";
import Toast from '@/src/components/ui/Toast';
import ProfileUserInfo from "./profileUserInfo";
import ProfileUserEdit from "./profileUserEdit";
import {pickAvatar, pickCover} from '@/src/utils/ImagePicker';
import {useLocalSearchParams, useRouter} from "expo-router";
import {useUser} from "@/src/contexts/user/UserContext";
import {validateAvatar, validateCover} from "@/src/utils/ImageValidator";
import { userService as UserService } from "@/src/api/services/user.service";
import { friendshipService } from "@/src/api/services/friendship.service";
import { conversationService as ConversationService } from "@/src/api/services/conversation.service";
import SocketService from "@/src/api/socketCompat";
import { uploadMediaToS3 } from "@/src/api/services/media.service";
import {useTranslation} from "@/src/contexts/i18n/I18nContext";

type ProfileModalProps = {
    visible?: boolean;
    onClose?: () => void;
};

export default function ProfileModal({visible = true, onClose}: ProfileModalProps) {
    const router = useRouter();
    const {user, update} = useUser();
    const {t} = useTranslation();
    const {user: fetchedUser} = useUser();
    const params = useLocalSearchParams<{ userId?: string }>();
    const externalUserId = typeof params.userId === 'string' ? params.userId : undefined;
    const [editMode, setEditMode] = useState(false);
    const [avatarUri, setAvatarUri] = useState<string | null>("");
    const [coverUri, setCoverUri] = useState<string | null>("");
    const [editUser, setEditUser] = useState({...fetchedUser});
    const [viewedUser, setViewedUser] = useState<any>(fetchedUser ?? null);
    const [allowStrangerMessage, setAllowStrangerMessage] = useState(true);
    const [allowStrangerCall, setAllowStrangerCall] = useState(true);
    const [allowStrangerGroupInvite, setAllowStrangerGroupInvite] = useState(true);
    const [privacyLoading, setPrivacyLoading] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none');
    const [friendshipId, setFriendshipId] = useState<string | null>(null);
    const [friendshipLoading, setFriendshipLoading] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const socketService = useRef(SocketService.getInstance()).current;
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'success' as 'success' | 'error'
    });

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const [animating, setAnimating] = useState(false);

    const {width, height} = Dimensions.get('window');
    const modalWidth = width >= 768
        ? Math.min(560, Math.max(420, width * 0.38))
        : Math.min(width - 24, 420);
    const modalHeight = height >= 768 ? height * 0.88 : height * 0.84;
    const isReadonlyProfile = Boolean(externalUserId && externalUserId !== fetchedUser?.id);

    const refreshFriendshipStatus = useCallback(async () => {
        if (!isReadonlyProfile || !externalUserId) {
            setFriendshipStatus('none');
            setFriendshipId(null);
            return;
        }
        try {
            const res: any = await friendshipService.getStatus<any>(externalUserId);
            const payload = res?.data ?? res;
            const status = String(payload?.status || 'NONE').toUpperCase();
            const iAmRequester = Boolean(payload?.iAmRequester);
            const id =
                payload?.friendship?.id ??
                payload?.friendship?._id ??
                payload?.friendshipId ??
                null;
            setFriendshipId(id ? String(id) : null);
            if (status === 'ACCEPTED') {
                setFriendshipStatus('accepted');
            } else if (status === 'PENDING') {
                setFriendshipStatus(iAmRequester ? 'pending_sent' : 'pending_received');
            } else {
                setFriendshipStatus('none');
            }
        } catch {
            setFriendshipStatus('none');
            setFriendshipId(null);
        }
    }, [externalUserId, isReadonlyProfile]);

    useEffect(() => {
        void refreshFriendshipStatus();
    }, [refreshFriendshipStatus]);

    useEffect(() => {
        if (!isReadonlyProfile || !externalUserId) return;
        const handleFriendshipChanged = () => {
            void refreshFriendshipStatus();
        };
        socketService.onFriendRequest(handleFriendshipChanged);
        socketService.onFriendRequestAccepted(handleFriendshipChanged);
        socketService.onDeleteFriendRequest(handleFriendshipChanged);
        return () => {
            socketService.removeFriendRequestListener(handleFriendshipChanged);
            socketService.removeFriendRequestAcceptedListener(handleFriendshipChanged);
            socketService.removeFriendRequestActionListener(handleFriendshipChanged);
        };
    }, [externalUserId, isReadonlyProfile, refreshFriendshipStatus, socketService]);

    useEffect(() => {
        let cancelled = false;
        const loadViewedUser = async () => {
            if (!externalUserId || externalUserId === fetchedUser?.id) {
                setViewedUser(fetchedUser ?? null);
                setEditUser({ ...fetchedUser });
                return;
            }
            try {
                const res = await UserService.getUserById(externalUserId);
                if (!cancelled && res.success && res.user) {
                    setViewedUser(res.user);
                    setEditUser({ ...res.user });
                }
            } catch {
                if (!cancelled) setViewedUser(fetchedUser ?? null);
            }
        };
        loadViewedUser();
        return () => { cancelled = true; };
    }, [externalUserId, fetchedUser?.id]);

    useEffect(() => {
        // Đồng bộ realtime profile của chính mình khi context user đổi sau update.
        if (isReadonlyProfile) return;
        setViewedUser(fetchedUser ?? null);
        setEditUser({ ...(fetchedUser ?? {}) });
    }, [fetchedUser, isReadonlyProfile]);

    useEffect(() => {
        let cancelled = false;
        const loadPrivacy = async () => {
            if (isReadonlyProfile) return;
            try {
                const res: any = await UserService.getStrangerMessagePrivacy<any>();
                const payload = res?.data ?? res;
                if (!cancelled) {
                    setAllowStrangerMessage(Boolean(payload?.allowStrangerMessage ?? true));
                    setAllowStrangerCall(Boolean(payload?.allowStrangerCall ?? true));
                    setAllowStrangerGroupInvite(Boolean(payload?.allowStrangerGroupInvite ?? true));
                }
            } catch {
                if (!cancelled) {
                    setAllowStrangerMessage(true);
                    setAllowStrangerCall(true);
                    setAllowStrangerGroupInvite(true);
                }
            }
        };
        void loadPrivacy();
        return () => { cancelled = true; };
    }, [isReadonlyProfile]);

    useEffect(() => {
        if (isReadonlyProfile || !user?.id) return;
        const handlePrivacyUpdated = (payload: {
            userId: string;
            allowStrangerMessage: boolean;
            allowStrangerCall: boolean;
            allowStrangerGroupInvite: boolean;
        }) => {
            if (String(payload?.userId ?? "") !== String(user.id)) return;
            setAllowStrangerMessage(Boolean(payload.allowStrangerMessage));
            setAllowStrangerCall(Boolean(payload.allowStrangerCall));
            setAllowStrangerGroupInvite(Boolean(payload.allowStrangerGroupInvite));
        };
        socketService.onUserPrivacyUpdated(handlePrivacyUpdated);
        return () => socketService.removeUserPrivacyUpdatedListener(handlePrivacyUpdated as any);
    }, [isReadonlyProfile, user?.id, socketService]);

    useEffect(() => {
        const handleUserProfileUpdated = (payload: {
            userId: string;
            displayName?: string;
            avatarUrl?: string;
            coverUrl?: string;
            updatedAt?: string;
        }) => {
            const targetId = String(payload?.userId ?? "");
            const currentViewedId = String(viewedUser?.id ?? viewedUser?._id ?? "");
            if (!targetId || !currentViewedId || targetId !== currentViewedId) return;

            setViewedUser((prev: any) => ({
                ...(prev ?? {}),
                name: payload.displayName ?? prev?.name,
                displayName: payload.displayName ?? prev?.displayName,
                avatarURL: payload.avatarUrl ?? prev?.avatarURL,
                avatarUrl: payload.avatarUrl ?? prev?.avatarUrl,
                coverURL: payload.coverUrl ?? prev?.coverURL,
                coverUrl: payload.coverUrl ?? prev?.coverUrl,
                updatedAt: payload.updatedAt ?? prev?.updatedAt,
            }));
        };

        socketService.onUserProfileUpdated(handleUserProfileUpdated);
        return () => socketService.removeUserProfileUpdatedListener(handleUserProfileUpdated as any);
    }, [socketService, viewedUser?.id, viewedUser?._id]);

    const handleToggleAllowStrangerMessage = async (next: boolean) => {
        if (isReadonlyProfile) return;
        try {
            setPrivacyLoading(true);
            await UserService.updateStrangerMessagePrivacy(next);
            setAllowStrangerMessage(next);
            setToast({
                visible: true,
                message: next ? t('privacy.strangerMessageOn') : t('privacy.strangerMessageOff'),
                type: 'success'
            });
        } catch (error) {
            console.error('Error updating stranger message privacy:', error);
            setToast({
                visible: true,
                message: t('profile.privacyUpdateFailed'),
                type: 'error'
            });
        } finally {
            setPrivacyLoading(false);
        }
    };

    const handleToggleAllowStrangerCall = async (next: boolean) => {
        if (isReadonlyProfile) return;
        try {
            setPrivacyLoading(true);
            await UserService.updateStrangerCallPrivacy(next);
            setAllowStrangerCall(next);
            setToast({
                visible: true,
                message: next ? t('privacy.strangerCallOn') : t('privacy.strangerCallOff'),
                type: 'success'
            });
        } catch (error) {
            console.error('Error updating stranger call privacy:', error);
            setToast({
                visible: true,
                message: t('profile.callPrivacyUpdateFailed'),
                type: 'error'
            });
        } finally {
            setPrivacyLoading(false);
        }
    };

    const handleToggleAllowStrangerGroupInvite = async (next: boolean) => {
        if (isReadonlyProfile) return;
        try {
            setPrivacyLoading(true);
            await UserService.updateStrangerGroupInvitePrivacy(next);
            setAllowStrangerGroupInvite(next);
            setToast({
                visible: true,
                message: next ? t('privacy.strangerGroupOn') : t('privacy.strangerGroupOff'),
                type: 'success'
            });
        } catch (error) {
            console.error('Error updating stranger group invite privacy:', error);
            setToast({
                visible: true,
                message: t('profile.groupInvitePrivacyUpdateFailed'),
                type: 'error'
            });
        } finally {
            setPrivacyLoading(false);
        }
    };

    const handleSendFriendRequest = async () => {
        if (!externalUserId || friendshipLoading) return;
        try {
            setFriendshipLoading(true);
            await friendshipService.sendRequest(externalUserId);
            setToast({
                visible: true,
                message: t('contacts.requestSent'),
                type: 'success',
            });
            await refreshFriendshipStatus();
        } catch (error: any) {
            setToast({
                visible: true,
                message: error?.response?.data?.message || t('contacts.cannotSendRequest'),
                type: 'error',
            });
        } finally {
            setFriendshipLoading(false);
        }
    };

    const handleRecallFriendRequest = async () => {
        if (!friendshipId || friendshipLoading) return;
        try {
            setFriendshipLoading(true);
            await friendshipService.recall(friendshipId);
            setToast({
                visible: true,
                message: t('contacts.requestRecalled'),
                type: 'success',
            });
            await refreshFriendshipStatus();
        } catch (error: any) {
            setToast({
                visible: true,
                message: error?.response?.data?.message || t('contacts.cannotRecall'),
                type: 'error',
            });
        } finally {
            setFriendshipLoading(false);
        }
    };

    const handleAcceptFriendRequest = async () => {
        if (!friendshipId || friendshipLoading) return;
        try {
            setFriendshipLoading(true);
            await friendshipService.accept(friendshipId);
            setToast({
                visible: true,
                message: t('contacts.requestAccepted'),
                type: 'success',
            });
            await refreshFriendshipStatus();
        } catch (error: any) {
            setToast({
                visible: true,
                message: error?.response?.data?.message || t('contacts.cannotAccept'),
                type: 'error',
            });
        } finally {
            setFriendshipLoading(false);
        }
    };

    const handleRejectFriendRequest = async () => {
        if (!friendshipId || friendshipLoading) return;
        try {
            setFriendshipLoading(true);
            await friendshipService.reject(friendshipId);
            setToast({
                visible: true,
                message: t('contacts.requestRejected'),
                type: 'success',
            });
            await refreshFriendshipStatus();
        } catch (error: any) {
            setToast({
                visible: true,
                message: error?.response?.data?.message || t('contacts.cannotReject'),
                type: 'error',
            });
        } finally {
            setFriendshipLoading(false);
        }
    };

    const handleStartChat = async () => {
        if (!externalUserId || !user?.id || chatLoading) return;
        try {
            setChatLoading(true);
            if (friendshipStatus !== 'accepted') {
                try {
                    const privacyRes: any = await UserService.getMessageAllowed<any>(externalUserId);
                    const payload = privacyRes?.data ?? privacyRes;
                    if (payload?.allowed === false) {
                        setToast({
                            visible: true,
                            message: t('chat.strangerMessageOff'),
                            type: 'error',
                        });
                        return;
                    }
                } catch (privacyError) {
                    console.warn('Privacy check failed, continue create chat:', privacyError);
                }
            }

            await ConversationService.createPrivate(user.id, externalUserId);
            router.replace('/');
        } catch (error: any) {
            setToast({
                visible: true,
                message: error?.response?.data?.message || t('chat.cannotOpen'),
                type: 'error',
            });
        } finally {
            setChatLoading(false);
        }
    };

    // Handle animation when editMode changes
    useEffect(() => {
        if (editMode) {
            setAnimating(true);
            Animated.timing(slideAnim, {
                toValue: -1,
                duration: 300,
                useNativeDriver: true
            }).start(() => {
                setAnimating(false);
            });
        } else {
            setAnimating(true);
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }).start(() => {
                setAnimating(false);
            });
        }
    }, [editMode]);

    const handlePickAvatar = async () => {
        if (isReadonlyProfile || uploadingImage) return;
        const result = await pickAvatar();
        if (result.success) {
            try {
                setUploadingImage(true);
                setToast({
                    visible: true,
                    message: t('profile.uploadingAvatar'),
                    type: 'success'
                });

                const localUri = result.uri || '';
                const uploaded = await uploadMediaToS3([{
                    uri: localUri,
                    name: `avatar_${Date.now()}.jpg`,
                    type: result.mimeType || 'image/jpeg',
                }]);
                const uploadedUrl = uploaded?.[0]?.url;

                if (!uploadedUrl) {
                    throw new Error('Không lấy được URL ảnh đại diện sau upload.');
                }

                setAvatarUri(uploadedUrl);
                const updateResult = await update({
                    ...user,
                    avatarURL: uploadedUrl
                });

                if (updateResult.success) {
                    setViewedUser((prev: any) => ({
                        ...(prev ?? {}),
                        avatarURL: uploadedUrl,
                        avatarUrl: uploadedUrl,
                    }));
                }

                setToast({
                    visible: true,
                    message: updateResult.success ? result.message : (updateResult.message || 'Cập nhật ảnh đại diện thất bại'),
                    type: updateResult.success ? 'success' : 'error'
                });
            } catch (error) {
                console.error('Error updating avatar image:', error);
                setToast({
                    visible: true,
                    message: t('profile.avatarUpdateFailed'),
                    type: 'error'
                });
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const handlePickCover = async () => {
        if (isReadonlyProfile || uploadingImage) return;
        const result = await pickCover();
        if (result.success) {
            try {
                setUploadingImage(true);
                setToast({
                    visible: true,
                    message: t('profile.uploadingCover'),
                    type: 'success'
                });

                const localUri = result.uri || '';
                const uploaded = await uploadMediaToS3([{
                    uri: localUri,
                    name: `cover_${Date.now()}.jpg`,
                    type: result.mimeType || 'image/jpeg',
                }]);
                const uploadedUrl = uploaded?.[0]?.url;

                if (!uploadedUrl) {
                    throw new Error('Không lấy được URL ảnh bìa sau upload.');
                }

                setCoverUri(uploadedUrl);
                const updateResult = await update({
                    ...user,
                    coverURL: uploadedUrl
                });

                if (updateResult.success) {
                    setViewedUser((prev: any) => ({
                        ...(prev ?? {}),
                        coverURL: uploadedUrl,
                        coverUrl: uploadedUrl,
                    }));
                }

                setToast({
                    visible: true,
                    message: updateResult.success ? result.message : (updateResult.message || 'Cập nhật ảnh bìa thất bại'),
                    type: updateResult.success ? 'success' : 'error'
                });
            } catch (error) {
                console.error('Error updating cover image:', error);
                setToast({
                    visible: true,
                    message: t('profile.coverUpdateFailed'),
                    type: 'error'
                });
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const [avatar, setAvatar] = useState<ImageSourcePropType>({uri: ""});
    const [cover, setCover] = useState<ImageSourcePropType>({uri: ""});

    useEffect(() => {
        const avatarSource = avatarUri || viewedUser?.avatarURL || viewedUser?.avatarUrl || "";
        const coverSource = coverUri || viewedUser?.coverURL || viewedUser?.coverUrl || "";
        validateAvatar(avatarSource).then((validatedAvatar) => {
            setAvatar(validatedAvatar);
        });

        validateCover(coverSource).then((validatedCover) => {
            setCover(validatedCover);
        });
    }, [avatarUri, coverUri, viewedUser?.avatarURL, viewedUser?.avatarUrl, viewedUser?.coverURL, viewedUser?.coverUrl]);

    const handleEdit = async () => {
        if (isReadonlyProfile) return;
        console.log('Saving user profile changes:', editUser);

        // Validation
        if (!editUser?.name?.trim()) {
            // validation
            setToast({
                visible: true,
                message: t('profile.displayNameRequired'),
                type: 'error'
            });
            return;
        }

        try {
            setToast({
                visible: true,
                message: t('profile.updatingInfo'),
                type: 'success'
            });

            const updateData = {
                name: editUser.name,
                gender: editUser.gender,
                dob: editUser.dob
            };

            console.log('Sending update request with data:', updateData);
            const result = await update(updateData);
            console.log('Update result:', result);

            if (result.success) {
                const refreshedUser = (result as any)?.data ?? null;
                if (refreshedUser) {
                    setViewedUser(refreshedUser);
                    setEditUser({ ...refreshedUser });
                } else {
                    setViewedUser((prev: any) => ({ ...(prev ?? {}), ...updateData }));
                }
                setToast({
                    visible: true,
                    message: result.message || 'Cập nhật thông tin thành công!',
                    type: 'success'
                });

                setEditMode(false);
                setTimeout(() => {router.replace('/(main)')}, 1000);
            } else {
                setToast({
                    visible: true,
                    message: result.message || 'Cập nhật thông tin thất bại!',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Error during profile update:', error);
            setToast({
                visible: true,
                message: 'Đã xảy ra lỗi khi cập nhật thông tin.',
                type: 'error'
            });
        }
    };

    const handleCancel = () => {
        setEditUser({...fetchedUser});
        setEditMode(false);
    };

    const toggleEdit = () => {
        if (isReadonlyProfile) return;
        setEditUser({...fetchedUser});
        setEditMode(true);
    };

    const closeModal = () => {
        setEditMode(false);
        if (typeof onClose === 'function') {
            onClose();
            return;
        }
        router.back();
    };

    // Calculate transform values for the animation
    const infoTranslateX = slideAnim.interpolate({
        inputRange: [-1, 0],
        outputRange: [-(modalWidth), 0]
    });

    const editTranslateX = slideAnim.interpolate({
        inputRange: [-1, 0],
        outputRange: [0, modalWidth]
    });

    return (
        <>
            <Modal
                animationType="fade"
                transparent={true}
                visible={visible}
                onRequestClose={closeModal}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <Pressable
                        onPress={closeModal}
                        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                    />

                    <View style={{
                        width: modalWidth,
                        height: modalHeight,
                        backgroundColor: '#ffffff',
                        borderRadius: 8,
                        overflow: 'hidden',
                    }}>
                        <View style={{ flex: 1, position: 'relative', height: modalHeight }}>
                            {/* Always render both screens but control visibility with animation */}
                            {(editMode || animating) && (
                                <Animated.View
                                    style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        transform: [{translateX: editTranslateX}]
                                    }}
                                >
                                    <ProfileUserEdit
                                        editUser={editUser}
                                        onSave={handleEdit}
                                        onCancel={handleCancel}
                                        onChangeUser={setEditUser}
                                    />
                                </Animated.View>
                            )}

                            {(!editMode || animating) && (
                                <Animated.View
                                    style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        transform: [{translateX: infoTranslateX}]
                                    }}
                                >
                                    <ProfileUserInfo
                                        user={viewedUser}
                                        avatar={avatar}
                                        cover={cover}
                                        onPickAvatar={handlePickAvatar}
                                        onPickCover={handlePickCover}
                                        onEditPress={toggleEdit}
                                        onClose={closeModal}
                                        readOnly={isReadonlyProfile}
                                        allowStrangerMessage={allowStrangerMessage}
                                        allowStrangerCall={allowStrangerCall}
                                        allowStrangerGroupInvite={allowStrangerGroupInvite}
                                        strangerPrivacyLoading={privacyLoading}
                                        onToggleAllowStrangerMessage={handleToggleAllowStrangerMessage}
                                        onToggleAllowStrangerCall={handleToggleAllowStrangerCall}
                                        onToggleAllowStrangerGroupInvite={handleToggleAllowStrangerGroupInvite}
                                        friendshipStatus={friendshipStatus}
                                        friendActionLoading={friendshipLoading}
                                        chatActionLoading={chatLoading}
                                        onSendFriendRequest={isReadonlyProfile ? handleSendFriendRequest : undefined}
                                        onRecallFriendRequest={isReadonlyProfile ? handleRecallFriendRequest : undefined}
                                        onAcceptFriendRequest={isReadonlyProfile ? handleAcceptFriendRequest : undefined}
                                        onRejectFriendRequest={isReadonlyProfile ? handleRejectFriendRequest : undefined}
                                        onStartChat={isReadonlyProfile ? handleStartChat : undefined}
                                    />
                                </Animated.View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={() => setToast(prev => ({...prev, visible: false}))}
            />
        </>
    );
}
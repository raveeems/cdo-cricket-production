import { ImageSourcePropType } from 'react-native';

const USER_AVATARS: Record<string, ImageSourcePropType> = {
  'f9766751-4cda-4099-b415-40a5b5ee89a0': require('../assets/images/ravee-avatar.jpg'),
};

export function getCustomAvatar(userId?: string | null): ImageSourcePropType | null {
  if (!userId) return null;
  return USER_AVATARS[userId] ?? null;
}

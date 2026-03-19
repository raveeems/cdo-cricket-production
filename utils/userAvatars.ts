import { ImageSourcePropType } from 'react-native';

const USER_AVATARS: Record<string, ImageSourcePropType> = {
  'b118f8f2-ae8e-4444-9f27-16266e7f5ea1': require('../assets/images/ravee-avatar.jpg'),
};

export function getCustomAvatar(userId?: string | null): ImageSourcePropType | null {
  if (!userId) return null;
  return USER_AVATARS[userId] ?? null;
}

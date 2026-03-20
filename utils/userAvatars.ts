import { ImageSourcePropType } from 'react-native';

const USER_AVATARS: Record<string, ImageSourcePropType> = {
  'b118f8f2-ae8e-4444-9f27-16266e7f5ea1': require('../assets/images/ravee-avatar.jpg'),
  '166f6421-e1b0-4ded-adb0-c57e49a2e830': require('../assets/images/ajay-avatar.jpg'),
  '01c3dbaa-ced6-4788-bd35-85ca28a1e30e': require('../assets/images/ilamcetni-avatar.jpg'),
  '15513544-9fb1-4b47-a95a-6bbf1c40f50d': require('../assets/images/chandru11-avatar.jpg'),
  'f8615988-ee3e-4f93-84b7-da474be95c6d': require('../assets/images/arun-avatar.jpg'),
  'cf0d4aef-3300-4e26-b69c-45717d9ae3ca': require('../assets/images/shanky-avatar.jpg'),
  '9d1c5aa1-96f1-4be1-a9ae-5b062d01ac8e': require('../assets/images/nagoor-meeran-avatar.jpg'),
  'e9ef12ca-03bc-47f6-83dd-454e51ebcd10': require('../assets/images/prannit-stefano-avatar.jpg'),
};

export function getCustomAvatar(userId?: string | null): ImageSourcePropType | null {
  if (!userId) return null;
  return USER_AVATARS[userId] ?? null;
}

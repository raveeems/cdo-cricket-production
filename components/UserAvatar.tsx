import React from 'react';
import { View, Text, Image, StyleProp, ViewStyle } from 'react-native';
import { getCustomAvatar } from '@/utils/userAvatars';

interface UserAvatarProps {
  userId?: string | null;
  userName: string;
  size: number;
  backgroundColor: string;
  textColor: string;
  fontSize?: number;
  fontFamily?: string;
  style?: StyleProp<ViewStyle>;
}

export function UserAvatar({
  userId,
  userName,
  size,
  backgroundColor,
  textColor,
  fontSize,
  fontFamily = 'Inter_600SemiBold',
  style,
}: UserAvatarProps) {
  const customAvatar = getCustomAvatar(userId);
  const initial = (userName?.[0] ?? '?').toUpperCase();
  const computedFontSize = fontSize ?? Math.round(size * 0.4);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {customAvatar ? (
        <Image
          source={customAvatar}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ color: textColor, fontSize: computedFontSize, fontFamily }}>
          {initial}
        </Text>
      )}
    </View>
  );
}

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const CODES_STORAGE_KEY = '@cdo_ref_codes';

export default function AdminScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [codes, setCodes] = useState<string[]>([]);
  const [newCode, setNewCode] = useState('');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    const stored = await AsyncStorage.getItem(CODES_STORAGE_KEY);
    if (stored) {
      setCodes(JSON.parse(stored));
    }
  };

  const generateCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setNewCode(code);
  };

  const saveCode = async () => {
    if (newCode.length !== 4) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = [...codes, newCode];
    await AsyncStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(updated));
    setCodes(updated);
    setNewCode('');
  };

  const deleteCode = async (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = codes.filter((c) => c !== code);
    await AsyncStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(updated));
    setCodes(updated);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8, paddingHorizontal: 16 }}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Admin Panel
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <LinearGradient
            colors={[colors.error + '20', colors.warning + '10']}
            style={[styles.warningBanner, { borderColor: colors.error + '30' }]}
          >
            <Ionicons name="shield-checkmark" size={20} color={colors.error} />
            <Text style={[styles.warningText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
              Admin access for {user?.username}
            </Text>
          </LinearGradient>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Reference Codes
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Generate 4-digit codes to invite friends to the platform.
            </Text>

            <View style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.generateRow}>
                <TextInput
                  style={[styles.codeInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_700Bold' }]}
                  value={newCode}
                  onChangeText={setNewCode}
                  placeholder="0000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Pressable
                  onPress={generateCode}
                  style={[styles.generateBtn, { backgroundColor: colors.primary + '20' }]}
                >
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={saveCode}
                  disabled={newCode.length !== 4}
                  style={[styles.addBtn, { opacity: newCode.length === 4 ? 1 : 0.5 }]}
                >
                  <LinearGradient
                    colors={[colors.accent, colors.accentDark]}
                    style={styles.addBtnGradient}
                  >
                    <Ionicons name="add" size={22} color="#000" />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>

            <View style={styles.codesList}>
              <Text style={[styles.codesHeader, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                Default Codes: 1234, 5678, 9012, 3456
              </Text>

              {codes.length > 0 && (
                <Text style={[styles.codesHeader, { color: colors.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 12 }]}>
                  Custom Codes ({codes.length})
                </Text>
              )}

              {codes.map((code, idx) => (
                <View
                  key={`${code}_${idx}`}
                  style={[styles.codeItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                >
                  <View style={styles.codeItemLeft}>
                    <View style={[styles.codeChip, { backgroundColor: colors.success + '20' }]}>
                      <Text style={[styles.codeChipText, { color: colors.success, fontFamily: 'Inter_700Bold' }]}>
                        {code}
                      </Text>
                    </View>
                    <View style={[styles.activeBadge, { backgroundColor: colors.success + '15' }]}>
                      <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.activeText, { color: colors.success, fontFamily: 'Inter_500Medium' }]}>
                        Active
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => deleteCode(code)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Match Management
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Manually add or edit match details.
            </Text>

            <View style={[styles.comingSoon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="cricket" size={32} color={colors.textTertiary} />
              <Text style={[styles.comingSoonText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                Match management via Cricket API integration coming soon
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Scoring System
            </Text>

            <View style={[styles.scoringTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {[
                { action: 'Run scored', points: '+1' },
                { action: 'Boundary (4)', points: '+4' },
                { action: 'Six', points: '+6' },
                { action: 'Half Century', points: '+20' },
                { action: 'Century', points: '+50' },
                { action: 'Wicket', points: '+25' },
                { action: 'Maiden Over', points: '+12' },
                { action: 'Catch', points: '+8' },
                { action: 'Stumping', points: '+12' },
                { action: 'Run Out', points: '+6' },
                { action: 'Duck', points: '-5' },
              ].map((item, idx) => (
                <View
                  key={item.action}
                  style={[
                    styles.scoringRow,
                    idx < 10 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}
                >
                  <Text style={[styles.scoringAction, { color: colors.text, fontFamily: 'Inter_400Regular' }]}>
                    {item.action}
                  </Text>
                  <Text
                    style={[
                      styles.scoringPoints,
                      {
                        color: item.points.startsWith('-') ? colors.error : colors.success,
                        fontFamily: 'Inter_700Bold',
                      },
                    ]}
                  >
                    {item.points}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  generateCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
  generateBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addBtnGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codesList: {
    gap: 8,
  },
  codesHeader: {
    fontSize: 13,
    marginBottom: 4,
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  codeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeChipText: {
    fontSize: 18,
    letterSpacing: 4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeText: {
    fontSize: 11,
  },
  comingSoon: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  comingSoonText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  scoringTable: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scoringAction: {
    fontSize: 14,
  },
  scoringPoints: {
    fontSize: 14,
  },
});

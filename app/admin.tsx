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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetch } from 'expo/fetch';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { LinearGradient } from 'expo-linear-gradient';

interface ReferenceCode {
  id: string;
  code: string;
  isActive: boolean;
}

export default function AdminScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [codes, setCodes] = useState<ReferenceCode[]>([]);
  const [newCode, setNewCode] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      const res = await apiRequest('GET', '/api/admin/codes');
      const data = await res.json();
      setCodes(data.codes || []);
    } catch (e) {
      console.error('Failed to load codes:', e);
    }
  };

  const generateCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setNewCode(code);
  };

  const saveCode = async () => {
    if (newCode.length !== 4) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const res = await apiRequest('POST', '/api/admin/codes', { code: newCode });
      const data = await res.json();
      setCodes((prev) => [...prev, data.code]);
      setNewCode('');
    } catch (e) {
      console.error('Failed to save code:', e);
    }
  };

  const deleteCode = async (codeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiRequest('DELETE', `/api/admin/codes/${codeId}`);
      setCodes((prev) => prev.filter((c) => c.id !== codeId));
    } catch (e) {
      console.error('Failed to delete code:', e);
    }
  };

  const syncMatches = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await apiRequest('POST', '/api/admin/sync-matches');
      const data = await res.json();
      setSyncMessage(data.message || 'Matches synced successfully');
    } catch (e: any) {
      setSyncMessage('Failed to sync matches');
      console.error('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
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
              {codes.length > 0 && (
                <Text style={[styles.codesHeader, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Reference Codes ({codes.length})
                </Text>
              )}

              {codes.map((codeObj) => (
                <View
                  key={codeObj.id}
                  style={[styles.codeItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                >
                  <View style={styles.codeItemLeft}>
                    <View style={[styles.codeChip, { backgroundColor: colors.success + '20' }]}>
                      <Text style={[styles.codeChipText, { color: colors.success, fontFamily: 'Inter_700Bold' }]}>
                        {codeObj.code}
                      </Text>
                    </View>
                    <View style={[styles.activeBadge, { backgroundColor: colors.success + '15' }]}>
                      <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.activeText, { color: colors.success, fontFamily: 'Inter_500Medium' }]}>
                        Active
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => deleteCode(codeObj.id)}>
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
              Sync matches from the Cricket API.
            </Text>

            <Pressable
              onPress={syncMatches}
              disabled={isSyncing}
              style={[styles.syncBtn, { opacity: isSyncing ? 0.6 : 1 }]}
            >
              <LinearGradient
                colors={[colors.primary, '#1E40AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.syncBtnGradient}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialCommunityIcons name="sync" size={22} color="#FFF" />
                )}
                <Text style={[styles.syncBtnText, { fontFamily: 'Inter_700Bold' }]}>
                  {isSyncing ? 'Syncing...' : 'Sync Matches'}
                </Text>
              </LinearGradient>
            </Pressable>

            {syncMessage !== '' && (
              <View style={[styles.syncResult, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="information-circle" size={18} color={colors.primary} />
                <Text style={[styles.syncResultText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                  {syncMessage}
                </Text>
              </View>
            )}
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
  syncBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  syncBtnGradient: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
  },
  syncBtnText: {
    fontSize: 16,
    color: '#FFF',
  },
  syncResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncResultText: {
    fontSize: 13,
    flex: 1,
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

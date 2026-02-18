import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

interface PointRow {
  action: string;
  points: string;
}

const battingPoints: PointRow[] = [
  { action: 'Run', points: '+1' },
  { action: 'Boundary Bonus (4s)', points: '+1' },
  { action: 'Six Bonus (6s)', points: '+2' },
  { action: '30 Run Bonus', points: '+4' },
  { action: 'Half Century (50)', points: '+8' },
  { action: 'Century (100)', points: '+16' },
  { action: 'Duck (0 runs, dismissed)', points: '-2' },
];

const bowlingPoints: PointRow[] = [
  { action: 'Wicket (excl. Run Out)', points: '+30' },
  { action: 'LBW / Bowled Bonus', points: '+8' },
  { action: '3 Wicket Bonus', points: '+4' },
  { action: '4 Wicket Bonus', points: '+8' },
  { action: '5 Wicket Bonus', points: '+16' },
  { action: 'Maiden Over', points: '+12' },
];

const fieldingPoints: PointRow[] = [
  { action: 'Catch', points: '+8' },
  { action: '3 Catch Bonus', points: '+4' },
  { action: 'Stumping', points: '+12' },
  { action: 'Run Out (Direct)', points: '+12' },
  { action: 'Run Out (Throw/Indirect)', points: '+6' },
];

const economyPoints: PointRow[] = [
  { action: 'Below 5 RPO (min 2 ov)', points: '+6' },
  { action: '5 - 5.99 RPO', points: '+4' },
  { action: '6 - 7 RPO', points: '+2' },
  { action: '10 - 11 RPO', points: '-2' },
  { action: '11.01 - 12 RPO', points: '-4' },
  { action: 'Above 12 RPO', points: '-6' },
];

const strikeRatePoints: PointRow[] = [
  { action: 'Above 170 SR (min 10 balls)', points: '+6' },
  { action: '150.01 - 170 SR', points: '+4' },
  { action: '130 - 150 SR', points: '+2' },
  { action: '60 - 70 SR', points: '-2' },
  { action: '50 - 59.99 SR', points: '-4' },
  { action: 'Below 50 SR', points: '-6' },
];

const otherPoints: PointRow[] = [
  { action: 'Captain', points: '2x' },
  { action: 'Vice Captain', points: '1.5x' },
];

const steps = [
  { icon: 'calendar-outline' as const, title: 'Select a Match', desc: 'Browse upcoming matches and pick the one you want to play.' },
  { icon: 'people-outline' as const, title: 'Pick 11 Players', desc: 'Select 11 players within the credit limit. Max 10 players from a single team.' },
  { icon: 'star-outline' as const, title: 'Choose C & VC', desc: 'Pick a Captain (2x points) and Vice Captain (1.5x points).' },
  { icon: 'checkmark-circle-outline' as const, title: 'Submit Before Deadline', desc: 'Lock in your team before the match starts. You can create up to 3 teams.' },
];

const teamRules = [
  { role: 'WK', label: 'Wicket-Keepers', range: '1 - 4' },
  { role: 'BAT', label: 'Batsmen', range: '1 - 6' },
  { role: 'AR', label: 'All-Rounders', range: '1 - 4' },
  { role: 'BOWL', label: 'Bowlers', range: '1 - 4' },
];

export default function HowToPlayScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const renderPointsTable = (title: string, data: PointRow[], iconName: string, iconColor: string) => (
    <View style={[styles.pointsCategory, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.pointsCategoryHeader}>
        <View style={[styles.pointsCategoryIcon, { backgroundColor: iconColor + '20' }]}>
          <MaterialCommunityIcons name={iconName as any} size={18} color={iconColor} />
        </View>
        <Text style={[styles.pointsCategoryTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
          {title}
        </Text>
      </View>
      {data.map((row, i) => (
        <View
          key={i}
          style={[
            styles.pointsRow,
            i < data.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
          ]}
        >
          <Text style={[styles.pointsAction, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            {row.action}
          </Text>
          <View style={[styles.pointsBadge, { backgroundColor: row.points.startsWith('-') ? colors.error + '20' : colors.accent + '20' }]}>
            <Text
              style={[
                styles.pointsValue,
                {
                  color: row.points.startsWith('-') ? colors.error : colors.accent,
                  fontFamily: 'Inter_700Bold',
                },
              ]}
            >
              {row.points}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
          How to Play
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16 }}>
          <LinearGradient
            colors={[colors.primary, '#1E40AF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <MaterialCommunityIcons name="cricket" size={40} color="rgba(255,255,255,0.9)" />
            <Text style={[styles.heroTitle, { fontFamily: 'Inter_700Bold' }]}>
              Fantasy Cricket
            </Text>
            <Text style={[styles.heroSubtitle, { fontFamily: 'Inter_400Regular' }]}>
              Pick your dream team, earn points from real match performances, and compete with others!
            </Text>
          </LinearGradient>

          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            Getting Started
          </Text>
          {steps.map((step, i) => (
            <View key={i} style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.stepNumberText, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
                  {i + 1}
                </Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name={step.icon} size={18} color={colors.accent} />
                  <Text style={[styles.stepTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                    {step.title}
                  </Text>
                </View>
                <Text style={[styles.stepDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {step.desc}
                </Text>
              </View>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            Team Rules
          </Text>
          <View style={[styles.rulesCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {teamRules.map((rule, i) => (
              <View
                key={i}
                style={[
                  styles.ruleRow,
                  i < teamRules.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
                ]}
              >
                <View style={styles.ruleLeft}>
                  <View style={[styles.roleBadge, { backgroundColor: colors.accent + '20' }]}>
                    <Text style={[styles.roleBadgeText, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>
                      {rule.role}
                    </Text>
                  </View>
                  <Text style={[styles.ruleLabel, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                    {rule.label}
                  </Text>
                </View>
                <Text style={[styles.ruleRange, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {rule.range}
                </Text>
              </View>
            ))}
            <View style={[styles.ruleFooter, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={styles.ruleFooterItem}>
                <Ionicons name="people" size={16} color={colors.primary} />
                <Text style={[styles.ruleFooterText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Select 11 players per team
                </Text>
              </View>
              <View style={styles.ruleFooterItem}>
                <Ionicons name="shield" size={16} color={colors.error} />
                <Text style={[styles.ruleFooterText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Max 10 players from a single team
                </Text>
              </View>
              <View style={styles.ruleFooterItem}>
                <MaterialCommunityIcons name="cricket" size={16} color={colors.accent} />
                <Text style={[styles.ruleFooterText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Max 3 teams per match
                </Text>
              </View>
              <View style={styles.ruleFooterItem}>
                <Ionicons name="copy" size={16} color={colors.warning} />
                <Text style={[styles.ruleFooterText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  No duplicate teams (same players + same C/VC)
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            Points System (T20)
          </Text>
          <View style={[{ backgroundColor: colors.primary + '10', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.primary + '20' }]}>
            <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 }]}>
              Bonuses are cumulative. e.g. 50 runs = +4 (30 bonus) + +8 (50 bonus) = +12 total bonus on top of run points.
            </Text>
          </View>
          {renderPointsTable('Batting', battingPoints, 'cricket', colors.accent)}
          {renderPointsTable('Bowling', bowlingPoints, 'bowling', colors.primary)}
          {renderPointsTable('Fielding', fieldingPoints, 'hand-back-right', colors.success)}
          {renderPointsTable('Economy Rate', economyPoints, 'speedometer', '#8B5CF6')}
          {renderPointsTable('Strike Rate (Batting)', strikeRatePoints, 'lightning-bolt', '#EC4899')}
          {renderPointsTable('Captain / Vice Captain', otherPoints, 'star-four-points', '#F59E0B')}

          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            Entry Deadline
          </Text>
          <View style={[styles.deadlineCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <LinearGradient
              colors={[colors.error + '15', colors.error + '05']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.deadlineGradient}
            >
              <View style={[styles.deadlineIcon, { backgroundColor: colors.error + '20' }]}>
                <Ionicons name="lock-closed" size={22} color={colors.error} />
              </View>
              <Text style={[styles.deadlineTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                Teams lock 1 second before the match starts
              </Text>
              <Text style={[styles.deadlineDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Make sure to finalize your team before the deadline. Once locked, no changes can be made.
              </Text>
            </LinearGradient>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  heroBanner: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    color: '#FFF',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 15,
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTitle: {
    fontSize: 15,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  rulesCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ruleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
  },
  roleBadgeText: {
    fontSize: 12,
  },
  ruleLabel: {
    fontSize: 14,
  },
  ruleRange: {
    fontSize: 14,
  },
  ruleFooter: {
    padding: 14,
    gap: 10,
  },
  ruleFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleFooterText: {
    fontSize: 13,
  },
  pointsCategory: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  pointsCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pointsCategoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsCategoryTitle: {
    fontSize: 15,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pointsAction: {
    fontSize: 14,
    flex: 1,
  },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: 13,
  },
  deadlineCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  deadlineGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  deadlineIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deadlineTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  deadlineDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});

import { BookOpen, CalendarCheck, ChefHat, Flame, Leaf, Lock, PiggyBank, Snowflake, Sprout, Star, Trophy, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { BadgeIcon, BadgeTier } from '@/domain/achievements';
import { useTheme } from '@/theme/ThemeProvider';

export const BADGE_ICONS: Record<BadgeIcon, LucideIcon> = {
  sprout: Sprout,
  leaf: Leaf,
  trophy: Trophy,
  flame: Flame,
  calendar: CalendarCheck,
  chef: ChefHat,
  book: BookOpen,
  piggy: PiggyBank,
  star: Star,
  snowflake: Snowflake,
};

export const TIER_COLORS: Record<BadgeTier, string> = { bronze: '#C98A4B', argent: '#9AA6AE', or: '#E0A82E' };
export const TIER_LABELS: Record<BadgeTier, string> = { bronze: 'Bronze', argent: 'Argent', or: 'Or' };

/** Médaille ronde : anneau à la couleur du niveau, icône verte ; grisée avec un cadenas tant qu'elle est verrouillée. */
export function BadgeMedal({ icon, tier, unlocked, size = 64 }: { icon: BadgeIcon; tier: BadgeTier; unlocked: boolean; size?: number }) {
  const { colors } = useTheme();
  const Icon = BADGE_ICONS[icon];
  return (
    <View
      style={[
        styles.medal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(3, size / 14),
          borderColor: unlocked ? TIER_COLORS[tier] : colors.border,
          backgroundColor: unlocked ? colors.primarySoft : colors.surface2,
        },
      ]}
    >
      <Icon size={size * 0.44} color={unlocked ? colors.primaryText : colors.textSecondary} strokeWidth={2} />
      {!unlocked && (
        <View style={[styles.lock, { backgroundColor: colors.surface, borderColor: colors.border, width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 }]}>
          <Lock size={size * 0.18} color={colors.textSecondary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  medal: { alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', right: -2, bottom: -2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

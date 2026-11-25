import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { PEPIN_PATHS } from './pepinSvg';

export type PepinMood = 'sourire' | 'joie' | 'clin' | 'oups';

const CHEEK = '#F4A38E';

/**
 * Pépin, la mascotte de Gaspalli : une pomme dessinée au fil vert, dont la ficelle boucle sous la queue.
 * `float` : il flotte doucement (désactivé si le téléphone demande moins d'animations).
 */
export function Pepin({ size = 160, mood = 'sourire', float = false }: { size?: number; mood?: PepinMood; float?: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (!float || reduceMotion) return;
    y.value = withRepeat(
      withSequence(withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })),
      -1,
    );
  }, [float, reduceMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const stroke = { stroke: colors.primary, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const body = PEPIN_PATHS.body;

  return (
    <Animated.View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel="Pépin, la pomme mascotte de Gaspalli">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Path d={body} fill={colors.primarySoft} />
        <Path d={body} {...stroke} />
        <Path d={PEPIN_PATHS.stalk} {...stroke} />
        <Path d={PEPIN_PATHS.leaf} {...stroke} fill={colors.primarySoft} />
        <Path d={PEPIN_PATHS.string} {...stroke} strokeWidth={2.4} />
        {mood === 'joie' ? (
          <>
            <Path d="M46 67Q50 62 54 67M66 67Q70 62 74 67" {...stroke} stroke={colors.text} strokeWidth={2.6} />
            <Path d="M53 75Q60 86 67 75Z" fill={colors.text} />
          </>
        ) : mood === 'oups' ? (
          <>
            <Circle cx={50} cy={65} r={3.4} fill={colors.text} />
            <Circle cx={70} cy={65} r={3.4} fill={colors.text} />
            <Path d="M45 57L53 59M75 57L67 59" {...stroke} stroke={colors.text} strokeWidth={2.2} />
            <Circle cx={60} cy={78} r={3.6} {...stroke} strokeWidth={2.4} />
          </>
        ) : mood === 'clin' ? (
          <>
            <Circle cx={50} cy={66} r={3.2} fill={colors.text} />
            <Path d="M66 67Q70 63 74 67" {...stroke} stroke={colors.text} strokeWidth={2.6} />
            <Path d="M54 76Q60 82 66 76" {...stroke} strokeWidth={2.6} />
          </>
        ) : (
          <>
            <Circle cx={50} cy={66} r={3.2} fill={colors.text} />
            <Circle cx={70} cy={66} r={3.2} fill={colors.text} />
            <Path d="M54 76Q60 82 66 76" {...stroke} strokeWidth={2.6} />
          </>
        )}
        <Circle cx={44} cy={75} r={4} fill={CHEEK} opacity={0.8} />
        <Circle cx={76} cy={75} r={4} fill={CHEEK} opacity={0.8} />
      </Svg>
    </Animated.View>
  );
}

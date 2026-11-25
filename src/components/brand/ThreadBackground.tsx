import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { screenThread } from '@/domain/thread';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Le fil ne se dessine qu'une fois par lancement de l'app, sur le premier écran qui l'affiche. */
let drawnOnce = false;

/**
 * Fond Gaspalli : un liseré vert fin qui boucle derrière tout l'écran.
 * Fixe (il ne défile pas avec le contenu), très pâle, sans effet sur le toucher ni l'accessibilité.
 */
export function ThreadBackground({ variant = 1 }: { variant?: number }) {
  const { colors, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { d, length } = useMemo(() => screenThread(width, height, variant), [width, height, variant]);
  const animate = !drawnOnce && !reduceMotion;
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    drawnOnce = true;
    progress.value = withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) });
  }, [animate, progress]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <AnimatedPath
          d={d}
          fill="none"
          stroke={colors.primary}
          strokeOpacity={scheme === 'dark' ? 0.3 : 0.22}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[length, length]}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

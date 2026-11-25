import { findTimers, formatCountdown } from '@/domain/cookTimers';

describe('minuteurs dans les étapes', () => {
  it.each([
    ['Cuire 25 min à 180 °C.', [[1500, '25 min']]],
    ['Laisser mijoter 1 h 30 à feu doux.', [[5400, '1 h 30']]],
    ['Enfourner 1h environ.', [[3600, '1 h']]],
    ['Cuire 10 à 15 minutes.', [[600, '10 min']]],
    ['Faire bouillir 2 heures.', [[7200, '2 h']]],
    ['Mixer 30 secondes puis reposer 5 mn.', [[30, '30 s'], [300, '5 min']]],
    ['Préchauffer le four à 200 °C.', []],
    ['Ajouter 2 minutes avant la fin.', [[120, '2 min']]],
  ])('%s', (text, expected) => {
    expect(findTimers(text).map((t) => [t.seconds, t.label])).toEqual(expected);
  });

  it('positions pour afficher le bouton dans le texte', () => {
    const [t] = findTimers('Cuire 25 min.');
    expect('Cuire 25 min.'.slice(t!.start, t!.end)).toBe('25 min');
  });

  it('compte à rebours', () => {
    expect(formatCountdown(1500)).toBe('25:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(3725)).toBe('1:02:05');
  });
});

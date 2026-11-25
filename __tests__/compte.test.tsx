import { fireEvent, render, screen } from '@testing-library/react-native';
import { showDialog } from '@/components/ui/Dialog';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `gaspalli://${p}` }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/sync/outbox', () => ({ countLocalOnly: () => 3 }));
jest.mock('@/sync/engine', () => ({
  syncNow: jest.fn(),
  useSyncStatus: () => ({ phase: 'offline', lastSyncAt: null, pending: 2, error: null }),
}));
jest.mock('@/components/ui/Dialog', () => ({ showDialog: jest.fn(), DialogHost: () => null }));
jest.mock('@/services/supabase', () => ({ frenchError: (e: Error) => e.message }));
jest.mock('@/components/ui/Snackbar', () => ({ useSnackbar: () => ({ show: jest.fn() }), SnackbarProvider: ({ children }: { children: unknown }) => children }));

const mockAuth = {
  cloud: true,
  ready: true,
  session: { user: { id: 'u1' } },
  displayName: 'Léa',
  households: [{ id: 'h1', name: 'Chez nous', inviteCode: 'ABCD2345', role: 'admin' }],
  active: { id: 'h1', name: 'Chez nous', inviteCode: 'ABCD2345', role: 'admin' },
  regenerateCode: jest.fn(),
  removeMember: jest.fn(),
  leaveHousehold: jest.fn(),
  setDisplayName: jest.fn(),
  signOut: jest.fn(),
  activate: jest.fn(),
};
jest.mock('@/features/account/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('@/features/account/hooks', () => ({
  useMembers: () => [
    { userId: 'u1', displayName: 'Léa', role: 'admin' },
    { userId: 'u2', displayName: 'Tom', role: 'membre' },
  ],
}));

// eslint-disable-next-line import/first
import Compte from '../app/compte/index';

async function renderScreen() {
  return render(
    <ThemeProvider>
      <Compte />
    </ThemeProvider>,
  );
}

describe('écran Compte et foyer (connecté)', () => {
  it('affiche le foyer, le code, les membres et l’état de la synchro', async () => {
    await renderScreen();
    expect(screen.getByText('Chez nous')).toBeTruthy();
    expect(screen.getByText('ABCD 2345')).toBeTruthy();
    expect(screen.getByText('Léa (toi)')).toBeTruthy();
    expect(screen.getByText('Tom')).toBeTruthy();
    expect(screen.getByText('Hors ligne · 2 modifications en attente')).toBeTruthy();
  });

  it('un admin peut retirer un autre membre (avec confirmation), pas lui-même', async () => {
    const alert = jest.mocked(showDialog);
    await renderScreen();
    expect(screen.queryByLabelText('Retirer Léa du foyer')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Retirer Tom du foyer'));
    expect(alert).toHaveBeenCalledWith('Retirer ce membre ?', expect.stringContaining('Tom'), expect.any(Array));
  });

  it('prévient des modifications non envoyées avant la déconnexion', async () => {
    const alert = jest.mocked(showDialog);
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Se déconnecter'));
    expect(alert).toHaveBeenCalledWith('Se déconnecter ?', expect.stringContaining('2 modification(s)'), expect.any(Array));
  });
});

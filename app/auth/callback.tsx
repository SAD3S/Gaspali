import { Redirect } from 'expo-router';

/**
 * Retour de la connexion Google (gaspalli://auth/callback). La session est récupérée par
 * AuthProvider.signInWithGoogle ; si Android ouvre aussi ce lien, on renvoie simplement vers le compte.
 */
export default function AuthCallback() {
  return <Redirect href="/compte" />;
}

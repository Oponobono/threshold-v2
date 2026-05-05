import { Redirect } from 'expo-router';

/**
 * Punto de entrada inicial de la aplicación (Entry Point).
 * Redirige automáticamente al usuario hacia la pantalla de bienvenida (`/welcome`).
 */
export default function Index() {
  return <Redirect href="/welcome" />;
}

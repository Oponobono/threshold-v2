import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * useColorScheme (web)
 *
 * Versión web del hook `useColorScheme` que resuelve el problema de hidratación
 * en el renderizado estático (SSR/SSG). Durante el renderizado en servidor, el
 * esquema de color no puede determinarse, por lo que se retorna 'light' como valor
 * seguro por defecto. Una vez que el componente se monta en el cliente (`useEffect`),
 * se actualiza al valor real del sistema del usuario.
 * Metro bundler selecciona este archivo automáticamente en plataforma web por su
 * extensión `.web.ts` en lugar del archivo base `use-color-scheme.ts`.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}

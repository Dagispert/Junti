import { router, useLocalSearchParams } from 'expo-router';

import { type LegalKind, LegalView } from '@/components/legal-view';

/** Política de privacidad o condiciones de uso (desde los ajustes). */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: LegalKind }>();
  return (
    <LegalView
      kind={doc === 'condiciones' ? 'condiciones' : 'privacidad'}
      onClose={() => router.back()}
    />
  );
}

import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/constants/theme';

/**
 * Un icono de línea (lucide), siempre con el mismo trazo. Toma el color del
 * texto secundario salvo que se indique otro.
 */
export function Icon({
  icon: Glyph,
  size = 18,
  color,
}: {
  icon: LucideIcon;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return <Glyph size={size} color={color ?? theme.textSecondary} strokeWidth={1.5} />;
}

import type { GroupOrigin, Moment } from '@/data/types';

import { StoryRoll } from './film-roll';

// Fuera de la web, la historia en su carrete de siempre (el diario se anima con CSS 3D).
export function StoryBook(props: { groupId: string; origins: GroupOrigin[]; moments: Moment[] }) {
  return <StoryRoll {...props} />;
}

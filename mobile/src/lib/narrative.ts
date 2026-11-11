// Estilos de la narradora (deben coincidir con los de la base de datos).
export const NARRATIVE_STYLES = [
  { id: 'emotivo', emoji: '💛', label: 'Emotivo', hint: 'Cálido y cercano' },
  { id: 'divertido', emoji: '😄', label: 'Divertido', hint: 'Con humor cariñoso' },
  { id: 'familiar', emoji: '🏡', label: 'Familiar', hint: 'Como una carta de casa' },
  { id: 'romantico', emoji: '🌙', label: 'Romántico', hint: 'Para una pareja a distancia' },
  { id: 'nostalgico', emoji: '📼', label: 'Nostálgico', hint: 'Como un recuerdo de años' },
  { id: 'documental', emoji: '🎙️', label: 'Documental', hint: 'Voz en off de documental' },
  { id: 'ironico', emoji: '😏', label: 'Irónico', hint: 'Seco y con guiño' },
  { id: 'diario', emoji: '📔', label: 'Diario', hint: 'En primera persona, «nosotros»' },
] as const;

export const styleOf = (id: string) =>
  NARRATIVE_STYLES.find((s) => s.id === id) ?? NARRATIVE_STYLES[0];

// Estilos de la narradora (deben coincidir con los de la base de datos).
export const NARRATIVE_STYLES = [
  { id: 'emotivo', label: 'Emotivo', hint: 'Cálido y cercano' },
  { id: 'divertido', label: 'Divertido', hint: 'Con humor cariñoso' },
  { id: 'familiar', label: 'Familiar', hint: 'Como una carta de casa' },
  { id: 'romantico', label: 'Romántico', hint: 'Para una pareja a distancia' },
  { id: 'nostalgico', label: 'Nostálgico', hint: 'Como un recuerdo de años' },
  { id: 'documental', label: 'Documental', hint: 'Voz en off de documental' },
  { id: 'ironico', label: 'Irónico', hint: 'Seco y con guiño' },
  { id: 'diario', label: 'Diario', hint: 'En primera persona, «nosotros»' },
] as const;

export const styleOf = (id: string) =>
  NARRATIVE_STYLES.find((s) => s.id === id) ?? NARRATIVE_STYLES[0];

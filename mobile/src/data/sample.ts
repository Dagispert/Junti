import type { Group, Moment, Proposal, User } from './types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.now();

export const ME = 'diego';

export const users: User[] = [
  {
    id: 'diego',
    name: 'Diego',
    city: 'Valladolid',
    tz: 'Europe/Madrid',
    color: '#D9663F',
  },
  {
    id: 'ana',
    name: 'Ana',
    city: 'Ciudad de México',
    tz: 'America/Mexico_City',
    color: '#4E8D7C',
  },
  {
    id: 'carlos',
    name: 'Carlos',
    city: 'Miami',
    tz: 'America/New_York',
    color: '#5B7DB1',
  },
  {
    id: 'lucia',
    name: 'Lucía',
    city: 'Barcelona',
    tz: 'Europe/Madrid',
    color: '#B8648F',
  },
  {
    id: 'mama',
    name: 'Mamá',
    city: 'Valladolid',
    tz: 'Europe/Madrid',
    color: '#C9A227',
  },
];

export const groups: Group[] = [
  {
    id: 'siempre',
    name: 'Los de siempre',
    description: 'Desde el patio del colegio',
    color: '#D9663F',
    emoji: '🌻',
    memberIds: ['diego', 'ana', 'carlos', 'lucia'],
  },
  {
    id: 'familia',
    name: 'Familia',
    description: 'Los domingos, aunque sea a distancia',
    color: '#4E8D7C',
    emoji: '🏡',
    memberIds: ['diego', 'mama', 'lucia'],
  },
];

export const proposals: Proposal[] = [
  {
    id: 'p-hoy-siempre',
    groupId: 'siempre',
    kind: 'prompt',
    title: 'Enséñanos algo que te haya hecho sonreír hoy',
  },
  {
    id: 'p-hoy-familia',
    groupId: 'familia',
    kind: 'prompt',
    title: '¿Qué estás desayunando?',
  },
  {
    id: 'r-cielo',
    groupId: 'siempre',
    kind: 'challenge',
    title: 'El cielo de cada uno',
    body: 'Una foto del cielo desde donde estés esta semana.',
    endsAt: now + 4 * DAY,
  },
  {
    id: 'r-cancion',
    groupId: 'siempre',
    kind: 'challenge',
    title: 'Una canción que te recuerde al grupo',
    body: 'Cuéntanos por qué.',
    endsAt: now - 20 * DAY,
  },
];

export const challengeLibrary: { title: string; body: string }[] = [
  {
    title: 'Algo de color naranja',
    body: 'Fotografía algo naranja que tengas cerca.',
  },
  {
    title: 'Tu rincón favorito de casa',
    body: 'Ese sitio donde se está mejor que en ningún otro.',
  },
  {
    title: 'El mismo objeto, distintas ciudades',
    body: 'Esta semana: una taza. Cada uno la suya.',
  },
  {
    title: 'Recomienda una película',
    body: 'Una que los demás no hayan visto.',
  },
  { title: 'Algo que nos recuerde a la infancia', body: 'Búscalo y enséñalo.' },
];

let seq = 0;
const m = (
  groupId: string,
  authorId: string,
  ago: number,
  emoji: string,
  color: string,
  text: string,
  extra: Partial<Moment> = {},
): Moment => ({
  id: `m${++seq}`,
  groupId,
  authorId,
  createdAt: now - ago,
  placeholder: { emoji, color },
  text,
  reactions: [],
  comments: [],
  ...extra,
});

export const moments: Moment[] = [
  m('siempre', 'ana', 2 * HOUR, '☕️', '#E9D8C4', 'Empezando el día', {
    reactions: [
      { emoji: '❤️', userId: 'carlos' },
      { emoji: '❤️', userId: 'lucia' },
    ],
    comments: [
      {
        id: 'c1',
        userId: 'lucia',
        text: '¿Esa taza es la que te regalamos?',
        createdAt: now - HOUR,
      },
    ],
  }),
  m('siempre', 'carlos', 9 * HOUR, '🌅', '#F3C9A8', 'Así se ha despedido el día por aquí', {
    proposalId: 'r-cielo',
    reactions: [{ emoji: '😮', userId: 'ana' }],
  }),
  m('siempre', 'lucia', 26 * HOUR, '🌥️', '#C9D6E3', 'Barcelona, nublado pero bonito', {
    proposalId: 'r-cielo',
  }),
  m('siempre', 'diego', 2 * DAY, '💻', '#D8DCCB', 'Tarde larga de trabajo'),
  m('siempre', 'ana', 5 * DAY, '🌮', '#F1D9A7', 'Hay que repetir esto cuando vengáis'),
  m('siempre', 'carlos', 24 * DAY, '🎧', '#CFC6E0', 'La de aquel verano. No digo más.', {
    proposalId: 'r-cancion',
  }),
  m('siempre', 'lucia', 27 * DAY, '📚', '#E3CFC6', 'Por fin lo he terminado. Os lo recomiendo.'),
  m('siempre', 'diego', 45 * DAY, '🚲', '#CBE0D2', 'Domingo por el Pisuerga'),
  m('siempre', 'ana', 70 * DAY, '🏠', '#E6D3B8', '¡Casa nueva!'),
  m('familia', 'mama', 4 * HOUR, '🍲', '#F0D2B6', 'Lentejas. Sobran dos platos.', {
    reactions: [{ emoji: '😂', userId: 'lucia' }],
  }),
  m('familia', 'lucia', 3 * DAY, '🌿', '#CFE3C9', 'La planta sigue viva, que conste'),
];

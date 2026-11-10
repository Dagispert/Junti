// Biblioteca inicial de propuestas y retos. Más adelante vivirá en la tabla
// proposal_library y la elegirá el servidor; por ahora va dentro de la app.

export const dailyPrompts: string[] = [
  '¿Qué estás haciendo ahora mismo?',
  'Enséñanos qué estás desayunando',
  'Comparte una foto del lugar donde estás',
  '¿Qué canción estás escuchando hoy?',
  '¿Qué ha sido lo mejor de tu semana?',
  'Enséñanos algo que te haya hecho sonreír',
  '¿Qué estás leyendo o viendo estos días?',
  'Una foto de tu lugar favorito de la ciudad',
  '¿Qué planes tienes para este fin de semana?',
  'Cuéntanos algo que no nos hayas contado todavía',
  'Enséñanos la vista desde tu ventana',
  '¿Qué has comido hoy?',
  'Algo pequeño que te haya alegrado el día',
  '¿Qué tienes ahora mismo encima de la mesa?',
];

export const challengeLibrary: { title: string; body: string }[] = [
  { title: 'El cielo de cada uno', body: 'Una foto del cielo desde donde estés esta semana.' },
  { title: 'Algo de color naranja', body: 'Fotografía algo naranja que tengas cerca.' },
  {
    title: 'Tu rincón favorito de casa',
    body: 'Ese sitio donde se está mejor que en ningún otro.',
  },
  {
    title: 'El mismo objeto, distintas ciudades',
    body: 'Esta semana: una taza. Cada uno la suya.',
  },
  { title: 'Recomienda una película', body: 'Una que los demás no hayan visto.' },
  { title: 'Algo que nos recuerde a la infancia', body: 'Búscalo y enséñalo.' },
  { title: 'Una canción que te recuerde al grupo', body: 'Cuéntanos por qué.' },
];

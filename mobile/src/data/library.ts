// Ideas de retos para el grupo. (Las propuestas del día viven en la tabla
// proposal_library y las elige el servidor.)

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
  { title: 'Desayunos del mundo', body: 'Un mismo día, el desayuno de cada uno.' },
  { title: 'La vista desde tu ventana', body: 'Cada día de la semana, a la misma hora.' },
  { title: 'Tu calle a las 8 de la tarde', body: 'Misma hora, distintas ciudades.' },
  { title: 'Algo hecho a mano', body: 'Cocinado, dibujado, arreglado… lo que sea.' },
  { title: 'Un paseo de diez minutos', body: 'Sal, camina y enséñanos lo que encuentres.' },
  { title: 'Tres cosas buenas de la semana', body: 'Pequeñas valen igual.' },
  { title: 'El objeto más antiguo de tu casa', body: 'Y su historia, si la tiene.' },
  { title: 'Una foto por color', body: 'Rojo, verde y azul: tres fotos, tres colores.' },
  { title: 'Lo que cabe en tu mano', body: 'Algo pequeño y bonito de hoy.' },
  { title: 'Receta compartida', body: 'Elegimos una receta y cada uno la cocina a su manera.' },
  { title: 'Sonidos de tu ciudad', body: 'Una nota de voz o un vídeo de cómo suena tu calle.' },
  { title: 'Un libro abierto por cualquier página', body: 'Y la frase que te encuentres.' },
  { title: 'Tu yo de hace diez años', body: 'Una foto antigua tuya. Sin vergüenza.' },
  { title: 'El atardecer de cada uno', body: 'Aunque llegue a horas distintas.' },
  { title: 'Algo que te haga sentir en casa', body: 'Estés donde estés.' },
];

/** Frecuencias que se pueden votar y los días de la semana que suponen (1 = lunes … 7 = domingo). */
export const frequencies: { perWeek: number; label: string; days: number[] }[] = [
  { perWeek: 1, label: 'Una vez por semana', days: [3] },
  { perWeek: 2, label: 'Dos veces por semana', days: [2, 5] },
  { perWeek: 3, label: 'Tres veces por semana', days: [1, 3, 5] },
  { perWeek: 5, label: 'De lunes a viernes', days: [1, 2, 3, 4, 5] },
  { perWeek: 7, label: 'Todos los días', days: [1, 2, 3, 4, 5, 6, 7] },
];

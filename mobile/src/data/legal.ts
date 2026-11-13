// Textos legales de Junti: política de privacidad y condiciones de uso.
// Borrador redactado a partir de lo que la app hace de verdad. Antes de abrir
// Junti a personas de fuera conviene que lo revise un profesional.
//
// Quién gestiona Junti y cómo contactar (aparecen en los textos):
export const RESPONSIBLE = 'FuFūStudio';
export const CONTACT = 'fufustudio@gmail.com';
export const UPDATED = '12 de noviembre de 2026';

export type LegalDoc = {
  title: string;
  intro: string;
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
};

export const PRIVACY: LegalDoc = {
  title: 'Política de privacidad',
  intro:
    'Junti es un espacio privado para que grupos pequeños de amigos, familia o pareja compartan su día a día. Tu privacidad no es un añadido: es la base de la app. Aquí te contamos, sin letra pequeña, qué datos usamos, para qué y qué puedes hacer con ellos.',
  sections: [
    {
      heading: 'Quién es responsable',
      paragraphs: [
        `El responsable del tratamiento es ${RESPONSIBLE}. Puedes escribir a ${CONTACT} para cualquier duda o para ejercer tus derechos.`,
      ],
    },
    {
      heading: 'Qué datos usamos',
      bullets: [
        'Tu cuenta: correo electrónico y contraseña (guardada cifrada; nadie puede leerla).',
        'Tu perfil: nombre, foto si la pones, zona horaria y, si quieres, tu ciudad.',
        'Lo que compartes en tus grupos: momentos (fotos, vídeos, notas de voz y textos), reacciones, comentarios, canciones, eventos del calendario y, solo si lo eliges, el lugar de un momento a nivel de ciudad.',
        'Tus preferencias: grupos, frecuencia de propuestas, hora a la que prefieres recibirlas, silencios y horas de descanso.',
        'Avisos: si los activas, el identificador que tu navegador o dispositivo nos da para enviártelos.',
      ],
      paragraphs: [
        'No usamos tu ubicación en segundo plano, no pedimos tu agenda, no hacemos seguimiento publicitario y no vendemos ni cedemos datos a nadie.',
      ],
    },
    {
      heading: 'Para qué',
      bullets: [
        'Darte el servicio: que tus grupos vean lo que compartes y tú lo suyo, y guardar vuestra memoria común. Base legal: el contrato que aceptas al crear tu cuenta.',
        'Enviarte avisos (la propuesta del día, recordatorios y actividad del grupo) solo si los activas. Base legal: tu consentimiento, que puedes retirar cuando quieras.',
        'La narradora con inteligencia artificial, solo si quien administra el grupo la activa (ver más abajo). Base legal: el consentimiento.',
        'Mantener la seguridad y atender denuncias de contenido. Base legal: interés legítimo en que Junti sea un lugar seguro.',
      ],
    },
    {
      heading: 'Quién ve lo que compartes',
      paragraphs: [
        'Solo las personas de cada grupo. No hay perfiles públicos, ni buscador de personas, ni nada visible fuera de tus grupos. Los archivos se guardan en un almacén privado y solo se pueden ver con enlaces temporales a los que únicamente acceden los miembros del grupo.',
      ],
    },
    {
      heading: 'La narradora (inteligencia artificial)',
      paragraphs: [
        'Está apagada por defecto. Si quien administra un grupo la activa, todos los miembros lo ven en los ajustes del grupo. Para escribir y leer en voz alta la crónica de una semana o un mes, se envían a Gemini (Google) los nombres de pila, las ciudades, y los textos, lugares, reacciones, comentarios, canciones y eventos del periodo. Nunca se envían fotos, vídeos, audios ni correos.',
        'Puedes pedir en cualquier momento que tus momentos no se usen: desde ese instante no se envía nada tuyo y se borran las crónicas ya escritas para rehacerlas sin ti.',
        'Junti usa el plan gratuito de Gemini. En ese plan, Google puede revisar y usar lo enviado para mejorar sus servicios y lo trata en servidores fuera de la Unión Europea. Por eso es opcional y se puede apagar.',
      ],
    },
    {
      heading: 'Con quién trabajamos',
      bullets: [
        'Supabase (base de datos, cuentas y almacén de archivos), con los datos alojados en la Unión Europea.',
        'Google (Gemini), solo para la narradora y solo si está activada.',
        'GitHub Pages, que sirve la versión web de la app (no recibe tus datos de Junti).',
        'Servicios de avisos de tu navegador o teléfono (Apple, Google o Mozilla), que reciben el aviso para entregártelo.',
        'Para buscar ciudades y canciones, la app consulta directamente servicios públicos (Open-Meteo y el catálogo de iTunes de Apple) con lo que escribes en el buscador, sin datos de tu cuenta. Para enseñar el tiempo que hace en la ciudad de cada miembro, consulta a Open-Meteo solo con las coordenadas de esa ciudad, sin nombres ni datos de nadie.',
      ],
    },
    {
      heading: 'Cuánto tiempo',
      paragraphs: [
        'Mientras tengas tu cuenta. Si sales de un grupo, eliges si tus momentos se quedan en su memoria o se van contigo. Si borras tu cuenta, se borran tu perfil, tus momentos, tus archivos y todo lo tuyo; no se puede deshacer. Los avisos pendientes se descartan a los pocos días.',
      ],
    },
    {
      heading: 'Tus derechos',
      paragraphs: [
        `Puedes acceder a tus datos, corregirlos, borrarlos, limitar su uso, oponerte y pedir una copia. Casi todo lo puedes hacer tú desde la app (editar tu perfil, borrar momentos, salir de un grupo, borrar tu cuenta); para lo demás, escribe a ${CONTACT}. Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`,
      ],
    },
    {
      heading: 'Menores',
      paragraphs: [
        'Para crear una cuenta hay que tener al menos 14 años. Si eres menor de 14, necesitas que tu madre, padre o tutor dé su consentimiento.',
      ],
    },
    {
      heading: 'Lo que se guarda en tu dispositivo',
      paragraphs: [
        'Solo lo necesario para que la app funcione: tu sesión iniciada y alguna preferencia. No usamos cookies de publicidad ni de analítica.',
      ],
    },
    {
      heading: 'Cambios',
      paragraphs: [
        'Si cambiamos algo importante de esta política te lo diremos en la app antes de que se aplique.',
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Condiciones de uso',
  intro:
    'Estas son las normas para usar Junti. Son pocas y sencillas, porque Junti está pensada para grupos de confianza.',
  sections: [
    {
      heading: 'Qué es Junti',
      paragraphs: [
        `Junti es un servicio gratuito, gestionado por ${RESPONSIBLE}, para que grupos privados compartan su día a día y guarden su memoria común. Al crear tu cuenta aceptas estas condiciones y la política de privacidad.`,
      ],
    },
    {
      heading: 'Tu cuenta',
      bullets: [
        'Tienes que tener al menos 14 años (o el consentimiento de tu madre, padre o tutor).',
        'Cuida tu contraseña: lo que se haga con tu cuenta es responsabilidad tuya.',
        'Puedes borrar tu cuenta cuando quieras desde los ajustes.',
      ],
    },
    {
      heading: 'Lo que compartes es tuyo',
      paragraphs: [
        'Tus fotos, vídeos, audios y textos siguen siendo tuyos. Solo nos das permiso para guardarlos y mostrarlos a las personas de los grupos donde los compartes, y, si el grupo lo activa, para que la narradora los use como se explica en la política de privacidad. Ese permiso termina cuando los borras o borras tu cuenta.',
      ],
    },
    {
      heading: 'Lo que no se permite',
      bullets: [
        'Compartir contenido ilegal, violento, sexual sin consentimiento o que acose, amenace o humille a alguien.',
        'Compartir fotos o datos de otras personas sin su permiso, sobre todo de menores.',
        'Suplantar a nadie o usar Junti para enviar publicidad o engaños.',
        'Intentar acceder a grupos o datos que no son tuyos, o entorpecer el servicio.',
      ],
      paragraphs: [
        'Cualquier persona puede denunciar un momento. Podemos retirar contenido o cerrar cuentas que incumplan estas normas.',
      ],
    },
    {
      heading: 'Administrar un grupo',
      paragraphs: [
        'Quien administra un grupo puede invitar y expulsar personas, cambiar su nombre y frecuencia, y activar o apagar la narradora. Úsalo con el mismo cuidado con que lo harías en persona.',
      ],
    },
    {
      heading: 'El servicio',
      paragraphs: [
        'Junti está en desarrollo y se ofrece tal cual, sin garantía de que funcione siempre sin interrupciones. Hacemos lo posible por no perder nada, pero te recomendamos guardar también tus fotos más importantes. Podemos cambiar o dejar de ofrecer funciones; si algún día Junti cerrara, avisaríamos con tiempo para que puedas guardar lo tuyo.',
        'Las crónicas de la narradora las escribe una inteligencia artificial y pueden contener errores.',
      ],
    },
    {
      heading: 'Cambios y ley aplicable',
      paragraphs: [
        `Si cambiamos estas condiciones te avisaremos en la app. Se rigen por la ley española. Para cualquier cosa, escríbenos a ${CONTACT}.`,
      ],
    },
  ],
};

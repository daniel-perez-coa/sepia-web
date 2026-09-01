export const collections = [
  {
    id: 'zoo',
    tabId: 'tab-zoo',
    accent: '#2fe0b7',
    type: 'SERIES / CURRENT',
    title: 'Zoo capsule',
    description:
      'Una familia de personajes compactos diseñada para crecer por series, colores y pequeñas variaciones.',
    code: 'SERIES_01 / ZOO',
    caption: 'OBJECT FAMILY / FDM',
    process: 'FDM / 0.20',
    status: 'DROP / LIVE',
    skin: 'COBALT / FRESH',
    primary: {
      src: '/assets/series-zoo-scene.png',
      alt: 'Figura azul de la serie Zoo en una escena de exhibición',
    },
    secondary: {
      src: '/assets/series-zoo-studio.png',
      alt: 'Figuras azules de la serie Zoo fotografiadas en estudio',
    },
  },
  {
    id: 'ghost',
    tabId: 'tab-ghost',
    accent: '#ff4f91',
    type: 'DROP / SEASONAL',
    title: 'Ghost drop',
    description:
      'La misma estructura toma una piel nocturna para una edición breve, expresiva y lista para temporada.',
    code: 'DROP_03 / GHOST',
    caption: 'SEASONAL SKIN / SAME SYSTEM',
    process: 'FDM / CAPSULE',
    status: 'LIMITED / DROP',
    skin: 'MAGENTA / NIGHT',
    primary: {
      src: '/assets/drop-ghost-night.png',
      alt: 'Figuras fantasma de SEPIA en una escena nocturna de Halloween',
    },
    secondary: {
      src: '/assets/series-ghost-studio.png',
      alt: 'Figuras fantasma y cápsula fotografiadas sobre fondo blanco',
    },
  },
  {
    id: 'lab',
    tabId: 'tab-object',
    accent: '#ff6a3d',
    type: 'OBJECT / PROTOTYPE',
    title: 'Capsule lab',
    description:
      'Pruebas de forma, cierre, escala y material que convierten una idea suelta en un sistema repetible.',
    code: 'OBJECT_04 / LAB',
    caption: 'BUILD / TEST / REPEAT',
    process: 'PROTOTYPE / QC',
    status: 'STATUS / TEST',
    skin: 'SIGNAL / RAW',
    primary: {
      src: '/assets/series-ghost-studio.png',
      alt: 'Prototipos blancos y cápsula de SEPIA en mesa de estudio',
    },
    secondary: {
      src: '/assets/series-zoo-studio.png',
      alt: 'Variaciones de figuras y cápsulas de la serie Zoo',
    },
  },
];

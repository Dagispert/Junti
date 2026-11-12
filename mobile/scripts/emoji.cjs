// Genera public/emoji/es.json: todos los emojis del sistema, por grupos y con
// sus nombres en español para buscarlos. Se carga solo al abrir el selector.
// Uso: node scripts/emoji.cjs
const fs = require('fs');
const path = require('path');
const data = require('emojibase-data/es/compact.json');
// Solo emojis que ya tienen los móviles de hace un par de años (Unicode 15.1:
// iOS 17.4, Android 14); los más nuevos saldrían como un cuadradito.
const MAX_VERSION = 15.1;
const version = new Map(require('emojibase-data/es/data.json').map((e) => [e.hexcode, e.version]));
const { groups } = require('emojibase-data/es/messages.json');
const out = groups
  .filter((g) => g.key !== 'component')
  .map((g) => ({
    name: g.message.charAt(0).toUpperCase() + g.message.slice(1),
    emojis: data
      .filter(
        (e) => e.group === g.order && e.unicode && (version.get(e.hexcode) ?? 99) <= MAX_VERSION,
      )
      .sort((a, b) => a.order - b.order)
      .map((e) => [e.unicode, [e.label, ...(e.tags ?? [])].join(' ')]),
  }));
const file = path.join(__dirname, '..', 'public', 'emoji', 'es.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(file, fs.statSync(file).size, out.map((g) => g.emojis.length).join(','));

// Genera public/regiones/<id>.json: las provincias (o estados, regiones…) de
// cada país, en TopoJSON (objeto «regiones», con la propiedad «nombre»). Se
// usan en el planeta: las líneas entre provincias al acercarse al país de
// alguien del grupo, y el «modo país» (el país en plano, con sus provincias).
// <id> es el código numérico ISO del país en world-110m.json.
//
// Datos: Natural Earth 10m, «admin 1 states provinces» (dominio público).
// Uso (con mapshaper e i18n-iso-countries instalados aparte):
//   curl -L -o admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
//   mapshaper -i admin1.geojson \
//     -each 'pais = iso_a2 && iso_a2 !== "-1" && iso_a2 !== "-99" ? iso_a2 : adm0_a3; nombre = name_es || name || ""' \
//     -filter-fields pais,nombre -simplify 6% keep-shapes -split pais \
//     -o capas/ format=topojson quantization=20000 singles
//   node scripts/regiones.cjs capas
const fs = require('fs');
const path = require('path');
const countries = require('i18n-iso-countries');

const dir = process.argv[2];
const world = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/world-110m.json'), 'utf8'));
const out = path.join(__dirname, '../public/regiones');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const g of world.objects.countries.geometries) {
  const a2 = countries.numericToAlpha2(g.id);
  const file = a2 && path.join(dir, `${a2}.json`);
  if (!file || !fs.existsSync(file)) continue;
  const topo = JSON.parse(fs.readFileSync(file, 'utf8'));
  const [key] = Object.keys(topo.objects);
  const obj = topo.objects[key];
  // Un país con una sola provincia no aporta nada.
  if (!obj || (obj.geometries ?? []).length < 2) continue;
  topo.objects = { regiones: obj };
  fs.writeFileSync(path.join(out, `${g.id}.json`), JSON.stringify(topo));
  n++;
}
console.log(`${n} países`);

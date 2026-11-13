// Genera public/regiones/<id>.json: las líneas entre provincias (o estados,
// regiones…) de cada país, para dibujarlas en el planeta al acercarse al país
// de cada persona. <id> es el código numérico ISO del país en world-110m.json.
//
// Datos: Natural Earth 10m, «admin 1 states provinces» (dominio público).
// Uso (con mapshaper e i18n-iso-countries instalados aparte):
//   curl -L -o admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
//   mapshaper -i admin1.geojson -each 'pais = iso_a2 && iso_a2 !== "-1" && iso_a2 !== "-99" ? iso_a2 : adm0_a3' \
//     -filter-fields pais -simplify 6% keep-shapes -split pais -innerlines -o capas/ format=geojson precision=0.001
//   node scripts/regiones.cjs capas
const fs = require('fs');
const path = require('path');
const countries = require('i18n-iso-countries');

const dir = process.argv[2];
const world = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../public/world-110m.json'), 'utf8'),
);
const out = path.join(__dirname, '../public/regiones');
fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const g of world.objects.countries.geometries) {
  const a2 = countries.numericToAlpha2(g.id);
  const file = a2 && path.join(dir, `${a2}.json`);
  if (!file || !fs.existsSync(file)) continue;
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const geoms = (d.geometries || (d.features || []).map((x) => x.geometry)).filter(Boolean);
  const coordinates = geoms.flatMap((gm) =>
    gm.type === 'LineString'
      ? [gm.coordinates]
      : gm.type === 'MultiLineString'
        ? gm.coordinates
        : [],
  );
  if (!coordinates.length) continue;
  fs.writeFileSync(
    path.join(out, `${g.id}.json`),
    JSON.stringify({ type: 'MultiLineString', coordinates }),
  );
  n++;
}
console.log(`${n} países`);

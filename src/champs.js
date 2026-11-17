/**
 * Champion names and icons. Icons come from Riot's Data Dragon CDN at runtime (nothing is bundled);
 * offline, tiles fall back to initials. Names in the GRID data match Data Dragon's display names.
 */
let dd = null;

export async function loadDataDragon() {
  try {
    const versions = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
    const v = versions[0];
    const data = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`)).json()).data;
    const byName = new Map(Object.values(data).map((c) => [norm(c.name), c.id]));
    dd = { v, byName, names: Object.values(data).map((c) => c.name) };
  } catch {
    dd = null;
  }
  return dd;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

export function iconUrl(name) {
  if (!dd) return null;
  const id = dd.byName.get(norm(name));
  return id ? `https://ddragon.leagueoflegends.com/cdn/${dd.v}/img/champion/${id}.png` : null;
}

/** All champion names: Data Dragon's list plus any name seen in the loaded index (new champions). */
export function allChampions(seen = []) {
  const set = new Set([...(dd?.names ?? []), ...seen]);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function champTile(name, { size = 44, cls = '' } = {}) {
  const url = iconUrl(name);
  const ini = name.replace(/[^A-Za-z]/g, '').slice(0, 2);
  return url
    ? `<img class="ic ${cls}" src="${url}" alt="${name}" title="${name}" width="${size}" height="${size}" loading="lazy">`
    : `<span class="ic ini ${cls}" title="${name}" style="width:${size}px;height:${size}px">${ini}</span>`;
}

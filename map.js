/* Neighborhood map for Pets of Seattle.
   ZIP shapes: data/seattle-zips.json (US Census ZCTAs trimmed to Seattle's city limits and shoreline, 2020 population).
   Uses globals from the main page script: ALL, NAME_INDEX, state, countBy, hood, esc, fmt, PLURAL, setZip, checkName, track. */
const MAP = { geo: null, stats: null, view: 'lean', sel: null };
fetch('data/seattle-zips.json').then(r => r.json()).then(g => { MAP.geo = g; if (ALL.length) renderMap(); }).catch(() => { $('mapBlock').hidden = true; });
const mapZip = z => (MAP.geo && MAP.geo.merge[z]) || z;
const isDark = () => document.documentElement.dataset.theme === 'dark' ||
  (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

// OKLab blending so color ramps step evenly
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const delin = c => c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055;
function toLab(h) {
  const [r, g, b] = hex2rgb(h).map(lin);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
function fromLab([L, A, B]) {
  const l = (L + .3963377774 * A + .2158037573 * B) ** 3, m = (L - .1055613458 * A - .0638541728 * B) ** 3, s = (L - .0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map(c => Math.round(Math.min(1, Math.max(0, delin(c))) * 255).toString(16).padStart(2, '0')).join('');
}
const mix = (a, b, t) => { const x = toLab(a), y = toLab(b); return fromLab(x.map((v, i) => v + (y[i] - v) * t)); };
const lumOf = h => { const [r, g, b] = hex2rgb(h).map(lin); return .2126 * r + .7152 * g + .0722 * b; };
const inkOn = h => lumOf(h) > .3 ? '#18211d' : '#ffffff';

function mapPalette() {
  const dark = isDark();
  const N = dark ? '#3a3b37' : '#e3e1da';                       // diverging midpoint: neutral gray, a step darker than the page so land reads against water
  const dogMid = dark ? '#3987e5' : '#2a78d6', dogEnd = dark ? '#86b6ef' : '#1c5cab';
  const catMid = dark ? '#d95926' : '#eb6834', catEnd = dark ? '#ec835a' : '#b8461a';
  return {
    land: dark ? '#2c312d' : '#dcd9cf',
    // cat arm (3) · neutral · dog arm (3)
    lean: [catEnd, mix(N, catMid, .72), mix(N, catMid, .38), N, mix(N, dogMid, .38), mix(N, dogMid, .72), dogEnd],
    // one hue, light -> dark (dark mode: near-surface -> bright)
    rate: [.12, .32, .52, .72, .92].map(t => dark ? mix('#2c3a33', '#8fe0b8', t) : mix('#e4f2eb', '#0b5137', t)),
    breedHue: dark ? '#8fe0b8' : '#1baf7a', nameHue: dark ? '#86b6ef' : '#2a78d6',
    hatch: dark ? '#59605a' : '#c9c5b8'
  };
}

// citywide tallies per map ZIP, computed once
function mapStats() {
  if (MAP.stats) return MAP.stats;
  const st = {};
  for (const z in MAP.geo.zips) st[z] = { rows: [], Dog: 0, Cat: 0 };
  for (const r of ALL) { const o = st[mapZip(r.z)]; if (!o) continue; o.rows.push(r); if (r.s === 'Dog') o.Dog++; else if (r.s === 'Cat') o.Cat++; }
  return MAP.stats = st;
}
function zipFacts(z, sp) {
  const o = mapStats()[z], g = MAP.geo.zips[z];
  const rows = sp === 'All' ? o.rows : o.rows.filter(r => r.s === sp);
  const dc = o.Dog + o.Cat, partial = g.share < .8;
  const rate = g.popInCity >= 2000 && !partial ? rows.length / g.popInCity * 1000 : null;
  const names = [...countBy(rows, r => r.nk).entries()].filter(e => e[0]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = names[0] && names[0][1] >= 2 ? { name: NAME_INDEX.get(names[0][0]).display, n: names[0][1] } : null;
  return { z, rows, n: rows.length, dogShare: dc >= 30 ? o.Dog / dc : null, rate, partial, top };
}
// the breed that's unusually common here compared with all of Seattle
const GENERIC_BREED = /mix|domestic|shorthair|longhair|medium hair|^terrier$|unknown|other/i;
const breedCache = {};
function signatureBreed(z, sp) {
  const bsp = sp === 'Cat' ? 'Cat' : 'Dog', key = z + bsp;
  if (key in breedCache) return breedCache[key];
  const city = ALL.filter(r => r.s === bsp), here = mapStats()[z].rows.filter(r => r.s === bsp);
  let best = null;
  if (here.length >= 150) {
    const cc = countBy(city, r => r.b), hc = countBy(here, r => r.b);
    for (const [b, c] of hc) {
      const cityN = cc.get(b) || 0;
      if (c < 10 || GENERIC_BREED.test(b) || cityN < 60) continue;
      // rank by how far above expectation the count is (a z-score), so a handful of rare dogs can't win
      const expected = here.length * cityN / city.length, lift = c / expected, score = (c - expected) / Math.sqrt(expected);
      if (lift >= 1.4 && (!best || score > best.score)) best = { breed: b, n: c, lift, score, sp: bsp };
    }
  }
  return breedCache[key] = best;
}

function renderMap() {
  if (!MAP.geo || !ALL.length) return;
  const geo = MAP.geo, P = mapPalette(), sp = state.species, view = MAP.view;
  const facts = Object.keys(geo.zips).map(z => zipFacts(z, sp));
  const byZ = Object.fromEntries(facts.map(f => [f.z, f]));
  const cityDog = ALL.filter(r => r.s === 'Dog').length, cityCat = ALL.filter(r => r.s === 'Cat').length;
  const avg = cityDog / (cityDog + cityCat);
  const maxDev = Math.max(.05, ...facts.filter(f => f.dogShare != null).map(f => Math.abs(f.dogShare - avg)));
  const rates = facts.map(f => f.rate).filter(v => v != null).sort((a, b) => a - b);
  const q = p => rates[Math.min(rates.length - 1, Math.floor(p * rates.length))];
  const rateCuts = [q(.2), q(.4), q(.6), q(.8)];
  const breeds = Object.fromEntries(facts.map(f => [f.z, view === 'breed' ? signatureBreed(f.z, sp) : null]));
  const noun = sp === 'All' ? 'pets' : PLURAL[sp].toLowerCase();

  const fillFor = f => {
    if (view === 'lean') {
      if (f.dogShare == null) return P.land;
      const i = Math.round(Math.max(-1, Math.min(1, (f.dogShare - avg) / maxDev)) * 3);
      return P.lean[i + 3];
    }
    if (view === 'rate') { if (f.rate == null) return 'url(#mapHatch)'; let i = 0; while (i < 4 && f.rate > rateCuts[i]) i++; return P.rate[i]; }
    if (view === 'breed') { const b = breeds[f.z]; return b ? mix(P.land, P.breedHue, Math.min(.7, .18 + (b.lift - 1.4) / 4)) : P.land; }
    return f.top ? mix(P.land, P.nameHue, .16) : P.land;
  };
  const lineFor = f => {
    if (view === 'lean') return f.dogShare == null ? 'Too few dogs and cats to compare' : `${Math.round(f.dogShare * 100)}% dogs, ${Math.round((1 - f.dogShare) * 100)}% cats`;
    if (view === 'rate') return f.rate == null ? (f.partial ? 'Mostly outside Seattle, so no rate' : 'Too few residents for a rate') : `<b>${Math.round(f.rate)}</b> licensed ${noun} per 1,000 residents`;
    if (view === 'name') return f.top ? `Top name: <b>${esc(f.top.name)}</b> (${fmt(f.top.n)})` : 'No repeat names yet';
    const b = breeds[f.z]; return b ? `<b>${esc(b.breed)}</b>, ${b.lift.toFixed(1)}× the city rate` : 'No standout breed';
  };
  const tipFor = f => `<b>${f.z}</b>${hood(f.z) ? ' · ' + esc(hood(f.z)) : ''}<div>${lineFor(f)}</div><div style="opacity:.75">${fmt(f.n)} licensed ${noun}${f.partial ? ' in the Seattle part' : ''}</div>`;
  const plain = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const labelFor = f => view === 'name' ? (f.top ? f.top.name : '') : view === 'breed' ? (breeds[f.z] ? breeds[f.z].breed : '') : '';
  const wrap = t => { const lines = ['']; for (const w of t.split(' ')) { const next = (lines.at(-1) + ' ' + w).trim(); if (next.length > 11 && lines.at(-1)) lines.push(w); else lines[lines.length - 1] = next; } return lines; };

  const svg = $('cityMap');
  svg.setAttribute('viewBox', `0 0 ${geo.w} ${geo.h}`);
  const paths = facts.map(f => {
    const g = geo.zips[f.z], sel = state.zip && mapZip(state.zip) === f.z;
    return `<path class="zip${sel ? ' sel' : ''}${MAP.sel === f.z ? ' focus' : ''}" d="${g.d}" fill="${fillFor(f)}" data-z="${f.z}" data-tip="${esc(tipFor(f))}" tabindex="0" role="button" aria-label="${esc(f.z + ' ' + (hood(f.z) || '') + ': ' + plain(lineFor(f)))}"></path>`;
  }).join('');
  const labels = (view === 'name' || view === 'breed') ? facts.map(f => {
    const g = geo.zips[f.z], t = labelFor(f);
    if (!t || g.areaU < (view === 'breed' ? 24000 : 14000)) return '';
    const fs = Math.max(26, Math.min(view === 'breed' ? 36 : 44, Math.sqrt(g.areaU) / (view === 'breed' ? 7 : 6))), fill = fillFor(f);
    let ls = view === 'breed' ? wrap(t) : [t];
    if (ls.length > 2 && t.split(' ').length > 3) ls = wrap(t.split(' ').slice(-1)[0]);   // "Miniature Smooth Haired Dachshund" -> "Dachshund" on the map; full name in the tooltip
    const y0 = g.ly - (ls.length - 1) * fs * .54;
    return `<text class="zip-lab" x="${g.lx}" y="${y0.toFixed(1)}" font-size="${fs.toFixed(0)}" fill="${inkOn(fill)}">${ls.map((l, i) => `<tspan x="${g.lx}" dy="${i ? (fs * 1.08).toFixed(1) : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  }).join('') : '';
  svg.innerHTML = `<defs><pattern id="mapHatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="${P.land}"/><line x1="0" y1="0" x2="0" y2="16" stroke="${P.hatch}" stroke-width="5"/></pattern></defs>
    <path class="city-outline" d="${geo.outline}" fill="${P.land}"/>${paths}<g aria-hidden="true">${labels}</g>`;
  svg.querySelectorAll('.zip').forEach(p => {
    p.addEventListener('click', () => selectMapZip(p.dataset.z));
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMapZip(p.dataset.z, true); } });
  });

  $('mapView').querySelectorAll('button').forEach(b => { const on = b.dataset.v === view; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });

  // legend
  const sw = (bg, l) => `<span class="lg-item"><span class="lg-sw" style="background:${bg}"></span>${l}</span>`;
  let lg;
  if (view === 'lean') lg = `<div class="lg-ramp">${P.lean.map(c => `<span style="background:${c}"></span>`).join('')}</div>
    <div class="lg-ends"><span>More cats</span><span>City average · ${Math.round(avg * 100)}% dogs</span><span>More dogs</span></div>`;
  else if (view === 'rate') {
    const e = [rates[0], ...rateCuts, rates.at(-1)].map(v => Math.round(v));
    lg = `<div class="lg-row">${P.rate.map((c, i) => sw(c, `${e[i]}–${e[i + 1]}`)).join('')}${sw(`repeating-linear-gradient(45deg, ${P.land} 0 4px, ${P.hatch} 4px 7px)`, 'Mostly outside Seattle')}</div>
      <div class="lg-cap">Licensed ${noun} per 1,000 residents (2020 Census population)</div>`;
  } else if (view === 'name') {
    const wins = countBy(facts.filter(f => f.top), f => f.top.name), [leader, lw] = [...wins.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    lg = `<div class="lg-cap">${leader ? `<b>${esc(leader)}</b> is the top ${sp === 'All' ? 'pet' : sp.toLowerCase()} name in ${lw} of ${facts.length} neighborhoods. ` : ''}Tap a neighborhood for its top five.</div>`;
  }
  else lg = `<div class="lg-cap">The ${sp === 'Cat' ? 'cat' : 'dog'} breed most over-represented in each neighborhood compared with all of Seattle. Darker green means more unusual.</div>`;
  $('mapLegend').innerHTML = lg;

  // ranked list for this view (doubles as a text alternative to the map)
  let list, title;
  const big = facts.filter(f => f.n >= 60);
  if (view === 'lean') {
    const s = big.filter(f => f.dogShare != null).sort((a, b) => b.dogShare - a.dogShare);
    title = 'Most dog-loving and most cat-loving';
    list = [...s.slice(0, 3), ...s.slice(-3).reverse()].map(f => [f, `${Math.round(f.dogShare * 100)}% dogs`]);
  } else if (view === 'rate') {
    title = `Most licensed ${noun} per resident`;
    list = facts.filter(f => f.rate != null).sort((a, b) => b.rate - a.rate).slice(0, 6).map(f => [f, `${Math.round(f.rate)} per 1,000`]);
  } else if (view === 'name') {
    title = 'Top name in the biggest pet neighborhoods';
    list = big.filter(f => f.top).sort((a, b) => b.n - a.n).slice(0, 6).map(f => [f, `${esc(f.top.name)} · ${fmt(f.top.n)}`]);
  } else {
    title = `Most distinctive ${sp === 'Cat' ? 'cat' : 'dog'} breeds`;
    list = facts.filter(f => breeds[f.z]).sort((a, b) => breeds[b.z].lift - breeds[a.z].lift).slice(0, 6).map(f => [f, `${esc(breeds[f.z].breed)} · ${breeds[f.z].lift.toFixed(1)}×`]);
  }
  $('mapRankTitle').textContent = title;
  $('mapList').innerHTML = list.map(([f, v]) => `<li><button type="button" data-z="${f.z}"><span class="ml-z">${f.z}</span><span class="ml-h">${esc(hood(f.z) || '')}</span><span class="ml-v">${v}</span></button></li>`).join('');
  $('mapList').querySelectorAll('button').forEach(b => b.onclick = () => selectMapZip(b.dataset.z));
  renderMapDetail(byZ, avg, noun);
}

function renderMapDetail(byZ, avg, noun) {
  const el = $('mapDetail');
  const z = MAP.sel || (state.zip && byZ[mapZip(state.zip)] ? mapZip(state.zip) : null);
  if (!z) {
    el.innerHTML = `<p class="md-kicker">Explore the map</p><h3>Seattle, neighborhood by neighborhood</h3>
      <p class="md-p">Each shape is a ZIP code. Hover or tap one to see its pets, its top names and its signature breed, then filter the whole page to it.</p>`;
    return;
  }
  const f = byZ[z], b = signatureBreed(z, state.species);
  const names = [...countBy(f.rows, r => r.nk).entries()].filter(e => e[0]).sort((a, c) => c[1] - a[1]).slice(0, 5);
  const filtered = state.zip && mapZip(state.zip) === z;
  el.innerHTML = `<p class="md-kicker">${z}${f.partial ? ' · Seattle part only' : ''}</p>
    <h3>${esc(hood(z) || 'Seattle')}</h3>
    <div class="md-stats">
      <div><b>${fmt(f.n)}</b><span>licensed ${noun}</span></div>
      <div><b>${f.dogShare == null ? '–' : Math.round(f.dogShare * 100) + '%'}</b><span>dogs (city: ${Math.round(avg * 100)}%)</span></div>
      <div><b>${f.rate == null ? '–' : Math.round(f.rate)}</b><span>per 1,000 residents</span></div>
    </div>
    ${names.length ? `<p class="md-lbl">Top names</p><div class="taglist">${names.map(([k, c]) => `<button class="chip" data-n="${esc(NAME_INDEX.get(k).display)}">${esc(NAME_INDEX.get(k).display)} <b>${fmt(c)}</b></button>`).join('')}</div>` : ''}
    ${b ? `<p class="md-lbl">Signature ${b.sp.toLowerCase()} breed</p><p class="md-p"><b>${esc(b.breed)}</b> is ${b.lift.toFixed(1)}× as common here as across Seattle (${fmt(b.n)} ${b.n === 1 ? b.sp.toLowerCase() : PLURAL[b.sp].toLowerCase()}).</p>` : ''}
    <div class="md-actions">
      <button class="checkbtn" id="mdFilter">${filtered ? 'Show all of Seattle' : `Filter the page to ${z}`}</button>
      ${MAP.sel ? '<button class="linkbtn" id="mdClose">Close</button>' : ''}
    </div>`;
  el.querySelectorAll('[data-n]').forEach(c => c.onclick = () => checkName(c.dataset.n));
  $('mdFilter').onclick = () => { track('map-filter'); MAP.sel = null; setZip(filtered ? '' : z); };
  if ($('mdClose')) $('mdClose').onclick = () => { MAP.sel = null; renderMap(); };
}
function selectMapZip(z, fromKey) {
  MAP.sel = MAP.sel === z ? null : z;
  track('map-select');
  renderMap();
  if (fromKey) { const p = $('cityMap').querySelector(`.zip[data-z="${z}"]`); if (p) p.focus(); }
  if (MAP.sel && matchMedia('(max-width: 860px)').matches) $('mapDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('mapView').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; MAP.view = b.dataset.v; track('map-view-' + MAP.view); renderMap(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderMap());

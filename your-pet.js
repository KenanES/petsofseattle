/* Your pet page: how rare is your pet? */
const API = 'https://data.seattle.gov/resource/jguv-t9rb.json?$limit=100000&$select=animal_s_name,species,primary_breed,zip_code';
const SPECIES = ['Dog', 'Cat', 'Goat', 'Pig'];
const PLURAL = { Dog: 'Dogs', Cat: 'Cats', Goat: 'Goats', Pig: 'Pigs' };
const HOODS = {
  '98101':'Downtown','98102':'Eastlake / Capitol Hill','98103':'Fremont / Wallingford / Green Lake','98104':'Pioneer Square / ID',
  '98105':'U District / Laurelhurst','98106':'Delridge / Highland Park','98107':'Ballard','98108':'Georgetown / South Beacon Hill',
  '98109':'Queen Anne / South Lake Union','98112':'Montlake / Madison Park','98115':'Wedgwood / Ravenna / View Ridge','98116':'Alki / West Seattle',
  '98117':'Crown Hill / North Ballard','98118':'Columbia City / Rainier Valley','98119':'Upper Queen Anne / Interbay','98121':'Belltown',
  '98122':'Central District / Capitol Hill','98125':'Lake City / Northgate','98126':'High Point / West Seattle','98133':'Bitter Lake / Broadview',
  '98134':'SoDo','98136':'Fauntleroy / Morgan Junction','98144':'Mount Baker / Beacon Hill','98146':'White Center','98154':'Downtown',
  '98155':'Shoreline / Lake Forest Park','98164':'Downtown','98168':'Tukwila / Boulevard Park','98177':'Richmond Beach / Shoreline',
  '98178':'Rainier Beach / Skyway','98188':'SeaTac','98195':'University of Washington','98199':'Magnolia'
};

const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('en-US');
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '0%';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const hood = z => HOODS[z] || '';
const zipLabel = z => z ? (hood(z) ? `${z} · ${hood(z)}` : z) : 'Unknown ZIP';

// "Retriever, Labrador" -> "Labrador Retriever"
function cleanBreed(b) {
  if (!b) return '';
  b = b.trim();
  const mixed = b.match(/^Mixed Breed,\s*(\w+)/i);
  if (mixed) return `Mixed breed (${mixed[1].toLowerCase()})`;
  if (/^mix$/i.test(b)) return 'Mixed breed';
  return b.split(',').map(s => s.trim()).reverse().join(' ');
}
function titleName(n) {
  n = n.trim();
  return n === n.toUpperCase() || n === n.toLowerCase() ? n.toLowerCase().replace(/(^|[\s\-'])\S/g, c => c.toUpperCase()) : n;
}


let ALL = [];
function countBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (k == null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
const noun = (sp, n) => sp === 'All' ? (n === 1 ? 'pet' : 'pets') : (n === 1 ? sp.toLowerCase() : PLURAL[sp].toLowerCase());

// ---------- how rare is your pet ----------
function rareTier(n) {
  if (n === 0) return ['None on record', 'Yours would be the first one in the license data.'];
  if (n === 1) return ['One of a kind', 'There may be no other pet quite like yours here.'];
  if (n < 10) return ['Rare', 'Only a handful of twins around town.'];
  if (n < 50) return ['Uncommon', 'A few twins around town.'];
  if (n < 250) return ['Common', 'Plenty of lookalikes around town.'];
  return ['Very common', 'One of the most familiar combinations in Seattle.'];
}
function fillSelect(el, opts, keep) {
  el.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (keep != null && opts.some(o => o[0] === keep)) el.value = keep;
}
function renderBreedOptions(keep) {
  const sp = $('spSel').value;
  const rows = sp === 'All' ? ALL : ALL.filter(r => r.s === sp);
  const breeds = [...countBy(rows, r => r.b).entries()].sort((a, b) => b[1] - a[1]);
  fillSelect($('breedSel'), [['', 'Any breed'], ...breeds.map(([b, c]) => [b, `${b} (${fmt(c)})`])], keep);
}
function renderRare() {
  const sp = $('spSel').value, br = $('breedSel').value, z = $('zipSel2').value;
  const n = ALL.filter(r => (sp === 'All' || r.s === sp) && (!br || r.b === br) && (!z || r.z === z)).length;
  const [label, flavor] = rareTier(n);
  $('rareNum').textContent = fmt(n);
  const what = br ? `${esc(br)} ${noun(sp, n)}` : (sp === 'All' ? noun('All', n) : noun(sp, n));
  $('rareWhat').innerHTML = `${what} in ${z ? esc(zipLabel(z)) : 'all of Seattle'}`;
  $('rareBadge').textContent = label;
  $('rareBadge').dataset.tier = label.toLowerCase().replace(/\s+/g, '-');
  $('rareOdds').innerHTML = n ? `roughly <b>1 in ${fmt(Math.round(ALL.length / n))}</b> licensed Seattle pets` : 'not one among Seattle\'s licensed pets';
  $('rareFlavor').textContent = flavor;
  const q = new URLSearchParams(location.search);
  ['sp', 'breed', 'zip'].forEach(k => q.delete(k));
  if (sp !== 'Dog') q.set('sp', sp); if (br) q.set('breed', br); if (z) q.set('zip', z);
  history.replaceState(null, '', '?' + q.toString() + location.hash);
}
function setupRare() {
  const q = new URLSearchParams(location.search);
  const sps = countBy(ALL, r => r.s);
  fillSelect($('spSel'), [['All', 'Any pet'], ...SPECIES.filter(s => sps.get(s)).map(s => [s, `${PLURAL[s]} (${fmt(sps.get(s))})`])], q.get('sp') || 'Dog');
  renderBreedOptions(q.get('breed') ?? 'Labrador Retriever');
  const zips = [...countBy(ALL, r => r.z).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  fillSelect($('zipSel2'), [['', 'All of Seattle'], ...zips.map(([z]) => [z, zipLabel(z)])], q.get('zip') || '');
  $('rareNote').textContent = `Counted across all ${fmt(ALL.length)} licensed Seattle pets. Exact counts, not estimates.`;
  $('spSel').onchange = () => { renderBreedOptions(''); renderRare(); };
  $('breedSel').onchange = () => { track('yp-rarity'); renderRare(); };
  $('zipSel2').onchange = renderRare;
  renderRare();
}

// ---------- look up any name ----------
function bars(items, max) {
  return `<div class="mini-bars">${items.map(([k, c]) => `<div class="mb"><span class="k">${esc(k)}</span><span class="c">${fmt(c)}</span><span class="t"><span style="width:${Math.max(2, c / max * 100)}%"></span></span></div>`).join('')}</div>`;
}
function lookup(name) {
  name = (name || '').trim();
  if (!name) return;
  track('yp-name-lookup');
  $('lookInput').value = name;
  const key = name.toLowerCase();
  const rows = ALL.filter(r => r.nk === key);
  const display = rows[0] ? rows[0].n : titleName(name);
  const q = new URLSearchParams(location.search); q.set('name', display);
  history.replaceState(null, '', '?' + q.toString() + '#lookup');
  if (!rows.length) {
    $('lookCard').innerHTML = `<h3>${esc(display)}</h3><p class="sum">No licensed pet in Seattle is named ${esc(display)} yet. Yours would be the first.</p>
      <a class="linkbtn" href="adopt">Find a pet that needs a name →</a>`;
    return;
  }
  const sp = countBy(rows, r => r.s);
  const parts = SPECIES.filter(s => sp.get(s)).map(s => `${fmt(sp.get(s))} ${noun(s, sp.get(s))}`);
  const breeds = [...countBy(rows, r => r.b).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const zips = [...countBy(rows, r => r.z).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([z, c]) => [hood(z) || z, c]);
  const rank = [...countBy(ALL, r => r.nk).values()].filter(c => c > rows.length).length + 1;
  $('lookCard').innerHTML = `<h3>${esc(display)}</h3>
    <p class="sum">There ${rows.length === 1 ? 'is' : 'are'} <b>${fmt(rows.length)}</b> licensed ${noun('All', rows.length)} named ${esc(display)} in Seattle${parts.length > 1 ? ': ' + parts.join(', ') : ''}. That ranks <b>#${fmt(rank)}</b> among ${fmt(new Set(ALL.map(r => r.nk).filter(Boolean)).size)} names.</p>
    <div class="cols">
      <div><h4>Top breeds</h4>${bars(breeds, breeds[0][1])}</div>
      <div><h4>Where they live</h4>${bars(zips, zips[0][1])}</div>
    </div>
    <div class="links"><a class="linkbtn" href="adopt">Find adoptable pets →</a><a class="linkbtn" href="./?name=${encodeURIComponent(display)}">See how ${esc(display)} ranks on the main page →</a></div>`;
}
function setupLookup() {
  const counts = [...countBy(ALL, r => r.nk).entries()].sort((a, b) => b[1] - a[1]);
  const disp = new Map(ALL.map(r => [r.nk, r.n]));
  $('lookList').innerHTML = counts.slice(0, 400).map(([k]) => `<option value="${esc(disp.get(k))}">`).join('');
  const tries = ['Luna', 'Mochi', 'Rainier', 'Pickles', 'Kevin'];
  $('lookTry').innerHTML = 'Try: ' + tries.map(t => `<button type="button" class="chip" data-n="${t}">${t}</button>`).join('');
  $('lookTry').querySelectorAll('.chip').forEach(b => b.onclick = () => lookup(b.dataset.n));
  $('lookForm').onsubmit = e => { e.preventDefault(); lookup($('lookInput').value); };
  const q = new URLSearchParams(location.search).get('name');
  if (q) lookup(q.slice(0, 60));
}

async function load() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    ALL = (await res.json()).map(r => {
      const n = r.animal_s_name ? titleName(r.animal_s_name) : '';
      return { n, nk: n.toLowerCase(), s: SPECIES.includes(r.species) ? r.species : 'Dog', b: cleanBreed(r.primary_breed), z: (r.zip_code || '').slice(0, 5) };
    });
    setupRare(); setupLookup();
    if (location.hash === '#lookup') $('lookup').scrollIntoView();
  } catch (e) {
    $('rareNote').innerHTML = `Couldn't reach Seattle's open data portal (${esc(e.message)}). <a class="linkbtn" href="">Try again</a>`;
    $('rareNum').textContent = '–';
  }
}
load();
$('rareForm').addEventListener('submit', e => e.preventDefault());

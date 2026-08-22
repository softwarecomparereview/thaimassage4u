#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cities } from './cities.mjs';

const APPLY = process.argv.includes('--apply');
const MAX_PAGES = Number(process.env.FRESHA_MAX_PAGES || 15);
const PROFILE_CONCURRENCY = Number(process.env.FRESHA_PROFILE_CONCURRENCY || 6);
const HIGH_CONFIDENCE = Number(process.env.FRESHA_MATCH_THRESHOLD || 0.78);
const REVIEW_THRESHOLD = Number(process.env.FRESHA_REVIEW_THRESHOLD || 0.64);
const COUNTRY_SLUG = { us: 'us', uk: 'gb', au: 'au', de: 'de' };
const UA = 'Mozilla/5.0 (compatible; ThaiMassageForU-FreshaLinker/1.0; +https://thaimassageforu.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanHtml = (s) => String(s || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|pty|ltd|limited|llc|inc|gmbh)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((x) => x.length > 1));
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0;
  let hit = 0; for (const x of A) if (B.has(x)) hit++;
  return hit / (A.size + B.size - hit);
};
const addressOverlap = (a, b) => {
  const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0;
  let hit = 0; for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size);
};
const sql = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

async function fetchText(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' });
      if (r.ok) return await r.text();
      if (r.status === 404) return '';
      last = new Error(`${r.status} ${url}`);
    } catch (e) { last = e; }
    await sleep(700 * (i + 1));
  }
  throw last || new Error(`fetch failed ${url}`);
}

function wranglerJson(command) {
  const out = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'thaimassageforu', '--remote', '--command', command, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const parsed = JSON.parse(out);
  const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
  while (queue.length) {
    const x = queue.shift();
    if (Array.isArray(x?.results)) return x.results;
    if (Array.isArray(x)) queue.push(...x);
    else if (x && typeof x === 'object') queue.push(...Object.values(x));
  }
  return [];
}

function extractProfileLinks(html) {
  const found = new Set();
  const patterns = [
    /href=["'](\/a\/[a-z0-9][^"'#?]*)["']/gi,
    /https?:\\?\/\\?\/www\.fresha\.com\\?\/a\\?\/[a-z0-9][^"'\\\s<]*/gi,
  ];
  let m;
  for (const re of patterns) while ((m = re.exec(html))) {
    let u = m[1] || m[0];
    u = u.replace(/\\\//g, '/').replace(/&amp;/g, '&');
    if (u.startsWith('/')) u = `https://www.fresha.com${u}`;
    u = u.split('?')[0].split('#')[0];
    if (/^https:\/\/www\.fresha\.com\/a\//i.test(u)) found.add(u);
  }
  return [...found];
}

function cityLandingUrls(country, citySlug, page) {
  const cc = COUNTRY_SLUG[country] || country;
  const loc = `${cc}-${citySlug}`;
  const suffix = page > 1 ? `?page=${page}` : '';
  return [
    `https://www.fresha.com/lp/en/tt/thai-massages/in/${loc}${suffix}`,
    `https://www.fresha.com/lp/en/bt/massage/in/${loc}${suffix}`,
  ];
}

async function collectCityProfiles(country, citySlug) {
  const profiles = new Set();
  for (const baseKind of ['thai', 'massage']) {
    let stalePages = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const urls = cityLandingUrls(country, citySlug, page);
      const url = baseKind === 'thai' ? urls[0] : urls[1];
      const html = await fetchText(url).catch(() => '');
      if (!html) { if (++stalePages >= 2) break; continue; }
      const before = profiles.size;
      for (const link of extractProfileLinks(html)) profiles.add(link);
      stalePages = profiles.size === before ? stalePages + 1 : 0;
      if (stalePages >= 2) break;
      await sleep(120);
    }
  }
  return [...profiles];
}

function profileFromHtml(url, html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
  const title = cleanHtml(og || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const name = title.replace(/\s+[\-|–|—]\s+.*$/s, '').replace(/\s*\|\s*Fresha.*$/i, '').trim();
  const text = cleanHtml(html).slice(0, 30000);
  return { url, name, title, text };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length); let next = 0;
  async function worker() { while (true) { const i = next++; if (i >= items.length) return; results[i] = await fn(items[i], i); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function score(listing, profile) {
  const a = norm(listing.name), b = norm(profile.name);
  let nameScore = jaccard(a, b);
  if (a && a === b) nameScore = 1;
  else if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) nameScore = Math.max(nameScore, 0.90);
  const addr = addressOverlap(listing.address || '', profile.text || '');
  const suburb = listing.suburb ? (norm(profile.text).includes(norm(listing.suburb)) ? 1 : 0) : 0;
  return Math.min(1, nameScore * 0.78 + addr * 0.17 + suburb * 0.05);
}

console.log('Loading production listings from D1...');
const listings = wranglerJson(`SELECT id,name,country_code,city_slug,suburb,address,website,fresha_url FROM listings ORDER BY id`);
console.log(`Listings: ${listings.length}`);

const cityGroups = new Map();
for (const l of listings) {
  const key = `${l.country_code}/${l.city_slug}`;
  if (!cityGroups.has(key)) cityGroups.set(key, []);
  cityGroups.get(key).push(l);
}

const report = { generated_at: new Date().toISOString(), listings: listings.length, cities: {}, matched: [], review: [], unmatched: [] };
for (const [country, citySlug, cityName] of cities) {
  const key = `${country}/${citySlug}`;
  const local = cityGroups.get(key) || [];
  if (!local.length) continue;
  console.log(`\n${key}: ${local.length} listings — collecting Fresha profiles...`);
  const links = await collectCityProfiles(country, citySlug);
  console.log(`${key}: ${links.length} candidate Fresha profiles`);
  const profiles = (await mapLimit(links, PROFILE_CONCURRENCY, async (url) => {
    try { const html = await fetchText(url); await sleep(80); return profileFromHtml(url, html); }
    catch { return null; }
  })).filter(Boolean);
  report.cities[key] = { directory_listings: local.length, fresha_profiles: profiles.length };

  for (const listing of local) {
    let best = null;
    for (const p of profiles) {
      const s = score(listing, p);
      if (!best || s > best.score) best = { score: s, profile: p };
    }
    const row = {
      id: listing.id, name: listing.name, country_code: listing.country_code, city_slug: listing.city_slug,
      address: listing.address || null, existing_fresha_url: listing.fresha_url || null,
      fresha_url: best?.profile?.url || null, fresha_name: best?.profile?.name || null,
      score: best ? Number(best.score.toFixed(4)) : 0,
    };
    if (best && best.score >= HIGH_CONFIDENCE) report.matched.push(row);
    else if (best && best.score >= REVIEW_THRESHOLD) report.review.push(row);
    else report.unmatched.push(row);
  }
}

mkdirSync('data', { recursive: true });
writeFileSync('data/fresha-links.json', JSON.stringify(report, null, 2));
const updates = report.matched.map((m) => `UPDATE listings SET fresha_url=${sql(m.fresha_url)}, fresha_match_score=${m.score}, fresha_verified_at=datetime('now') WHERE id=${Number(m.id)};`);
writeFileSync('data/fresha-links.sql', `-- Generated ${report.generated_at}\n${updates.join('\n')}\n`);
console.log(`\nHigh-confidence matches: ${report.matched.length}`);
console.log(`Needs review: ${report.review.length}`);
console.log(`Unmatched: ${report.unmatched.length}`);
console.log('Wrote data/fresha-links.json and data/fresha-links.sql');

if (APPLY) {
  console.log('Applying migrations and high-confidence Fresha links to production D1...');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'migrations', 'apply', 'thaimassageforu', '--remote'], { stdio: 'inherit' });
  if (updates.length) execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'thaimassageforu', '--remote', '--file=./data/fresha-links.sql'], { stdio: 'inherit' });
  console.log(`Applied ${updates.length} Fresha links.`);
}

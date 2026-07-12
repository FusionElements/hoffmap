"use strict";

const fs = require("fs");
const path = require("path");

const BASE =
  "https://www.hardoff.co.jp/shop/list/?a=100&pg={page}&t1=on&t2=on&t3=on&t4=on&t5=on&t6=on&t8=on&w=";
const OUT = path.join(__dirname, "..", "data", "stores.json");
const CONCURRENCY = 8;

const BRAND_MAP = {
  hard_off: "hoff",
  off_house: "offhouse",
  hobby_off: "hobbyoff",
  garage_off: "garageoff",
  mode_off: "modeoff",
  liquor_off: "liquoroff",
  book_off: "bookoff",
  hard_gakki: "hardgakki",
  kougu_kan: "kougukan",
  hard_pc: "hardpc",
  outdoor: "outdoor",
  hobby_toreka: "hobbytoreka",
};

const ID_BRAND = {
  101: "hoff",
  103: "offhouse",
  104: "modeoff",
  105: "garageoff",
  108: "hobbyoff",
  201: "hoff",
  203: "offhouse",
  208: "hobbyoff",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "hoff-map-fetch/1.0" },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function brandFromId(id) {
  const prefix = id.slice(0, 3);
  return ID_BRAND[prefix] || "hoff";
}

function parseListPage(html) {
  const stores = [];
  let currentPref = "";

  const blocks = html.split(/<li class="store_list2_name">/);
  for (const block of blocks.slice(1)) {
    const prefMatch = block.match(/^([^<]+)<\/li>/);
    if (prefMatch) currentPref = prefMatch[1].trim();

    const items = [
      ...block.matchAll(/<li><a href="\/shop\/detail\/\?p=(\d+)">([\s\S]*?)<\/a><\/li>/g),
    ];
    for (const [, id, body] of items) {
      const name = (body.match(/<h3 class="store_list2_ttl">([^<]+)<\/h3>/) || [])[1];
      const normalizedName = name ? name.replace(/ハードオフ/g, "ハドフ") : name;
      const storeName = normalizedName || "";
      const addrLine = (body.match(/<p>〒([^<]+)<\/p>/) || [])[1] || "";
      const logo = (body.match(/store_list2_logo ([a-z_]+)/) || [])[1];
      const zip = addrLine.split(" ")[0] || "";
      const address = addrLine.includes(" ") ? addrLine.slice(addrLine.indexOf(" ") + 1) : addrLine;

      stores.push({
        id,
        brand: BRAND_MAP[logo] || brandFromId(id),
        name: storeName,
        zip,
        address,
        prefecture: currentPref,
      });
    }
  }

  return stores;
}

function parseCoords(html) {
  const match = html.match(/google\.com\/maps\?q=([0-9.+-]+),([0-9.+-]+)/);
  if (!match) return null;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

async function fetchCoords(id) {
  const html = await fetchText(`https://www.hardoff.co.jp/shop/detail/?p=${id}`);
  return parseCoords(html);
}

async function mapPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

async function main() {
  console.log("Fetching store list pages...");
  const firstHtml = await fetchText(BASE.replace("{page}", "1"));
  const totalMatch = firstHtml.match(/(\d+)件中/);
  const total = totalMatch ? Number(totalMatch[1]) : 0;
  const pages = Math.ceil(total / 30) || 1;
  console.log(`Total stores: ${total}, pages: ${pages}`);

  let stores = parseListPage(firstHtml);
  for (let page = 2; page <= pages; page++) {
    const html = await fetchText(BASE.replace("{page}", String(page)));
    stores = stores.concat(parseListPage(html));
    process.stdout.write(`\rList pages: ${page}/${pages}`);
    await sleep(120);
  }
  console.log(`\nParsed ${stores.length} stores from list`);

  const unique = new Map();
  for (const store of stores) unique.set(store.id, store);
  stores = [...unique.values()];

  console.log("Fetching coordinates from detail pages...");
  let done = 0;
  const withCoords = await mapPool(
    stores,
    async (store) => {
      let coords = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          coords = await fetchCoords(store.id);
          if (coords) break;
        } catch {
          await sleep(300 * (attempt + 1));
        }
      }
      done++;
      if (done % 50 === 0 || done === stores.length) {
        process.stdout.write(`\rCoords: ${done}/${stores.length}`);
      }
      if (!coords) {
        console.warn(`\nNo coords for ${store.id} ${store.name}`);
        return null;
      }
      return { ...store, lat: coords.lat, lng: coords.lng };
    },
    CONCURRENCY
  );

  const result = withCoords.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`\nSaved ${result.length} stores to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

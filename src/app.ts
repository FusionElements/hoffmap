/// <reference types="leaflet" />

/* ============ 地図 ============ */
const map = L.map("map", {zoomControl:false}).setView([37.0, 137.5], 5);
L.control.zoom({position:"topright"}).addTo(map);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

/* 複合店（同一座標）のピンが重ならないよう微小オフセット */
const seen: Record<string, number> = {};
for(const s of STORES){
  const k = s.lat + "," + s.lng;
  const n = seen[k] = (seen[k] ?? -1) + 1;
  if(n > 0){
    const step = Math.ceil(n / 2), dir = (n % 2 === 1) ? 1 : -1;
    s.dlat = s.lat;
    s.dlng = s.lng + dir * step * 0.0006;
  }else{
    s.dlat = s.lat; s.dlng = s.lng;
  }
}

function icon(store: Store): L.DivIcon {
  const done = !!checkins[store.id];
  const b = BRANDS[store.brand] || {mark:"?", color:"#1355A4", text:"#fff"};
  const mark = b.mark;
  const brandColor = b.color || "#1355A4";
  const bg = done ? "#fff" : brandColor;
  const textColor = done ? brandColor : (b.text || "#fff");
  const borderColor = done ? brandColor : "#fff";
  return L.divIcon({
    html:`<div class="pin${done?" done":""}" style="background:${bg};border-color:${borderColor}"><span style="color:${textColor}">${mark}</span></div>`,
    iconSize:[30,30], iconAnchor:[15,28], popupAnchor:[0,-26],
  });
}

function popupHtml(store: Store): string {
  const done = !!checkins[store.id];
  const b = BRANDS[store.brand] || {label:store.brand};
  const g = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(store.name + " " + store.address);
  const o = "https://www.hardoff.co.jp/shop/detail/?p=" + store.id;
  const lat = store.lat, lng = store.lng;
  const name = encodeURIComponent(store.name);
  const navGoogle = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const navApple  = `https://maps.apple.com/?daddr=${lat},${lng}&q=${name}`;
  const navYahoo  = `https://map.yahoo.co.jp/route/car/?to=${lat},${lng}&to_name=${name}`;
  return `<div class="pop${done?" done":""}">
    <span class="brand">${b.label}</span>
    <h2>${store.name}</h2>
    <div class="addr">〒${store.zip}<br>${store.address}</div>
    ${done ? `<div class="date">✔ ${checkins[store.id]} チェックイン</div>` : ""}
    <div class="links">
      <a href="${o}" target="_blank" rel="noopener">公式ページ</a>
      <a href="${g}" target="_blank" rel="noopener">Googleマップ</a>
    </div>
    <button data-id="${store.id}">${done ? "チェックインを取り消す" : "チェックインする"}</button>
    <span class="nav-label">ここへ行く</span>
    <div class="nav-btns">
      <a href="${navGoogle}" target="_blank" rel="noopener" class="nav-btn google">Google<br>マップ</a>
      <a href="${navApple}"  target="_blank" rel="noopener" class="nav-btn apple">Apple<br>マップ</a>
      <a href="${navYahoo}"  target="_blank" rel="noopener" class="nav-btn yahoo">Yahoo!<br>カーナビ</a>
    </div>
    <div class="note">ピン位置は町丁目レベルの近似です。正確な場所はGoogleマップで確認してください。</div>
  </div>`;
}

const markers: Record<string, L.Marker> = {};
function buildMarkers(): void {
  for(const s of STORES){
    const done = !!checkins[s.id];
    const m = L.marker([s.dlat!, s.dlng!], {icon:icon(s), title:s.name, zIndexOffset: done ? 1000 : 0});
    m.bindPopup(() => popupHtml(s), {autoPan: false});
    markers[s.id] = m;
  }
}

/* ============ フィルタ ============ */
let brandFilter = "all";
let unvisitedOnly = false;
let prefFilter = "all";

function buildPrefSelect(): void {
  const sel = document.getElementById("pref-select") as HTMLSelectElement;
  const present = new Set(STORES.map(s => s.prefecture));
  for(const pref of PREF_ORDER){
    if(!present.has(pref)) continue;
    const opt = document.createElement("option");
    opt.value = pref;
    opt.textContent = pref;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => {
    prefFilter = sel.value;
    document.getElementById("pref-label")!.textContent = prefFilter === "all" ? "全国" : prefFilter;
    applyFilter();
  });
}

function applyFilter(): void {
  let shown = 0;
  for(const s of STORES){
    const m = markers[s.id];
    const okBrand = brandFilter === "all" || s.brand === brandFilter;
    const okVisit = !unvisitedOnly || !checkins[s.id];
    const okPref = prefFilter === "all" || s.prefecture === prefFilter;
    const show = okBrand && okVisit && okPref;
    if(show) shown++;
    if(show && !map.hasLayer(m)) m.addTo(map);
    if(!show && map.hasLayer(m)) map.removeLayer(m);
  }
  document.getElementById("store-count")!.textContent = String(shown);
}

function buildChips(): void {
  const wrap = document.getElementById("chips")!;
  const defs: [string, string][] = [["all","すべて"], ...Object.entries(BRANDS).map(([k,v]): [string, string] => [k,v.chip])];
  for(const [key,label] of defs){
    const b = document.createElement("button");
    b.className = "chip" + (key==="all" ? " on" : "");
    b.textContent = label;
    b.dataset.brand = key;
    b.addEventListener("click", () => {
      brandFilter = key;
      wrap.querySelectorAll(".chip[data-brand]").forEach(c => c.classList.toggle("on", c===b));
      applyFilter();
    });
    wrap.appendChild(b);
  }
  const u = document.createElement("button");
  u.className = "chip";
  u.textContent = "未訪問のみ";
  u.addEventListener("click", () => {
    unvisitedOnly = !unvisitedOnly;
    u.classList.toggle("on", unvisitedOnly);
    u.classList.toggle("warn", unvisitedOnly);
    applyFilter();
  });
  wrap.appendChild(u);
}

/* ============ 進捗 ============ */
function refreshProgress(): void {
  const total = STORES.length;
  const done = STORES.filter(s => checkins[s.id]).length;
  document.getElementById("done")!.textContent = String(done);
  document.getElementById("total")!.textContent = String(total);
  (document.getElementById("bar") as HTMLElement).style.width = (total ? (100*done/total) : 0) + "%";
}

/* ============ チェックイン操作（ポップアップ・一覧シート共通） ============ */
async function setCheckin(id: string, on: boolean): Promise<void> {
  const store = STORES.find(s => s.id === id)!;
  if(on){
    checkins[id] = todayStr();
    toast("🔴 " + store.name + " にチェックイン！");
  }else{
    delete checkins[id];
    toast(store.name + " のチェックインを取り消しました");
  }
  await saveCheckins();
  markers[id].setIcon(icon(store));
  markers[id].setZIndexOffset(on ? 1000 : 0);
  markers[id].setPopupContent(popupHtml(store));
  refreshProgress();
  applyFilter();
}

async function bulkSetCheckin(pref: string, on: boolean): Promise<void> {
  const prefStores = STORES.filter(s => s.prefecture === pref);
  let changed = 0;
  for(const s of prefStores){
    if(!!checkins[s.id] === on) continue;
    if(on) checkins[s.id] = todayStr();
    else delete checkins[s.id];
    changed++;
    markers[s.id].setIcon(icon(s));
    markers[s.id].setZIndexOffset(on ? 1000 : 0);
    markers[s.id].setPopupContent(popupHtml(s));
  }
  if(changed > 0){
    await saveCheckins();
    toast(`${pref}の${changed}店舗を${on ? "チェックイン" : "チェックイン解除"}しました`);
  }
  refreshProgress();
  applyFilter();
}

map.on("popupopen", (e: L.LeafletEvent) => {
  const popup = (e as L.PopupEvent).popup;
  const btn = popup.getElement()?.querySelector("button[data-id]") as HTMLButtonElement | null;
  if(!btn) return;
  btn.addEventListener("click", async () => {
    const id = btn.dataset.id!;
    const savedCenter = map.getCenter();
    const savedZoom   = map.getZoom();
    await setCheckin(id, !checkins[id]);
    map.setView(savedCenter, savedZoom, {animate: false});
  });
});

/* ============ 店舗一覧シート（都道府県別・下からスライド） ============ */
let listFilter = "all";
let expandedPrefs = new Set<string>();

function navLinksHtml(store: Store): string {
  const lat = store.lat, lng = store.lng;
  const name = encodeURIComponent(store.name);
  const reviewUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(store.name + " " + store.address);
  const navGoogle = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const navApple  = `https://maps.apple.com/?daddr=${lat},${lng}&q=${name}`;
  const navYahoo  = `https://map.yahoo.co.jp/route/car/?to=${lat},${lng}&to_name=${name}`;
  return `
    <a href="${navGoogle}" target="_blank" rel="noopener">Googleマップ</a>
    <a href="${navApple}" target="_blank" rel="noopener">Appleマップ</a>
    <a href="${navYahoo}" target="_blank" rel="noopener">Yahoo!カーナビ</a>
    <button type="button" class="on-map" data-goto="${store.id}">地図で見る</button>
    <a href="${reviewUrl}" target="_blank" rel="noopener">口コミ(Google)</a>
  `;
}

function listCardHtml(s: Store): string {
  const done = !!checkins[s.id];
  const b = BRANDS[s.brand] || {label:s.brand, color:"#1355A4"};
  return `
    <label class="list-card${done ? " done" : ""}" data-id="${s.id}">
      <input type="checkbox" ${done ? "checked" : ""} aria-label="${s.name} をチェックイン">
      <div class="list-card-body">
        <span class="item-brand" style="background:${b.color}">${b.label}</span>
        <div class="item-name">${s.name}</div>
        <div class="item-addr">〒${s.zip} ${s.address}</div>
        ${done ? `<div class="item-date">✔ ${checkins[s.id]} チェックイン済み</div>` : ""}
        <div class="item-links">${navLinksHtml(s)}</div>
      </div>
    </label>
  `;
}

function prefCheckState(pref: string): "none" | "some" | "all" {
  const prefStores = STORES.filter(s => s.prefecture === pref);
  const doneCount = prefStores.filter(s => checkins[s.id]).length;
  if(doneCount === 0) return "none";
  if(doneCount === prefStores.length) return "all";
  return "some";
}

function buildList(): void {
  const body = document.getElementById("list-body")!;
  const jump = document.getElementById("list-jump")!;

  const stores = STORES.filter(s => {
    if(prefFilter !== "all" && s.prefecture !== prefFilter) return false;
    if(listFilter === "unvisited") return !checkins[s.id];
    if(listFilter === "visited")   return !!checkins[s.id];
    return true;
  });

  document.getElementById("list-count")!.textContent = stores.length + "店舗";

  if(stores.length === 0){
    jump.innerHTML = "";
    body.innerHTML = '<div class="list-empty">該当する店舗がありません</div>';
    return;
  }

  const presentPrefs = PREF_ORDER.filter(p => stores.some(s => s.prefecture === p));
  jump.innerHTML = presentPrefs.map(p => `<button type="button" data-jump="${p}">${p}</button>`).join("");

  const soloPref = presentPrefs.length === 1;

  body.innerHTML = presentPrefs.map(pref => {
    const prefStores = stores.filter(s => s.prefecture === pref)
      .sort((a,b) => a.name.localeCompare(b.name, "ja"));
    const expanded = soloPref || expandedPrefs.has(pref);
    const state = prefCheckState(pref);
    return `
      <section class="list-pref-section" id="list-pref-${pref}">
        <h3 class="list-pref-h3">
          <input type="checkbox" class="pref-check" data-pref="${pref}" ${state === "all" ? "checked" : ""} aria-label="${pref}の全店舗をチェックイン">
          <button type="button" class="pref-toggle" data-pref-toggle="${pref}" aria-expanded="${expanded}">
            <span class="pref-name">${pref}</span><span class="n">${prefStores.length}店舗</span>
            <span class="chev">${expanded ? "▾" : "▸"}</span>
          </button>
        </h3>
        <div class="list-pref-body">${expanded ? prefStores.map(listCardHtml).join("") : ""}</div>
      </section>
    `;
  }).join("");

  body.querySelectorAll(".pref-check").forEach(cb => {
    (cb as HTMLInputElement).indeterminate = prefCheckState((cb as HTMLElement).dataset.pref!) === "some";
  });
}

function openList(): void {
  buildList();
  document.getElementById("list-sheet")!.classList.add("open");
}
function closeList(): void {
  document.getElementById("list-sheet")!.classList.remove("open");
}

document.getElementById("list-btn")!.addEventListener("click", openList);
document.getElementById("list-close")!.addEventListener("click", closeList);

document.getElementById("list-tabs")!.addEventListener("click", (e) => {
  const tab = (e.target as HTMLElement).closest("[data-filter]") as HTMLElement | null;
  if(!tab) return;
  listFilter = tab.dataset.filter!;
  document.querySelectorAll(".list-tab").forEach(t => t.classList.toggle("on", t === tab));
  buildList();
});

document.getElementById("list-jump")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-jump]") as HTMLElement | null;
  if(!btn) return;
  const pref = btn.dataset.jump!;
  expandedPrefs.add(pref);
  buildList();
  document.getElementById("list-pref-" + pref)!.scrollIntoView({behavior:"smooth", block:"start"});
});

document.getElementById("list-body")!.addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  if(input.type !== "checkbox") return;

  if(input.classList.contains("pref-check")){
    const pref = input.dataset.pref!;
    await bulkSetCheckin(pref, input.checked);
    expandedPrefs.add(pref);
    buildList();
    return;
  }

  const card = input.closest(".list-card") as HTMLElement | null;
  if(!card) return;
  await setCheckin(card.dataset.id!, input.checked);
  buildList();
});

document.getElementById("list-body")!.addEventListener("click", (e) => {
  const toggle = (e.target as HTMLElement).closest("[data-pref-toggle]") as HTMLElement | null;
  if(toggle){
    const pref = toggle.dataset.prefToggle!;
    if(expandedPrefs.has(pref)) expandedPrefs.delete(pref);
    else expandedPrefs.add(pref);
    buildList();
    return;
  }
  const btn = (e.target as HTMLElement).closest("[data-goto]") as HTMLElement | null;
  if(!btn) return;
  const id = btn.dataset.goto!;
  closeList();
  setTimeout(() => {
    const s = STORES.find(x => x.id === id)!;
    map.setView([s.dlat!, s.dlng!], 15);
    setTimeout(() => markers[id] && markers[id].openPopup(), 400);
  }, 300);
});

/* ============ 現在地・追従モード ============ */
let meMarker: L.CircleMarker | null = null;
let followMode = false;
let watchId: number | null = null;

function updateMeMarker(lat: number, lng: number): void {
  if(meMarker) map.removeLayer(meMarker);
  meMarker = L.circleMarker([lat,lng], {radius:8, color:"#fff", weight:3, fillColor:"#1355A4", fillOpacity:1}).addTo(map);
}

function setFollowMode(on: boolean): void {
  followMode = on;
  const btn = document.getElementById("locate")!;
  btn.classList.toggle("on", on);
  btn.title = on ? "追従モードをオフ" : "現在地へ移動";
  btn.setAttribute("aria-label", on ? "追従モードをオフ" : "現在地へ移動");
  if(!on && watchId !== null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

document.getElementById("locate")!.addEventListener("click", () => {
  if(!navigator.geolocation){ toast("この環境では位置情報が使えません"); return; }
  if(followMode){ setFollowMode(false); toast("追従モードをオフにしました"); return; }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const {latitude:lat, longitude:lng} = pos.coords;
      updateMeMarker(lat, lng);
      map.setView([lat, lng], 13);
      setFollowMode(true);
      toast("現在地に追従中 — 地図を動かすと停止します");
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          updateMeMarker(p.coords.latitude, p.coords.longitude);
          if(followMode) map.panTo([p.coords.latitude, p.coords.longitude]);
        },
        () => {},
        {enableHighAccuracy:true}
      );
    },
    () => toast("現在地を取得できませんでした"),
    {enableHighAccuracy:true, timeout:8000}
  );
});

map.on("dragstart", () => {
  if(followMode){ setFollowMode(false); }
});

/* ============ トースト ============ */
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  const t = document.getElementById("toast")!;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ============ 初期化 ============ */
(async function init(){
  await loadCheckins();
  buildMarkers();
  buildChips();
  buildPrefSelect();
  applyFilter();
  refreshProgress();
})();

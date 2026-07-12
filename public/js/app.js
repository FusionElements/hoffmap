"use strict";

const BRANDS = {
  hoff: { label: "ハドフ", chip: "ハドフ", mark: "H" },
  offhouse: { label: "オフハウス", chip: "オフハウス", mark: "O" },
  hobbyoff: { label: "ホビーオフ", chip: "ホビーオフ", mark: "B" },
  modeoff: { label: "モードオフ", chip: "モードオフ", mark: "M" },
  garageoff: { label: "ガレージオフ", chip: "ガレージオフ", mark: "G" },
};

const CHECKIN_KEY = "hoff-checkins-v1";

let stores = [];
let checkins = {};
let brandFilter = "all";
let prefectureFilter = "all";
let unvisitedOnly = false;
let meMarker = null;
let toastTimer = null;

const map = L.map("map", { zoomControl: false }).setView([36.5, 138.0], 6);
L.control.zoom({ position: "topright" }).addTo(map);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const markers = {};

function loadCheckins() {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    checkins = raw ? JSON.parse(raw) : {};
  } catch {
    checkins = {};
    toast("チェックインの読み込みに失敗しました");
  }
}

function saveCheckins() {
  try {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkins));
  } catch {
    toast("保存に失敗しました");
  }
}

function offsetOverlappingStores(list) {
  const seen = {};
  for (const store of list) {
    const key = `${store.lat},${store.lng}`;
    const n = (seen[key] = (seen[key] ?? -1) + 1);
    if (n > 0) {
      const ang = n * 2.1;
      const r = 0.00045 * n;
      store.dlat = store.lat + r * Math.cos(ang);
      store.dlng = store.lng + r * Math.sin(ang) * 1.25;
    } else {
      store.dlat = store.lat;
      store.dlng = store.lng;
    }
  }
}

function icon(store) {
  const done = !!checkins[store.id];
  const mark = (BRANDS[store.brand] || { mark: "?" }).mark;
  return L.divIcon({
    html: `<div class="pin${done ? " done" : ""}"><span>${mark}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });
}

function popupHtml(store) {
  const done = !!checkins[store.id];
  const brand = BRANDS[store.brand] || { label: store.brand };
  const googleMaps =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${store.name} ${store.address}`);
  const official = `https://www.hardoff.co.jp/shop/detail/?p=${store.id}`;

  return `<div class="pop${done ? " done" : ""}">
    <span class="brand">${brand.label}</span>
    <h2>${store.name}</h2>
    <div class="addr">〒${store.zip}<br>${store.address}</div>
    ${done ? `<div class="date">✔ ${checkins[store.id]} チェックイン</div>` : ""}
    <div class="links">
      <a href="${official}" target="_blank" rel="noopener">公式ページ</a>
      <a href="${googleMaps}" target="_blank" rel="noopener">Googleマップ</a>
    </div>
    <button data-id="${store.id}">${done ? "チェックインを取り消す" : "チェックインする"}</button>
    <div class="note">ピン位置は町丁目レベルの近似です。正確な場所はGoogleマップで確認してください。</div>
  </div>`;
}

function buildMarkers() {
  for (const store of stores) {
    const marker = L.marker([store.dlat, store.dlng], {
      icon: icon(store),
      title: store.name,
    });
    marker.bindPopup(() => popupHtml(store));
    markers[store.id] = marker;
  }
}

function extractPrefecture(address) {
  const match = address.match(/^(.+?[都道府県])/);
  return match ? match[1] : "";
}

function visibleStores() {
  return stores.filter((store) => {
    const okBrand = brandFilter === "all" || store.brand === brandFilter;
    const okPref =
      prefectureFilter === "all" || store.prefecture === prefectureFilter;
    const okVisit = !unvisitedOnly || !checkins[store.id];
    return okBrand && okPref && okVisit;
  });
}

function applyFilter() {
  const visibleIds = new Set(visibleStores().map((store) => store.id));

  for (const store of stores) {
    const marker = markers[store.id];
    const show = visibleIds.has(store.id);
    if (show && !map.hasLayer(marker)) marker.addTo(map);
    if (!show && map.hasLayer(marker)) map.removeLayer(marker);
  }

  const shown = visibleStores();
  if (shown.length > 0) {
    map.fitBounds(
      L.latLngBounds(shown.map((store) => [store.dlat, store.dlng])),
      { padding: [48, 48], maxZoom: prefectureFilter === "all" ? 7 : 11 }
    );
  }
}

function buildPrefectureSelect() {
  const select = document.getElementById("prefecture");
  const prefs = [...new Set(stores.map((store) => store.prefecture).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ja")
  );

  for (const pref of prefs) {
    const option = document.createElement("option");
    option.value = pref;
    option.textContent = pref;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    prefectureFilter = select.value;
    applyFilter();
    refreshProgress();
  });
}

function buildChips() {
  const wrap = document.getElementById("chips");
  const defs = [
    ["all", "すべて"],
    ...Object.entries(BRANDS).map(([key, value]) => [key, value.chip]),
  ];

  for (const [key, label] of defs) {
    const button = document.createElement("button");
    button.className = "chip" + (key === "all" ? " on" : "");
    button.textContent = label;
    button.dataset.brand = key;
    button.addEventListener("click", () => {
      brandFilter = key;
      wrap
        .querySelectorAll(".chip[data-brand]")
        .forEach((chip) => chip.classList.toggle("on", chip === button));
      applyFilter();
    });
    wrap.appendChild(button);
  }

  const unvisited = document.createElement("button");
  unvisited.className = "chip";
  unvisited.textContent = "未訪問のみ";
  unvisited.addEventListener("click", () => {
    unvisitedOnly = !unvisitedOnly;
    unvisited.classList.toggle("on", unvisitedOnly);
    unvisited.classList.toggle("warn", unvisitedOnly);
    applyFilter();
  });
  wrap.appendChild(unvisited);
}

function refreshProgress() {
  const scoped = stores.filter((store) => {
    const okBrand = brandFilter === "all" || store.brand === brandFilter;
    const okPref =
      prefectureFilter === "all" || store.prefecture === prefectureFilter;
    return okBrand && okPref;
  });
  const done = scoped.filter((store) => checkins[store.id]).length;
  const total = scoped.length;

  document.getElementById("done").textContent = done;
  document.getElementById("total").textContent = total;
  document.getElementById("store-count").textContent = stores.length;
  document.getElementById("bar").style.width =
    (total ? (100 * done) / total : 0) + "%";
}

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}

map.on("popupopen", (event) => {
  const button = event.popup.getElement().querySelector("button[data-id]");
  if (!button) return;

  button.addEventListener("click", () => {
    const id = button.dataset.id;
    const store = stores.find((item) => item.id === id);

    if (checkins[id]) {
      delete checkins[id];
      toast(`${store.name} のチェックインを取り消しました`);
    } else {
      const date = new Date();
      checkins[id] = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      toast(`🔴 ${store.name} にチェックイン！`);
    }

    saveCheckins();
    markers[id].setIcon(icon(store));
    markers[id].setPopupContent(popupHtml(store));
    refreshProgress();
    applyFilter();
  });
});

document.getElementById("locate").addEventListener("click", () => {
  if (!navigator.geolocation) {
    toast("この環境では位置情報が使えません");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      if (meMarker) map.removeLayer(meMarker);
      meMarker = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#1355A4",
        fillOpacity: 1,
      }).addTo(map);
      map.setView([lat, lng], 13);
    },
    () => toast("現在地を取得できませんでした"),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

async function init() {
  try {
    const response = await fetch("/api/stores");
    if (!response.ok) throw new Error("API error");
    stores = await response.json();
  } catch {
    toast("店舗データの読み込みに失敗しました");
    return;
  }

  loadCheckins();
  stores = stores.map((store) => ({
    ...store,
    prefecture: store.prefecture || extractPrefecture(store.address),
  }));
  offsetOverlappingStores(stores);
  buildMarkers();
  buildPrefectureSelect();
  buildChips();
  applyFilter();
  refreshProgress();
}

init();

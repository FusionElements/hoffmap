"use strict";
/* ============ チェックインの永続化（マップ・一覧シート共通） ============ */
const CHECKIN_KEY = "hoff-checkins-v1";
let checkins = {}; // {storeId: "2026-07-10"}
let storageOK = false;
async function loadCheckins() {
    try {
        const raw = localStorage.getItem(CHECKIN_KEY);
        checkins = raw ? JSON.parse(raw) : {};
        storageOK = true;
    }
    catch (e) {
        storageOK = false;
        if (typeof toast === "function")
            toast("この環境では保存が使えないため、チェックインはこの画面を開いている間だけ有効です");
    }
}
async function saveCheckins() {
    if (!storageOK)
        return;
    try {
        localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkins));
    }
    catch (e) {
        if (typeof toast === "function")
            toast("保存に失敗しました");
    }
}
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

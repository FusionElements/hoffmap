# ハドフ巡りマップ

埼玉県のハドフ系列店舗（103店舗）を地図上で巡り、チェックインできる Web アプリです。

## 起動方法

```bash
npm install
npm start
```

ブラウザで http://localhost:3000 を開いてください。

開発時はファイル変更を監視する `npm run dev` も使えます。

## 構成

```
hoff-map/
├── server.js          # Express サーバー
├── data/stores.json   # 店舗データ
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## API

- `GET /api/stores` — 店舗一覧（JSON）

チェックインはブラウザの `localStorage` に保存されます。

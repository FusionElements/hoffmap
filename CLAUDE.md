# CLAUDE.md

このリポジトリで作業する際の指針。

## プロジェクト概要

HARD OFFグループ（ハードオフ / オフハウス / ホビーオフ / モードオフ / ガレージオフ / リカーオフ）の店舗を巡り、チェックインできるWebアプリ。**単一ページ**（`public/index.html`）で、地図と都道府県別の店舗一覧（下からスライドするシート）を切り替えて使う構成。一覧を別ページ（`list.html`）にしたことがあったが、「別ページではなく下から出てくるように」という指示で地図ページ内のシートに統合した（一度作った`public/list.html`は削除済み。復活させないこと）。

フロントエンドのロジックは**TypeScript**（`src/*.ts`）で書き、`tsc`で`public/js/*.js`にコンパイルしてブラウザへ配信する。**`public/js/*.js`はビルド成果物であり、直接編集しない**（`npm run build`で上書きされる）。

- `public/index.html` — 地図＋一覧シートの両方を含むメインページのHTML/CSS（Leaflet + OpenStreetMapタイル）。JSは含まず、コンパイル済みの`js/stores.js`・`js/checkins.js`・`js/app.js`を`<script src>`で読み込むだけ
- `src/stores.ts` — `STORES`（全店舗データ）・`BRANDS`（ブランド定義）・`PREF_ORDER`（都道府県の表示順）の型と実データ。コンパイル後 `public/js/stores.js`
- `src/checkins.ts` — チェックイン状態の永続化ロジック（`checkins`/`loadCheckins()`/`saveCheckins()`/`todayStr()`）。**`localStorage`を使用**（後述の理由により`window.storage`から変更済み）。コンパイル後 `public/js/checkins.js`
- `src/app.ts` — 地図描画・フィルタ・一覧シート・チェックインUIなどメインロジック一式。コンパイル後 `public/js/app.js`
- `tsconfig.json` — `rootDir: src` → `outDir: public/js`。3ファイルとも`import`/`export`を使わない「スクリプト」として書いており、グローバルスコープを共有する（`stores.ts`の`STORES`/`BRANDS`は`app.ts`から素の参照で見える。同じ理由で`checkins.ts`内から`app.ts`で定義される`toast()`も参照できる）。Leafletの型は`@types/leaflet`をグローバル型として`types: ["leaflet"]`で読み込んでおり、`app.ts`冒頭の`/// <reference types="leaflet" />`が`L`の型を有効にしている
- `server.js` — 配信用のExpressサーバー（`public/`を静的配信するのみ。TSのビルドには関与しない）
- `data/stores.json` — 全国の店舗データ（`scripts/fetch-stores.js`でhardoff.co.jpから取得。各店舗詳細ページに埋め込まれたGoogleマップリンクの座標を使用しており精度が高い）
- `scripts/fetch-stores.js` — `data/stores.json`を再生成するスクリプト

`src/stores.ts`内の`STORES`定数は`data/stores.json`から生成した埋め込みデータ（ビルドステップなし、直接編集）。ブランドキーは`hoff`（`data/stores.json`では`hardoff`）/`offhouse`/`hobbyoff`/`modeoff`/`garageoff`/`liquoroff`。**`bookoff`（ブックオフ）は指示により除外済み** — 再度全国データを取り込み直す際は除外を忘れないこと。

### npmスクリプト

- `npm run build` — `tsc`で`src/*.ts`を`public/js/*.js`にコンパイル
- `npm run watch` — `tsc --watch`（開発中に使う）
- `npm start` / `npm run dev` — それぞれ`prestart`/`predev`フックで自動的に`npm run build`を実行してからサーバーを起動する。**手動でビルドし忘れても`npm start`すれば最新化される**が、`.ts`を編集した直後にヘッドレスChromeでテストする場合は明示的に`npm run build`してからサーバーを起動/再起動すること

### 未整理の残骸（触っていない）

- `public/css/style.css` — 単一HTML構成へ作り直す前（このセッション最初期）の複数ファイル構成時代の名残。`public/index.html`はインラインの`<style>`を使っており、このCSSファイルは読み込まれていない。ユーザーから指示があれば削除して良い。
- **リポジトリ直下の`/index.html`（`public/index.html`ではない）** — これも同じくセッション最初期の古いスナップショットで、gitに未追跡（untracked）のまま放置されている。**サーバーが実際に配信するのは`public/index.html`だけ**なので、編集対象を間違えないこと。IDEでこのファイルが開かれていても、それは作業対象のヒントにはならない。ユーザーから指示があれば削除して良い。

## チェックインの永続化について（重要）

当初`window.storage.get/set`というAPIを使っていたが、これは標準のブラウザAPIではなく、`server.js`でExpress配信する通常のブラウザ環境には存在しない。そのため毎回`storageOK = false`のフォールバック経路に入り、**実際には何も保存されていなかった**（ユーザーからの「チェック情報が同期できていない」という報告の原因）。これを`localStorage`（標準API、同一オリジンなら常に使え、リロードしても消えない）に置き換えて解決した。今後チェックイン関連で不具合報告があれば、まずこの`localStorage`実装が壊れていないかを疑うこと。`window.storage`のような非標準APIへ戻さないこと。

## これまでの指示・デザイン決定

- **ピンの色はブランドロゴの実際の色に合わせる**。ユーザーが貼ったスクリーンショットから実測した値: ハードオフ`#183F92`（青）、オフハウス`#317245`（緑）、ホビーオフ`#D22D26`背景+`#FDF150`文字（赤地に黄文字）、モードオフ`#D22D26`（ホビーオフと同じ赤、文字は白）、リカーオフ`#9A3244`（マルーン）。ガレージオフはスクリーンショットに無かったため暫定色`#4B5563`グレー。
- **同一座標で重なるピン（複合店舗）は横方向にずらす**。円形オフセットではなく、経度方向のみのオフセット（`src/app.ts`内のオフセットロジック）。
- **チェックイン済みピンは白くする**。背景白、枠線と文字はブランド色というデザイン（ブランド識別性を保ちつつ「訪問済み」を示す）。**密集地では重なり順(zIndexOffset)も上げること** — 旭川周辺のように店舗が密集するエリアで、白くなったピンが他の未チェックの色付きピンの下に隠れて見えなくなる不具合があった。`buildMarkers()`でのマーカー生成時と`setCheckin()`でのトグル時の両方で、チェックイン済みなら`zIndexOffset:1000`を設定して最前面に出す（`src/app.ts`）。
- **表示範囲は全国**。`data/stores.json`全件（ブックオフ除く）を取り込んでいる。地図の初期表示も日本全体が入るズーム。
- **都道府県フィルタ（地図・チップ）**。ヘッダーのセレクトボックスで都道府県を選ぶと、地図のピンと一覧シートの両方が絞り込まれる（ブランドチップによる絞り込みは地図のみに影響し、一覧シートには影響しない）。
- **一覧は下からスライドするシート（別ページではない）**。都道府県ごとにセクション分けし、上部に都道府県ジャンプ用のチップ列がある。各店舗はチェックボックス（チェックイン切り替え）、ブランドバッジ、Googleマップ/Appleマップ/Yahoo!カーナビ/地図で見る（シートを閉じて地図上のポップアップを開く）/口コミ(Google)へのリンクを持つ。すべて/未訪問/チェック済みのタブフィルタも維持している。
- **都道府県セクションはアコーディオン（初期状態は全て折りたたみ）**。996店舗を一度に表示すると長すぎるため、都道府県見出しをタップすると開閉する。ジャンプチップをクリックすると自動的に展開してスクロールする。都道府県セレクトで1県だけに絞り込んでいるときはその1セクションを常に展開状態にする。
- **都道府県見出しの横にチェックボックスがあり、その県の全店舗を一括チェックイン/解除できる**。一部だけチェック済みのときはindeterminate（半チェック）表示になる。一括操作は`bulkSetCheckin(pref, on)`（`src/app.ts`）で行い、1店舗ずつ`setCheckin()`を呼ぶのではなく`checkins`を直接更新してから`saveCheckins()`/`refreshProgress()`/`applyFilter()`を1回だけ呼ぶ設計にしている（大きい県だと数十店舗あるため、店舗ごとに保存・再描画すると無駄が大きい）。
- **フロントエンドはTypeScript**。ユーザーの指示で`public/js/*.js`を手書きJSからTypeScript（`src/*.ts`をtscでコンパイル）に変更した。ビルドステップなしという当初方針から一部逸脱しているが、これは明示的な指示による。`npm start`/`npm run dev`にビルドを自動化するフックを入れているので、通常の起動フローでは意識しなくても最新化される。
- 座標の精度について聞かれたら、以前埋め込まれていた座標は「町丁目レベルの近似」だったが、現在は`data/stores.json`（公式サイトのGoogleマップリンクから取得）を使っており精度が高いことを説明する。

## 作業スタイル

- UIやピンの見た目を変更したら、ヘッドレスChromeでスクリーンショットを撮って目視確認してから完了報告する（`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --screenshot=... --window-size=... URL`）。
- インタラクション（フィルタ操作やチェックイン、リロード後の永続化確認など）の動作確認が必要な場合は`puppeteer-core`（既存Chromeを`executablePath`で指定、`npm install --no-save`で一時的にnode_modulesへ追加し、検証後は削除する）でスクリプト操作して検証する。特に永続化まわりを触ったら、`page.reload()`してから状態を読み直すテストを必ず入れること（今回の不具合はリロードしないと発覚しなかった）。
- `.ts`ファイルを編集したら`npm run build`（または`npx tsc -p tsconfig.json`）を実行し、コンパイルエラーが無いことと`public/js/*.js`が更新されたことを確認してからテストに進むこと。`public/js/*.js`を直接編集しても次のビルドで上書きされるので意味がない。
- `STORES`配列はミニファイされた1行のJSONリテラルとして`src/stores.ts`に埋め込まれている。編集はPythonで`json.loads`→加工→`json.dumps(..., ensure_ascii=False, separators=(",", ":"))`→該当行を置換、という手順で行うと安全（巨大な1行をEditツールで直接いじろうとすると事故りやすい）。
- `public/index.html`はファイルサイズが大きいため、Readツールで行範囲指定してもSTORES行を跨ぐとトークン上限で読めないことがある。行番号はPythonで直接特定し、行単位の差し替えで編集するとよい（なお`STORES`本体は現在`src/stores.ts`側にあるので、index.html編集時にこの問題が起きることは少なくなった）。

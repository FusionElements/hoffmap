"use strict";

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const STORES = require("./data/stores.json");

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/stores", (_req, res) => {
  res.json(STORES);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`ハドフ巡りマップ: http://localhost:${PORT}`);
});

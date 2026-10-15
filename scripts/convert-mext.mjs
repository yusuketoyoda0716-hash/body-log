// 日本食品標準成分表（八訂）増補2023年 の Excel（第2章 本表）から
// アプリで使う項目だけを取り出して JSON にするスクリプト
//
// 使い方：
//   1. 文部科学省のサイトから「第2章（データ）」の Excel をダウンロードする
//   2. scripts/mext/seibunhyo.xlsx という名前で保存する
//   3. npm run convert:mext
//
// 出典：文部科学省「日本食品標準成分表（八訂）増補2023年」

import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';

const INPUT = 'scripts/mext/seibunhyo.xlsx';
const OUTPUT = 'src/data/mextFoods.json';
const SHEET_NAME = '表全体';

// 使う列（1始まり）。12行目の「成分識別子」で位置を確認してから使う
const COLUMNS = {
  code: { col: 2 },
  name: { col: 4 },
  kcal: { col: 7, id: 'ENERC_KCAL' },
  protein: { col: 10, id: 'PROT-' }, // たんぱく質
  fat: { col: 13, id: 'FAT-' }, // 脂質
  carbs: { col: 21, id: 'CHOCDF-' }, // 炭水化物
};
const ID_ROW = 12;
const FIRST_DATA_ROW = 13;

// セルの値を数値にする
//   123 / "12.3" → そのまま
//   "(12.3)"     → 推定値。括弧を外して使う
//   "Tr" "(Tr)"  → 微量。0 として扱う
//   "-" "(0)" "" → 未測定など。0 として扱う
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (value == null) return 0;
  const text = String(value).trim().replace(/^\((.*)\)$/, '$1');
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function cellText(cell) {
  const v = cell.value;
  if (v && typeof v === 'object' && 'richText' in v) {
    return v.richText.map((t) => t.text).join('');
  }
  return v;
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(INPUT);
const sheet = workbook.getWorksheet(SHEET_NAME);
if (!sheet) throw new Error(`シート「${SHEET_NAME}」が見つかりません`);

// 列の位置がずれていないか確認する（版が変わったときの安全策）
const idRow = sheet.getRow(ID_ROW);
for (const [key, { col, id }] of Object.entries(COLUMNS)) {
  if (!id) continue;
  const actual = cellText(idRow.getCell(col));
  if (actual !== id) {
    throw new Error(`${key} の列が想定と違います（${col}列目：${actual}、想定：${id}）`);
  }
}

const foods = [];
for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r);
  const code = cellText(row.getCell(COLUMNS.code.col));
  const name = cellText(row.getCell(COLUMNS.name.col));
  if (!code || !name) continue;

  foods.push({
    code: String(code),
    name: String(name).replace(/　/g, ' ').trim(),
    kcal: toNumber(cellText(row.getCell(COLUMNS.kcal.col))),
    protein: toNumber(cellText(row.getCell(COLUMNS.protein.col))),
    fat: toNumber(cellText(row.getCell(COLUMNS.fat.col))),
    carbs: toNumber(cellText(row.getCell(COLUMNS.carbs.col))),
  });
}

await writeFile(OUTPUT, JSON.stringify(foods) + '\n', 'utf8');
console.log(`${foods.length} 件の食品を ${OUTPUT} に書き出しました`);

import { useEffect, useRef, useState } from 'react';
import { COUNT_UNITS, UNITS, type CountUnit } from '../constants/units';
import type { Food, FoodCategory, Nutrients } from '../types';
import { KIND_LABELS, foodKind, type FoodKind } from '../utils/foodLabel';
import { calcNutrients } from '../utils/nutrition';
import { MEXT_SOURCE, displayName, pickedName, type MextFood } from '../utils/mextFoods';
import { TutorialHint } from '../tutorial/TutorialHint';
import { MextFoodSearch } from './MextFoodSearch';
import styles from './FoodFormDialog.module.css';

// 入力中の値。input の中身は文字列なので、保存するときに数値へ変換する
type FormValues = {
  name: string;
  shop: string; // 外食のときの店名（食品なら空）
  brand: string; // 市販品のメーカー・ブランド（なければ空）
  estimated: boolean; // 外食で、公式の値ではなく見積もった値のとき
  unit: Food['unit'];
  baseAmount: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
};

const emptyValues: FormValues = {
  name: '',
  shop: '',
  brand: '',
  estimated: false,
  unit: 'g',
  baseAmount: '100',
  kcal: '',
  protein: '',
  fat: '',
  carbs: '',
};

const nutrientFields = [
  { key: 'kcal', label: 'カロリー (kcal)' },
  { key: 'protein', label: 'P (g)' },
  { key: 'fat', label: 'F (g)' },
  { key: 'carbs', label: 'C (g)' },
] as const;

function toFormValues(food: Food): FormValues {
  return {
    name: food.name,
    shop: food.shop ?? '',
    brand: food.brand ?? '',
    estimated: Boolean(food.estimated),
    unit: food.unit,
    baseAmount: String(food.baseAmount),
    kcal: String(food.kcal),
    protein: String(food.protein),
    fat: String(food.fat),
    carbs: String(food.carbs),
  };
}

// 量を変えたときに計算し直すための「もとの値」（この量あたり、この値）
type Reference = { baseAmount: number; nutrients: Nutrients };

// 入力欄の栄養素がすべて数値として読めれば、その値を返す
function readNutrients(v: FormValues): Nutrients | null {
  const list = [v.kcal, v.protein, v.fat, v.carbs];
  if (list.some((n) => n === '' || Number.isNaN(Number(n)) || Number(n) < 0)) return null;
  return {
    kcal: Number(v.kcal),
    protein: Number(v.protein),
    fat: Number(v.fat),
    carbs: Number(v.carbs),
  };
}

// 問題があればエラーメッセージ、なければ null を返す
function validate(v: FormValues, requireShop: boolean): string | null {
  if (requireShop && v.shop.trim() === '') return '店名を入力してください';
  if (v.name.trim() === '')
    return requireShop ? 'メニュー名を入力してください' : '食品名を入力してください';

  const base = Number(v.baseAmount);
  if (v.baseAmount === '' || !(base > 0)) return '基準量は0より大きい数値を入力してください';

  const nutrients = [v.kcal, v.protein, v.fat, v.carbs];
  const invalid = nutrients.some((n) => n === '' || Number.isNaN(Number(n)) || Number(n) < 0);
  if (invalid) return 'カロリーとP・F・Cは0以上の数値を入力してください';

  return null;
}

// 種類のボタンの下に出す説明
const KIND_NOTES: Record<FoodKind, string> = {
  ingredient: '肉・野菜・ごはん',
  product: '冷凍食品・総菜',
  restaurant: 'お店のメニュー',
};

type Props = {
  initialFood?: Food; // 編集のときだけ渡す
  onSave: (food: Food) => void;
  onClose: () => void;
  onDelete?: () => void; // 編集のときだけ渡す
  onAddToday?: () => void; // 編集のときだけ渡す（今日の食事に追加）
  restaurant?: boolean; // 「外食」タブから追加するとき（店名を必須にして、1食あたりで入れる）
  defaultCategory?: FoodCategory; // 新しく追加するときの種類（開いたタブに合わせる）
  defaultShop?: string; // 外食のお店を開いて「このお店にメニューを追加」したときの店名
};

export function FoodFormDialog({
  initialFood,
  onSave,
  onClose,
  onDelete,
  onAddToday,
  restaurant = false,
  defaultCategory = 'ingredient',
  defaultShop = '',
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<FormValues>(() =>
    initialFood
      ? toFormValues(initialFood)
      : // 外食のメニューは「1食あたり」で入れることが多い
        restaurant
        ? { ...emptyValues, shop: defaultShop, unit: '食', baseAmount: '1' }
        : emptyValues,
  );
  // 食材・市販品・外食のどれか。成分表から選んだら食材、パッケージの値を入れるなら市販品が多い
  //   編集のときに変えると、その食品を別のタブへ移せる（Claude 連携で登録して種類が違っていたときなど）
  const [kind, setKind] = useState<FoodKind>(() =>
    initialFood ? foodKind(initialFood) : restaurant ? 'restaurant' : defaultCategory,
  );
  const isRestaurant = kind === 'restaurant';
  const [error, setError] = useState<string | null>(null);
  // 新規追加のときだけ「成分表から探す」を選べる。最初は成分表の検索を出す
  //   外食は成分表にないことが多いので、最初から「自分で入力」にする
  //   市販品はパッケージの値を入れることが多いので、最初から「自分で入力」にする
  const [mode, setMode] = useState<'search' | 'manual'>(
    initialFood || restaurant || defaultCategory === 'product' ? 'manual' : 'search',
  );
  // 成分表から選んだ食品（入力欄の上に「〇〇の値を入れました」と出すため）
  const [picked, setPicked] = useState<MextFood | null>(null);
  // 量を変えたら、カロリーとPFCも同じ割合で計算し直す。そのもとになる値
  //   成分表から選んだとき・登録済みの食品を編集するときだけ持つ
  //   （新しく手入力するときは、パッケージの「1袋あたり」などをそのまま入れてもらうので計算しない）
  const [reference, setReference] = useState<Reference | null>(() =>
    initialFood ? { baseAmount: initialFood.baseAmount, nutrients: initialFood } : null,
  );
  // グラムあたりのもとの値（成分表から選んだとき・g で登録した食品を編集するとき）
  //   これがあると「1個あたりで登録」を選べる。1個の重さから1個分の値を計算する
  const [gramRef, setGramRef] = useState<Reference | null>(() =>
    initialFood?.unit === 'g'
      ? { baseAmount: initialFood.baseAmount, nutrients: initialFood }
      : null,
  );
  // 1個あたりで登録するときの、1個の重さ（g）
  const [pieceGrams, setPieceGrams] = useState('');
  const byPiece = gramRef !== null && values.unit !== 'g';

  // 画面に出たらダイアログを開く
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // 量（基準量）を変えたら、もとの値から同じ割合でカロリーとPFCを計算し直す
  //   例：ごはん 100gあたり 156kcal → 300g にすると 468kcal
  //   途中の値（「3」→「30」→「300」）から計算すると誤差がたまるので、いつも「もとの値」から計算する
  function updateBaseAmount(text: string) {
    const amount = Number(text);
    if (!reference || text === '' || !(amount > 0)) {
      update('baseAmount', text);
      return;
    }
    const next = calcNutrients(
      { ...reference.nutrients, baseAmount: reference.baseAmount },
      amount,
    );
    setValues((prev) => ({
      ...prev,
      baseAmount: text,
      kcal: String(next.kcal),
      protein: String(next.protein),
      fat: String(next.fat),
      carbs: String(next.carbs),
    }));
  }

  // 1個の重さ（g）から、1個分のカロリーとPFCを計算して入れる
  function applyPiece(unit: Food['unit'], gramsText: string) {
    setPieceGrams(gramsText);
    const grams = Number(gramsText);
    const next =
      gramRef && gramsText !== '' && grams > 0
        ? calcNutrients({ ...gramRef.nutrients, baseAmount: gramRef.baseAmount }, grams)
        : null;
    setValues((prev) => ({
      ...prev,
      unit,
      baseAmount: '1',
      kcal: next ? String(next.kcal) : '',
      protein: next ? String(next.protein) : '',
      fat: next ? String(next.fat) : '',
      carbs: next ? String(next.carbs) : '',
    }));
    setReference(next ? { baseAmount: 1, nutrients: next } : null);
  }

  // 「100gあたり」と「1個あたり」を切り替える
  function changeMeasure(nextByPiece: boolean) {
    if (!gramRef) return;
    if (nextByPiece) {
      const piece = picked?.piece;
      applyPiece(piece?.unit ?? '個', piece ? String(piece.grams) : '');
      return;
    }
    setValues((prev) => ({
      ...prev,
      unit: 'g',
      baseAmount: String(gramRef.baseAmount),
      kcal: String(gramRef.nutrients.kcal),
      protein: String(gramRef.nutrients.protein),
      fat: String(gramRef.nutrients.fat),
      carbs: String(gramRef.nutrients.carbs),
    }));
    setReference(gramRef);
  }

  // カロリーやPFCを手で直したら、その値を新しい「もとの値」にする
  function updateNutrient(key: keyof Nutrients, text: string) {
    const next = { ...values, [key]: text };
    setValues(next);
    if (!reference) return;
    const nutrients = readNutrients(next);
    const amount = Number(next.baseAmount);
    if (nutrients && amount > 0) setReference({ baseAmount: amount, nutrients });
  }

  // 成分表の食品を選んだら、100gあたりの値を入力欄に入れて「自分で入力」に切り替える
  //   卵やパンのように1個で数えることが多いものは、最初から「1個あたり」にする
  function handleSelect(food: MextFood) {
    const piece = food.piece;
    const values100 = piece ? calcNutrients({ ...food, baseAmount: 100 }, piece.grams) : food;
    setValues((prev) => ({
      // 店名・メーカーは入れたままにする（外食のメニューを成分表の料理から登録するときなど）
      shop: prev.shop,
      brand: prev.brand,
      estimated: false,
      name: pickedName(food),
      unit: piece ? piece.unit : 'g',
      baseAmount: piece ? '1' : '100',
      kcal: String(values100.kcal),
      protein: String(values100.protein),
      fat: String(values100.fat),
      carbs: String(values100.carbs),
    }));
    setPicked(food);
    // 外食のメニューを成分表の料理から登録するときは外食のまま。それ以外は食材にする
    setKind((prev) => (prev === 'restaurant' ? prev : 'ingredient'));
    setReference(
      piece ? { baseAmount: 1, nutrients: values100 } : { baseAmount: 100, nutrients: food },
    );
    setGramRef({ baseAmount: 100, nutrients: food });
    setPieceGrams(piece ? String(piece.grams) : '');
    setError(null);
    setMode('manual');
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault(); // ページの再読み込みを止める
    if (byPiece && !(Number(pieceGrams) > 0)) {
      setError(`1${values.unit}の重さ（g）を入力してください`);
      return;
    }
    const message = validate(values, isRestaurant);
    if (message) {
      setError(message);
      return;
    }
    // 出典：成分表から選んだときは成分表。編集のときは、もとの出典を残す
    // 2つを混ぜて計算した値（麦ごはんなど）は、計算のしかたも出典に残す
    //   1個あたりで登録したときは、1個を何gとして計算したかも残す
    const basis = [picked?.basis, byPiece ? `1${values.unit}＝${pieceGrams}gとして計算` : null]
      .filter(Boolean)
      .join('、');
    const source = picked
      ? basis
        ? `${MEXT_SOURCE}をもとに計算（${basis}）`
        : MEXT_SOURCE
      : byPiece && initialFood?.source
        ? `${initialFood.source}（${basis}）`
        : initialFood?.source;
    onSave({
      // Firestore は undefined の項目を保存できないので、出典があるときだけ入れる
      ...(source ? { source } : {}),
      id: initialFood?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      // 外食なら店名（見積もりの印も外食のときだけ）。それ以外は食材か市販品か
      //   市販品のときだけメーカーを残す。種類を変えたときは、前の種類の項目を外す
      ...(isRestaurant
        ? {
            shop: values.shop.trim(),
            ...(values.estimated ? { estimated: true } : {}),
          }
        : { category: kind }),
      ...(kind === 'product' && values.brand.trim() ? { brand: values.brand.trim() } : {}),
      unit: values.unit,
      baseAmount: Number(values.baseAmount),
      kcal: Number(values.kcal),
      protein: Number(values.protein),
      fat: Number(values.fat),
      carbs: Number(values.carbs),
    });
  }

  // 種類を変える。外食⇔市販品のときは、店名とメーカーを引き継ぐ（コンビニの商品など、どちらにも入れることがあるため）
  function changeKind(next: FoodKind) {
    setKind(next);
    setValues((prev) => ({
      ...prev,
      shop: next === 'restaurant' && prev.shop.trim() === '' ? prev.brand : prev.shop,
      brand: next === 'product' && prev.brand.trim() === '' ? prev.shop : prev.brand,
    }));
    setError(null);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      aria-labelledby="food-form-title"
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 id="food-form-title" className={styles.title}>
          {initialFood
            ? isRestaurant
              ? '外食メニューを編集'
              : '食品を編集'
            : isRestaurant
              ? '外食メニューを追加'
              : '食品を追加'}
        </h2>
        <TutorialHint dialog="food" />

        {!initialFood && (
          <div className={styles.tabs} role="group" aria-label="追加のしかた">
            <button
              type="button"
              className={styles.tab}
              aria-pressed={mode === 'search'}
              onClick={() => setMode('search')}
            >
              成分表から探す
            </button>
            <button
              type="button"
              className={styles.tab}
              aria-pressed={mode === 'manual'}
              onClick={() => setMode('manual')}
            >
              自分で入力
            </button>
          </div>
        )}

        {mode === 'search' ? (
          <MextFoodSearch onSelect={handleSelect} />
        ) : (
          <>
            {picked && (
              <p className={styles.picked}>
                {picked.basis
                  ? `「${picked.label}」の値を入れました（${picked.basis}）。`
                  : `成分表「${displayName(picked.name)}」の値を入れました。`}
                食品名は呼びやすい名前に変えられます
              </p>
            )}

            <div className={styles.field}>
              種類
              {initialFood && (
                <span className={styles.fieldNote}>変えると、そのタブに移ります</span>
              )}
              <div className={styles.kinds} role="group" aria-label="種類">
                {(['ingredient', 'product', 'restaurant'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={styles.tab}
                    aria-pressed={kind === k}
                    onClick={() => changeKind(k)}
                  >
                    {KIND_LABELS[k]}
                    <span className={styles.tabNote}>{KIND_NOTES[k]}</span>
                  </button>
                ))}
              </div>
            </div>

            {isRestaurant && (
              <label className={styles.field}>
                店名
                <input
                  type="text"
                  placeholder="例：サイゼリヤ"
                  value={values.shop}
                  onChange={(e) => update('shop', e.target.value)}
                />
              </label>
            )}

            <label className={styles.field}>
              {isRestaurant ? 'メニュー名' : '食品名'}
              <input
                type="text"
                placeholder={isRestaurant ? '例：ミラノ風ドリア' : undefined}
                value={values.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </label>

            {kind === 'product' && (
              <label className={styles.field}>
                メーカー・ブランド（なくてもOK）
                <input
                  type="text"
                  placeholder="例：ニチレイ、セブン-イレブン"
                  value={values.brand}
                  onChange={(e) => update('brand', e.target.value)}
                />
              </label>
            )}

            {isRestaurant && (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={values.estimated}
                  onChange={(e) => update('estimated', e.target.checked)}
                />
                公式の値ではなく、見積もった値（一覧に「見積もり」と表示します）
              </label>
            )}

            {/* 何あたりの値で登録するか */}
            <p className={styles.sectionTitle}>何あたりの値で登録しますか？</p>
            {gramRef && (
              <div className={styles.tabs} role="group" aria-label="何あたりで登録するか">
                <button
                  type="button"
                  className={styles.tab}
                  aria-pressed={!byPiece}
                  onClick={() => changeMeasure(false)}
                >
                  グラムで量る
                </button>
                <button
                  type="button"
                  className={styles.tab}
                  aria-pressed={byPiece}
                  onClick={() => changeMeasure(true)}
                >
                  1個・1枚・1本で数える
                </button>
              </div>
            )}

            {byPiece ? (
              <>
                <div className={styles.row}>
                  <label className={styles.field}>
                    1つの重さ（g）
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="例：50"
                      value={pieceGrams}
                      onChange={(e) => applyPiece(values.unit, e.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    数え方
                    <select
                      value={values.unit}
                      onChange={(e) => applyPiece(e.target.value as CountUnit, pieceGrams)}
                    >
                      {COUNT_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={styles.hint}>
                  {picked?.piece
                    ? `目安：${picked.piece.note}。買っているものに合わせて変えられます`
                    : '1つの重さを入れると、1つ分のカロリーとPFCを計算します'}
                </p>
              </>
            ) : (
              <>
                <div className={styles.row}>
                  <label className={styles.field}>
                    量
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={values.baseAmount}
                      onChange={(e) => updateBaseAmount(e.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    単位
                    <select
                      value={values.unit}
                      disabled={gramRef !== null}
                      onChange={(e) => {
                        update('unit', e.target.value as Food['unit']);
                        // 単位が変わると「何倍」が決められないので、量からの計算はやめる
                        setReference(null);
                      }}
                    >
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={styles.hint}>
                  {reference
                    ? '量を変えると、カロリーとPFCも同じ割合で計算し直します（例：100g → 300g で3倍）'
                    : 'パッケージなどに書いてある「この量あたり」を入れます（例：100g、1袋、1個）'}
                </p>
              </>
            )}

            <p className={styles.sectionTitle}>
              カロリー・PFC（{values.baseAmount || '?'}
              {values.unit}あたり）
            </p>
            <div className={styles.grid}>
              {nutrientFields.map((field) => (
                <label key={field.key} className={styles.field}>
                  {field.label}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={values[field.key]}
                    onChange={(e) => updateNutrient(field.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {/* 保存済みの値で記録する（このフォームで書きかえた途中の値は使わない） */}
        {onAddToday && (
          <button type="button" className={styles.addToday} onClick={onAddToday}>
            ＋ 今日の食事に追加
          </button>
        )}

        <div className={styles.actions}>
          {onDelete && (
            <button type="button" className={styles.delete} onClick={onDelete}>
              削除
            </button>
          )}
          <button type="button" className={styles.cancel} onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className={styles.save} disabled={mode === 'search'}>
            保存
          </button>
        </div>
      </form>
    </dialog>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Food, Nutrients } from '../types';
import { calcNutrients } from '../utils/nutrition';
import { MEXT_SOURCE, displayName, pickedName, type MextFood } from '../utils/mextFoods';
import { TutorialHint } from '../tutorial/TutorialHint';
import { MextFoodSearch } from './MextFoodSearch';
import styles from './FoodFormDialog.module.css';

const UNITS: Food['unit'][] = ['g', '個', '杯', '食'];

// 入力中の値。input の中身は文字列なので、保存するときに数値へ変換する
type FormValues = {
  name: string;
  unit: Food['unit'];
  baseAmount: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
};

const emptyValues: FormValues = {
  name: '',
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
function validate(v: FormValues): string | null {
  if (v.name.trim() === '') return '食品名を入力してください';

  const base = Number(v.baseAmount);
  if (v.baseAmount === '' || !(base > 0)) return '基準量は0より大きい数値を入力してください';

  const nutrients = [v.kcal, v.protein, v.fat, v.carbs];
  const invalid = nutrients.some((n) => n === '' || Number.isNaN(Number(n)) || Number(n) < 0);
  if (invalid) return 'カロリーとP・F・Cは0以上の数値を入力してください';

  return null;
}

type Props = {
  initialFood?: Food; // 編集のときだけ渡す
  onSave: (food: Food) => void;
  onClose: () => void;
  onDelete?: () => void; // 編集のときだけ渡す
  onAddToday?: () => void; // 編集のときだけ渡す（今日の食事に追加）
};

export function FoodFormDialog({ initialFood, onSave, onClose, onDelete, onAddToday }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<FormValues>(() =>
    initialFood ? toFormValues(initialFood) : emptyValues,
  );
  const [error, setError] = useState<string | null>(null);
  // 新規追加のときだけ「成分表から探す」を選べる。最初は成分表の検索を出す
  const [mode, setMode] = useState<'search' | 'manual'>(initialFood ? 'manual' : 'search');
  // 成分表から選んだ食品（入力欄の上に「〇〇の値を入れました」と出すため）
  const [picked, setPicked] = useState<MextFood | null>(null);
  // 量を変えたら、カロリーとPFCも同じ割合で計算し直す。そのもとになる値
  //   成分表から選んだとき・登録済みの食品を編集するときだけ持つ
  //   （新しく手入力するときは、パッケージの「1袋あたり」などをそのまま入れてもらうので計算しない）
  const [reference, setReference] = useState<Reference | null>(() =>
    initialFood ? { baseAmount: initialFood.baseAmount, nutrients: initialFood } : null,
  );

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
  function handleSelect(food: MextFood) {
    setValues({
      name: pickedName(food),
      unit: 'g',
      baseAmount: '100',
      kcal: String(food.kcal),
      protein: String(food.protein),
      fat: String(food.fat),
      carbs: String(food.carbs),
    });
    setPicked(food);
    setReference({ baseAmount: 100, nutrients: food });
    setError(null);
    setMode('manual');
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault(); // ページの再読み込みを止める
    const message = validate(values);
    if (message) {
      setError(message);
      return;
    }
    // 出典：成分表から選んだときは成分表。編集のときは、もとの出典を残す
    // 2つを混ぜて計算した値（麦ごはんなど）は、計算のしかたも出典に残す
    const source = picked
      ? picked.basis
        ? `${MEXT_SOURCE}をもとに計算（${picked.basis}）`
        : MEXT_SOURCE
      : initialFood?.source;
    onSave({
      // Firestore は undefined の項目を保存できないので、出典があるときだけ入れる
      ...(source ? { source } : {}),
      id: initialFood?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      unit: values.unit,
      baseAmount: Number(values.baseAmount),
      kcal: Number(values.kcal),
      protein: Number(values.protein),
      fat: Number(values.fat),
      carbs: Number(values.carbs),
    });
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
          {initialFood ? '食品を編集' : '食品を追加'}
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

            <label className={styles.field}>
              食品名
              <input
                type="text"
                value={values.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                基準量
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
                : 'この量あたりの栄養素を入力します（例：100g あたり、1袋 あたり）'}
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

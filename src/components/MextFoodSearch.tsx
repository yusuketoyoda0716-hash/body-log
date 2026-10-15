import { useEffect, useState } from 'react';
import {
  MEXT_SOURCE,
  displayName,
  loadMextFoods,
  searchMextFoods,
  type MextFood,
} from '../utils/mextFoods';
import styles from './MextFoodSearch.module.css';

type Props = {
  onSelect: (food: MextFood) => void;
};

export function MextFoodSearch({ onSelect }: Props) {
  const [foods, setFoods] = useState<MextFood[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadMextFoods()
      .then(setFoods)
      .catch(() => setLoadError(true));
  }, []);

  const keyword = query.trim();
  const results = foods ? searchMextFoods(foods, keyword) : [];

  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        食品名で検索
        <input
          type="search"
          placeholder="例：ごはん、とり むね、カツオ"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      <p className={styles.hint}>言葉をスペースで区切ると、すべてを含む食品にしぼれます</p>

      {loadError ? (
        <p className={styles.message} role="alert">
          成分表を読み込めませんでした。通信状況を確認してください
        </p>
      ) : foods === null ? (
        <p className={styles.message}>成分表を読み込み中…</p>
      ) : keyword === '' ? null : results.length === 0 ? (
        <p className={styles.message}>「{keyword}」に一致する食品はありません</p>
      ) : (
        <>
          <p className={styles.count}>
            <span>{results.length >= 50 ? '上位50件を表示' : `${results.length}件`}</span>
            <span>100gあたり</span>
          </p>
          <ul className={styles.list}>
            {results.map((food) => (
              <li key={food.code}>
                <button type="button" className={styles.item} onClick={() => onSelect(food)}>
                  <span className={styles.info}>
                    <span className={styles.name}>{displayName(food.name)}</span>
                    <span className={styles.sub}>
                      P{food.protein} F{food.fat} C{food.carbs}
                    </span>
                  </span>
                  <span className={styles.kcal}>{food.kcal} kcal</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className={styles.source}>出典：{MEXT_SOURCE}</p>
    </div>
  );
}

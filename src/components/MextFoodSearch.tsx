import { useEffect, useState } from 'react';
import {
  MEXT_SOURCE,
  displayName,
  loadMextFoods,
  searchMextFoods,
  type MextFood,
} from '../utils/mextFoods';
import { searchPopularFoods } from '../utils/popularFoods';
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
  // よく食べるもの（分かりやすい名前）を上に出し、同じ食品は下の検索結果から外す
  const popular = foods && keyword ? searchPopularFoods(foods, keyword) : [];
  const popularCodes = new Set(popular.map((food) => food.code));
  const results = foods
    ? searchMextFoods(foods, keyword).filter((food) => !popularCodes.has(food.code))
    : [];

  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        食品名で検索
        <input
          type="search"
          placeholder="例：鶏むね肉、ごはん、カツオ"
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
      ) : keyword === '' ? null : results.length === 0 && popular.length === 0 ? (
        <p className={styles.message}>
          「{keyword}
          」に一致する食品はありません。商品の袋などに書いてある値は「自分で入力」で登録できます
        </p>
      ) : (
        <>
          {popular.length > 0 && (
            <>
              <p className={styles.count}>
                <span>
                  <span className={styles.groupTitle}>よく食べるもの </span>
                  {popular.length}件
                </span>
                <span>100gあたり</span>
              </p>
              <ul className={`${styles.list} ${styles.popularList}`}>
                {popular.map((food) => (
                  <li key={food.code}>
                    <button type="button" className={styles.item} onClick={() => onSelect(food)}>
                      <span className={styles.info}>
                        <span className={styles.name}>{food.label}</span>
                        <span className={styles.sub}>
                          P{food.protein} F{food.fat} C{food.carbs}
                        </span>
                        <span className={styles.origin}>
                          {food.basis ?? `成分表：${displayName(food.name)}`}
                        </span>
                      </span>
                      <span className={styles.kcal}>{food.kcal} kcal</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {results.length > 0 && (
            <>
              <p className={styles.count}>
                <span>
                  {popular.length > 0 && (
                    <span className={styles.groupTitle}>成分表のすべての候補 </span>
                  )}
                  {results.length >= 50 ? '上位50件を表示' : `${results.length}件`}
                </span>
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
        </>
      )}

      <p className={styles.source}>出典：{MEXT_SOURCE}</p>
    </div>
  );
}

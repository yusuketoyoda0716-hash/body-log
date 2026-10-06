import { useEffect, useState } from 'react';
import { FoodFormDialog } from '../components/FoodFormDialog';
import { useRepository } from '../repositories/repositoryContext';
import type { Food } from '../types';
import styles from './FoodsPage.module.css';

export function FoodsPage() {
  const repository = useRepository();
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [query, setQuery] = useState('');
  // ★ null = 閉じている / 'new' = 新規追加 / Food = その食品を編集中
  const [editing, setEditing] = useState<Food | 'new' | null>(null);

  useEffect(() => {
    repository.getFoods().then(setFoods);
  }, [repository]);

  async function handleSave(food: Food) {
    await repository.saveFood(food);
    setFoods(await repository.getFoods());
    setEditing(null);
  }

  // ★ 削除（確認してから）
  async function handleDelete(food: Food) {
    if (!window.confirm(`「${food.name}」を削除しますか？`)) return;
    await repository.deleteFood(food.id);
    setFoods(await repository.getFoods());
    setEditing(null);
  }

  const keyword = query.trim();
  const visibleFoods = foods?.filter((food) => food.name.includes(keyword)) ?? [];

  return (
    <>
      <div className={styles.header}>
        <h1>登録食品</h1>
        <button type="button" className={styles.addButton} onClick={() => setEditing('new')}>
          ＋ 追加
        </button>
      </div>

      <label className={styles.search}>
        検索
        <input
          type="search"
          placeholder="食品名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {foods === null ? (
        <p className={styles.message}>読み込み中…</p>
      ) : visibleFoods.length === 0 ? (
        <p className={styles.message}>
          {keyword ? `「${keyword}」に一致する食品はありません` : 'まだ食品が登録されていません'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visibleFoods.map((food) => (
            <li key={food.id}>
              {/* ★ 行全体をボタンにして、タップで編集 */}
              <button type="button" className={styles.item} onClick={() => setEditing(food)}>
                <span className={styles.info}>
                  <span className={styles.name}>{food.name}</span>
                  <span className={styles.sub}>
                    {food.baseAmount}
                    {food.unit} あたり
                  </span>
                </span>
                <span className={styles.nutrients}>
                  <span className={styles.kcal}>{food.kcal} kcal</span>
                  <span className={styles.sub}>
                    P{food.protein} F{food.fat} C{food.carbs}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ★ 新規と編集で同じフォームを使い回す */}
      {editing === 'new' && (
        <FoodFormDialog onSave={handleSave} onClose={() => setEditing(null)} />
      )}
      {editing !== null && editing !== 'new' && (
        <FoodFormDialog
          initialFood={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onDelete={() => handleDelete(editing)}
        />
      )}
    </>
  );
}

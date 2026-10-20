import type { BodyGoal, BodyRecord, Food, Goals, MealEntry, Recipe } from '../types';
import type { DataRepository } from './DataRepository';
import { createSampleData, defaultGoals, type Store } from './sampleData';

const STORAGE_KEY = 'body-log:v1';
// チュートリアルを見終わったか。「サンプルデータに戻す」で消えないように、データとは別に保存する
const TUTORIAL_KEY = 'body-log:tutorialDone';

// 保存されているデータを読み込む。なければ見本データで初期化
function load(): Store {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const store = JSON.parse(raw) as Store;
    // 古いデータにない目標（炭水化物など）は初期値で補う
    store.goals = { ...defaultGoals, ...store.goals };
    // レシピの機能を追加する前のデータには recipes がない
    store.recipes ??= [];
    return store;
  }
  const initial = createSampleData();
  save(initial);
  return initial;
}

// データ全体を保存する
function save(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// 同じidがあれば置き換え、なければ追加
function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const exists = list.some((x) => x.id === item.id);
  return exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export class LocalStorageRepository implements DataRepository {
  // ---- 登録食品 ----
  async getFoods(): Promise<Food[]> {
    return load().foods;
  }
  async saveFood(food: Food): Promise<void> {
    const s = load();
    s.foods = upsert(s.foods, food);
    save(s);
  }
  async deleteFood(id: string): Promise<void> {
    const s = load();
    s.foods = s.foods.filter((f) => f.id !== id);
    save(s);
  }

  // ---- レシピ ----
  async getRecipes(): Promise<Recipe[]> {
    return load().recipes;
  }
  async saveRecipe(recipe: Recipe): Promise<void> {
    const s = load();
    s.recipes = upsert(s.recipes, recipe);
    save(s);
  }
  async deleteRecipe(id: string): Promise<void> {
    const s = load();
    s.recipes = s.recipes.filter((r) => r.id !== id);
    save(s);
  }

  // ---- 食事記録 ----
  async getEntriesByDate(date: string): Promise<MealEntry[]> {
    return load().entries.filter((e) => e.date === date);
  }
  async getEntriesInRange(from: string, to: string): Promise<MealEntry[]> {
    return load().entries.filter((e) => e.date >= from && e.date <= to);
  }
  async saveEntry(entry: MealEntry): Promise<void> {
    const s = load();
    s.entries = upsert(s.entries, entry);
    save(s);
  }
  async deleteEntry(id: string): Promise<void> {
    const s = load();
    s.entries = s.entries.filter((e) => e.id !== id);
    save(s);
  }

  // ---- 食事の目標 ----
  async getGoals(): Promise<Goals> {
    return load().goals;
  }
  async saveGoals(goals: Goals): Promise<void> {
    const s = load();
    s.goals = goals;
    save(s);
  }

  // ---- 体重・体脂肪率 ----
  async getBodyRecords(): Promise<BodyRecord[]> {
    return load().bodyRecords;
  }
  async saveBodyRecord(record: BodyRecord): Promise<void> {
    const s = load();
    // 1日1件なので、同じ日付の記録を消してから追加し、日付順に並べる
    s.bodyRecords = [...s.bodyRecords.filter((r) => r.date !== record.date), record].sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    save(s);
  }

  // ---- 体組成の目標 ----
  async getBodyGoal(): Promise<BodyGoal> {
    return load().bodyGoal;
  }
  async saveBodyGoal(goal: BodyGoal): Promise<void> {
    const s = load();
    s.bodyGoal = goal;
    save(s);
  }

  // ---- リセット ----
  // ---- チュートリアル ----
  async isTutorialDone(): Promise<boolean> {
    return localStorage.getItem(TUTORIAL_KEY) !== null;
  }
  async markTutorialDone(): Promise<void> {
    localStorage.setItem(TUTORIAL_KEY, new Date().toISOString());
  }

  async reset(): Promise<void> {
    // 消しておけば、次に読み込んだときにサンプルデータで初期化される
    localStorage.removeItem(STORAGE_KEY);
  }
}

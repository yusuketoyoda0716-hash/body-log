import type { BodyGoal, BodyRecord, Food, Goals, MealEntry, Recipe } from '../types';

export interface DataRepository {
  // 登録食品
  getFoods(): Promise<Food[]>;
  saveFood(food: Food): Promise<void>; // 新規・更新どちらもこれ
  deleteFood(id: string): Promise<void>;

  // レシピ（料理）
  getRecipes(): Promise<Recipe[]>;
  saveRecipe(recipe: Recipe): Promise<void>; // 新規・更新どちらもこれ
  deleteRecipe(id: string): Promise<void>;

  // 食事記録
  getEntriesByDate(date: string): Promise<MealEntry[]>;
  getEntriesInRange(from: string, to: string): Promise<MealEntry[]>; // 週平均用
  saveEntry(entry: MealEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  // 食事の目標
  getGoals(): Promise<Goals>;
  saveGoals(goals: Goals): Promise<void>;

  // 体重・体脂肪率（1日1件、dateで上書き）
  getBodyRecords(): Promise<BodyRecord[]>;
  saveBodyRecord(record: BodyRecord): Promise<void>;

  // 体組成の目標
  getBodyGoal(): Promise<BodyGoal>;
  saveBodyGoal(goal: BodyGoal): Promise<void>;

  // チュートリアルを見終わったか（スキップも含む）
  isTutorialDone(): Promise<boolean>;
  markTutorialDone(): Promise<void>;

  // すべて消して初期状態に戻す（ゲスト用。保存先によっては存在しない）
  reset?(): Promise<void>;
}

import type { BodyGoal, BodyRecord, Food, Goals, MealEntry } from '../types';

export interface DataRepository {
  // 登録食品
  getFoods(): Promise<Food[]>;
  saveFood(food: Food): Promise<void>; // 新規・更新どちらもこれ
  deleteFood(id: string): Promise<void>;

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
}

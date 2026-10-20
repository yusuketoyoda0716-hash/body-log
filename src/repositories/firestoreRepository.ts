import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { app } from '../lib/firebase';
import type { BodyGoal, BodyRecord, Food, Goals, MealEntry, Recipe } from '../types';
import type { DataRepository } from './DataRepository';
import { defaultBodyGoal, defaultGoals } from './sampleData';

// このファイルが読み込まれたとき（＝ログインしたとき）に Firestore を用意する
const db = getFirestore(app);

export class FirestoreRepository implements DataRepository {
  private readonly uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }

  // users/{uid}/foods などのコレクション
  private col(name: 'foods' | 'recipes' | 'entries' | 'bodyRecords') {
    return collection(db, 'users', this.uid, name);
  }

  // users/{uid}/settings/goals などのドキュメント
  private settingsDoc(name: 'goals' | 'bodyGoal') {
    return doc(db, 'users', this.uid, 'settings', name);
  }

  // ---- 登録食品 ----
  async getFoods(): Promise<Food[]> {
    const snap = await getDocs(this.col('foods'));
    // Firestore は順番がバラバラなので、名前順に並べる
    return snap.docs
      .map((d) => d.data() as Food)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
  async saveFood(food: Food): Promise<void> {
    await setDoc(doc(this.col('foods'), food.id), food);
  }
  async deleteFood(id: string): Promise<void> {
    await deleteDoc(doc(this.col('foods'), id));
  }

  // ---- レシピ ----
  async getRecipes(): Promise<Recipe[]> {
    const snap = await getDocs(this.col('recipes'));
    return snap.docs
      .map((d) => d.data() as Recipe)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
  async saveRecipe(recipe: Recipe): Promise<void> {
    await setDoc(doc(this.col('recipes'), recipe.id), recipe);
  }
  async deleteRecipe(id: string): Promise<void> {
    await deleteDoc(doc(this.col('recipes'), id));
  }

  // ---- 食事記録 ----
  async getEntriesByDate(date: string): Promise<MealEntry[]> {
    const snap = await getDocs(query(this.col('entries'), where('date', '==', date)));
    return snap.docs.map((d) => d.data() as MealEntry);
  }
  async getEntriesInRange(from: string, to: string): Promise<MealEntry[]> {
    const q = query(this.col('entries'), where('date', '>=', from), where('date', '<=', to));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MealEntry);
  }
  async saveEntry(entry: MealEntry): Promise<void> {
    await setDoc(doc(this.col('entries'), entry.id), entry);
  }
  async deleteEntry(id: string): Promise<void> {
    await deleteDoc(doc(this.col('entries'), id));
  }

  // ---- 食事の目標（まだ保存していなければ初期値） ----
  async getGoals(): Promise<Goals> {
    const snap = await getDoc(this.settingsDoc('goals'));
    // 古いデータにない目標（炭水化物など）は初期値で補う
    return snap.exists() ? { ...defaultGoals, ...(snap.data() as Partial<Goals>) } : defaultGoals;
  }
  async saveGoals(goals: Goals): Promise<void> {
    await setDoc(this.settingsDoc('goals'), goals);
  }

  // ---- 体重・体脂肪率（日付をIDにするので、同じ日は自動で上書き） ----
  async getBodyRecords(): Promise<BodyRecord[]> {
    const snap = await getDocs(query(this.col('bodyRecords'), orderBy('date')));
    return snap.docs.map((d) => d.data() as BodyRecord);
  }
  async saveBodyRecord(record: BodyRecord): Promise<void> {
    await setDoc(doc(this.col('bodyRecords'), record.date), record);
  }

  // ---- 体組成の目標 ----
  async getBodyGoal(): Promise<BodyGoal> {
    const snap = await getDoc(this.settingsDoc('bodyGoal'));
    return snap.exists() ? (snap.data() as BodyGoal) : defaultBodyGoal;
  }
  async saveBodyGoal(goal: BodyGoal): Promise<void> {
    await setDoc(this.settingsDoc('bodyGoal'), goal);
  }

  // reset() はあえて実装しない（本番データを一括で消せないようにする）
}

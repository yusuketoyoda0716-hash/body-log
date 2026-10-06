export type Nutrients = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

// 登録食品：baseAmount あたりの栄養素を持つ（例：100gあたり、1個あたり）
export type Food = Nutrients & {
  id: string;
  name: string;
  unit: 'g' | '個' | '杯' | '食';
  baseAmount: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// 食事記録：記録時点の食品名と栄養素をコピーして持つ
export type MealEntry = Nutrients & {
  id: string;
  date: string; // 'YYYY-MM-DD'
  mealType: MealType;
  foodId: string;
  foodName: string;
  amount: number;
};

export type Range = { min: number; max: number };

export type Goals = {
  kcal: Range;
  protein: Range;
  fat: Range;
};

export type BodyRecord = {
  date: string;
  weight: number;
  bodyFat: number;
};

// 体組成の目標（未設定もあり得るので null 許容）
export type BodyGoal = {
  weight: number | null;
  bodyFat: number | null;
  deadline: string | null; // 'YYYY-MM-DD'
};
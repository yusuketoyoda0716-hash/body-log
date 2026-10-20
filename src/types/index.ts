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

// レシピの材料：材料の食品の「基準量あたりの値」と、使った量を持つ
//   例：豚バラ肉（100gあたり 366kcal）を 300g
export type RecipeIngredient = Nutrients & {
  name: string;
  unit: Food['unit'];
  baseAmount: number; // kcal などは、この量あたりの値
  amount: number; // 使った量
  ref: string | null; // 元の食品（登録食品の id や 'mext:食品番号'）。手入力なら null
};

// レシピ（料理）：材料の合計を servings（何食分）で割った「1食あたり」の値を持つ
export type Recipe = Nutrients & {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// 食事記録：記録時点の食品名・単位・栄養素をコピーして持つ
export type MealEntry = Nutrients & {
  id: string;
  date: string; // 'YYYY-MM-DD'
  mealType: MealType;
  foodId: string;
  foodName: string;
  unit: Food['unit'];
  amount: number;
};

export type Range = { min: number; max: number };

export type Goals = {
  kcal: Range;
  protein: Range;
  fat: Range;
  carbs: Range;
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
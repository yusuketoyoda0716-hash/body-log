export type Nutrients = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

// 登録食品：baseAmount あたりの栄養素を持つ（例：100gあたり、1個あたり）
// 食材：肉・魚・野菜・ごはんなど素材そのもの（成分表から登録するもの）
// 市販品：冷凍食品・総菜・コンビニ商品・お菓子など、パッケージに栄養成分が書いてある商品
export type FoodCategory = 'ingredient' | 'product';

export type Food = Nutrients & {
  id: string;
  name: string;
  unit: 'g' | '個' | '枚' | '本' | '杯' | '皿' | '食';
  baseAmount: number;
  source?: string; // 値の出典（成分表、調べたサイト名や URL など）。自分で入力した食品にはない
  category?: FoodCategory; // 食材か市販品か（外食のメニューには付けない）。ない古いデータは出典から決める
  shop?: string; // 外食のメニューなら店名（例：サイゼリヤ）。あると「外食」タブに出る
  brand?: string; // 市販品のメーカー・ブランド・買ったお店（例：ニチレイ、セブン-イレブン）
  estimated?: boolean; // 公式の値ではなく、見積もった値のメニュー（外食で、形が決まった料理だけ残す）
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
  estimated?: boolean; // 量や値を見積もった記録（外食・写真から見積もったときなど）。今日の画面に「見積もり」と出す
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

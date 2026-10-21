// Tipos compartidos del motor de FITAI PRO.
// Este módulo es TypeScript puro: se usa en la app (Metro), en las pruebas (Node)
// y en las funciones del servidor (Deno). No importes nada de React Native aquí.

export type Lang = 'es' | 'en';
export type UnitSystem = 'metric' | 'imperial';
export type Sex = 'male' | 'female' | 'unspecified';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export type Goal =
  | 'fat_loss'
  | 'muscle_gain'
  | 'recomposition'
  | 'toning'
  | 'strength'
  | 'endurance'
  | 'maintenance';

export const GOALS: Goal[] = [
  'fat_loss',
  'muscle_gain',
  'recomposition',
  'toning',
  'strength',
  'endurance',
  'maintenance',
];

export type JobActivity = 'sedentary' | 'moderate' | 'demanding';
export type CardioIntensity = 'light' | 'moderate' | 'vigorous';
export type TrainingLocation = 'gym' | 'home' | 'both';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bench'
  | 'pullup_bar'
  | 'bands'
  | 'kettlebell'
  | 'bodyweight';

export const ALL_EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bench',
  'pullup_bar',
  'bands',
  'kettlebell',
  'bodyweight',
];

export type BodyArea =
  | 'shoulder'
  | 'knee'
  | 'lower_back'
  | 'wrist'
  | 'elbow'
  | 'hip'
  | 'neck'
  | 'ankle';

export const BODY_AREAS: BodyArea[] = [
  'shoulder',
  'knee',
  'lower_back',
  'wrist',
  'elbow',
  'hip',
  'neck',
  'ankle',
];

export type Allergen =
  | 'gluten'
  | 'dairy'
  | 'lactose'
  | 'egg'
  | 'fish'
  | 'shellfish'
  | 'soy'
  | 'peanut'
  | 'tree_nut'
  | 'sesame';

export const ALLERGENS: Allergen[] = [
  'gluten',
  'dairy',
  'lactose',
  'egg',
  'fish',
  'shellfish',
  'soy',
  'peanut',
  'tree_nut',
  'sesame',
];

export type DietStyle = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian';
export type BudgetLevel = 'low' | 'medium' | 'high';
export type CookingTime = 'minimal' | 'some' | 'plenty'; // <15, 15-30, >30 min por comida
export type PrepStyle = 'daily' | 'batch';

/** Respuesta de salud en tres estados: el usuario puede preferir no responder. */
export type TriState = 'yes' | 'no' | 'prefer_not';

export type MedicalCondition =
  | 'diabetes'
  | 'heart'
  | 'hypertension'
  | 'kidney'
  | 'other_under_care';

export interface HealthAnswers {
  pregnantOrBreastfeeding: TriState;
  eatingDisorderHistory: TriState;
  conditions: MedicalCondition[];
  injuries: BodyArea[];
  /** El usuario declara que un profesional le ha pedido evitar ejercicio intenso. */
  advisedToAvoidExercise: boolean;
}

export interface UserProfile {
  version: 1;
  lang: Lang;
  units: UnitSystem;
  country: string; // código ISO, p. ej. "US"
  // Básicos (siempre almacenados en métrico)
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  goal: Goal;
  // Experiencia
  level: Level;
  monthsTraining: number;
  daysPerWeek: number; // 1..7
  sessionMinutes: number; // 20..120
  location: TrainingLocation;
  equipment: Equipment[];
  preferredExercises: string[]; // ids de ejercicios
  excludedExercises: string[]; // ids de ejercicios
  // Actividad diaria
  job: JobActivity;
  dailySteps?: number;
  cardioMinutesPerWeek: number;
  cardioIntensity: CardioIntensity;
  sleepHours?: number;
  // Alimentación
  diet: DietStyle;
  allergens: Allergen[];
  excludedFoods: string[]; // ids de alimentos
  favoriteFoods: string[]; // ids de alimentos
  weeklyFoodBudgetUsd?: number;
  budget: BudgetLevel;
  cookingTime: CookingTime;
  mealsPerDay: number; // 3..5
  prepStyle: PrepStyle;
  // Salud
  health: HealthAnswers;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type Confidence = 'measured' | 'estimated' | 'observed' | 'unknown';

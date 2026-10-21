// Plantillas de recetas. Las cantidades NO son fijas: el generador escala los
// ingredientes con rol P (proteína), C (carbohidrato) y F (grasa) para acercarse
// al objetivo de cada comida; las verduras (rol V) se mantienen en su cantidad base.
// Los valores nutricionales se calculan siempre desde la base de datos de alimentos.

export type MealType = 'breakfast' | 'main' | 'snack';
export type Role = 'P' | 'C' | 'F' | 'V';

export interface RecipeIngredient {
  foodId: string;
  role: Role;
  baseG: number;
  minG: number;
  maxG: number;
  stepG: number; // redondeo práctico (o peso de unidad para huevos/tortillas)
  /** Alimentos alternativos válidos para sustituir este ingrediente. */
  alternatives?: string[];
}

export interface RecipeTemplate {
  id: string;
  name: { es: string; en: string };
  mealTypes: MealType[];
  prepMinutes: number;
  ingredients: RecipeIngredient[];
  seasonings: { es: string; en: string }; // no cuantificados, energía despreciable
  steps: { es: string[]; en: string[] };
  batchFriendly: boolean;
}

const ing = (
  foodId: string,
  role: Role,
  baseG: number,
  minG: number,
  maxG: number,
  stepG = 5,
  alternatives?: string[],
): RecipeIngredient => ({ foodId, role, baseG, minG, maxG, stepG, alternatives });

const PROTEIN_SWAPS_LEAN = ['chicken_breast', 'ground_turkey_93', 'pork_tenderloin', 'tilapia', 'shrimp', 'tofu', 'tempeh'];
const CARB_SWAPS_GRAIN = ['white_rice', 'quinoa', 'pasta', 'potato', 'sweet_potato'];
const FAT_SWAPS = ['olive_oil', 'avocado'];

export const RECIPES: RecipeTemplate[] = [
  // ---------------- Desayunos ----------------
  {
    id: 'oats_banana_pb',
    name: { es: 'Avena con plátano, yogur y crema de cacahuate', en: 'Oats with banana, yogurt and peanut butter' },
    mealTypes: ['breakfast'],
    prepMinutes: 10,
    ingredients: [
      ing('oats', 'C', 60, 30, 120),
      ing('greek_yogurt', 'P', 170, 100, 350, 10),
      ing('banana', 'V', 60, 60, 60),
      ing('peanut_butter', 'F', 15, 5, 40, 5, ['almonds', 'walnuts', 'chia']),
    ],
    seasonings: { es: 'Canela al gusto', en: 'Cinnamon to taste' },
    steps: {
      es: [
        'Cuece la avena con agua (unas 2 partes de agua por 1 de avena) de 3 a 5 minutos.',
        'Retira del fuego, añade el plátano en rodajas y la canela.',
        'Sirve con el yogur griego encima y la crema de cacahuate.',
      ],
      en: [
        'Cook the oats in water (about 2 parts water to 1 part oats) for 3–5 minutes.',
        'Remove from heat, add sliced banana and cinnamon.',
        'Top with the Greek yogurt and the peanut butter.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'eggs_spinach_tortilla',
    name: { es: 'Huevos revueltos con espinaca, tortillas y aguacate', en: 'Scrambled eggs with spinach, tortillas and avocado' },
    mealTypes: ['breakfast'],
    prepMinutes: 12,
    ingredients: [
      ing('egg', 'P', 100, 50, 200, 50),
      ing('egg_white', 'P', 100, 0, 250, 10),
      ing('spinach', 'V', 60, 60, 60),
      ing('corn_tortilla', 'C', 52, 26, 156, 26, ['whole_wheat_bread']),
      ing('avocado', 'F', 40, 0, 120, 10, ['olive_oil']),
    ],
    seasonings: { es: 'Sal, pimienta y salsa al gusto', en: 'Salt, pepper and salsa to taste' },
    steps: {
      es: [
        'Saltea la espinaca 1 minuto en un sartén antiadherente.',
        'Bate los huevos con las claras y revuélvelos con la espinaca a fuego medio.',
        'Calienta las tortillas y sirve con el aguacate en rebanadas.',
      ],
      en: [
        'Sauté the spinach for 1 minute in a non-stick pan.',
        'Whisk the eggs with the whites and scramble with the spinach over medium heat.',
        'Warm the tortillas and serve with sliced avocado.',
      ],
    },
    batchFriendly: false,
  },
  {
    id: 'yogurt_berries_oats',
    name: { es: 'Yogur griego con frutos rojos, avena y almendras', en: 'Greek yogurt with berries, oats and almonds' },
    mealTypes: ['breakfast', 'snack'],
    prepMinutes: 5,
    ingredients: [
      ing('greek_yogurt', 'P', 200, 100, 400, 10),
      ing('blueberries', 'V', 75, 75, 75, 5, ['strawberries']),
      ing('oats', 'C', 30, 0, 90),
      ing('almonds', 'F', 15, 0, 40, 5, ['walnuts', 'chia']),
    ],
    seasonings: { es: 'Canela o vainilla al gusto', en: 'Cinnamon or vanilla to taste' },
    steps: {
      es: ['Sirve el yogur en un tazón.', 'Añade la avena cruda, los frutos rojos y las almendras picadas.'],
      en: ['Spoon the yogurt into a bowl.', 'Top with the raw oats, berries and chopped almonds.'],
    },
    batchFriendly: true,
  },
  {
    id: 'tofu_scramble_toast',
    name: { es: 'Tofu revuelto con pimiento y pan integral', en: 'Tofu scramble with bell pepper and whole-wheat toast' },
    mealTypes: ['breakfast'],
    prepMinutes: 15,
    ingredients: [
      ing('tofu', 'P', 200, 100, 400, 10),
      ing('red_bell_pepper', 'V', 80, 80, 80),
      ing('spinach', 'V', 40, 40, 40),
      ing('whole_wheat_bread', 'C', 64, 32, 128, 32, ['corn_tortilla']),
      ing('olive_oil', 'F', 5, 0, 20, 5, ['avocado']),
    ],
    seasonings: { es: 'Cúrcuma, comino, sal y pimienta', en: 'Turmeric, cumin, salt and pepper' },
    steps: {
      es: [
        'Desmenuza el tofu con un tenedor.',
        'Saltea el pimiento en el aceite 3 minutos, añade el tofu, la espinaca y las especias.',
        'Cocina 5 minutos y sirve con el pan tostado.',
      ],
      en: [
        'Crumble the tofu with a fork.',
        'Sauté the pepper in the oil for 3 minutes, add the tofu, spinach and spices.',
        'Cook for 5 minutes and serve with the toast.',
      ],
    },
    batchFriendly: false,
  },
  {
    id: 'oats_chia_vegan',
    name: { es: 'Avena con chía, plátano y crema de cacahuate', en: 'Oats with chia, banana and peanut butter' },
    mealTypes: ['breakfast'],
    prepMinutes: 8,
    ingredients: [
      ing('oats', 'C', 70, 40, 130),
      ing('chia', 'V', 15, 15, 15),
      ing('banana', 'V', 80, 80, 80),
      ing('peanut_butter', 'F', 20, 5, 45, 5, ['almonds']),
    ],
    seasonings: { es: 'Canela al gusto', en: 'Cinnamon to taste' },
    steps: {
      es: ['Cuece la avena en agua 3–5 minutos.', 'Añade la chía, el plátano y la crema de cacahuate.'],
      en: ['Cook the oats in water for 3–5 minutes.', 'Stir in chia, banana and peanut butter.'],
    },
    batchFriendly: true,
  },
  // ---------------- Comidas y cenas ----------------
  {
    id: 'chicken_rice_broccoli',
    name: { es: 'Pollo con arroz y brócoli', en: 'Chicken with rice and broccoli' },
    mealTypes: ['main'],
    prepMinutes: 25,
    ingredients: [
      ing('chicken_breast', 'P', 150, 80, 300, 10, PROTEIN_SWAPS_LEAN),
      ing('white_rice', 'C', 70, 30, 160, 5, CARB_SWAPS_GRAIN),
      ing('broccoli', 'V', 150, 150, 150),
      ing('olive_oil', 'F', 8, 0, 25, 1, FAT_SWAPS),
    ],
    seasonings: { es: 'Sal, ajo en polvo, pimentón y limón', en: 'Salt, garlic powder, paprika and lemon' },
    steps: {
      es: [
        'Cuece el arroz (peso en seco) con el doble de agua, unos 18 minutos.',
        'Sazona el pollo y cocínalo en la mitad del aceite hasta 74 °C (165 °F) en el centro.',
        'Cuece el brócoli al vapor 5 minutos y rocía el aceite restante.',
      ],
      en: [
        'Cook the rice (dry weight) in twice its volume of water, about 18 minutes.',
        'Season the chicken and cook it in half the oil to an internal 165 °F (74 °C).',
        'Steam the broccoli for 5 minutes and drizzle with the remaining oil.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'salmon_potato_greenbeans',
    name: { es: 'Salmón con papa y ejotes', en: 'Salmon with potato and green beans' },
    mealTypes: ['main'],
    prepMinutes: 30,
    ingredients: [
      ing('salmon', 'P', 140, 80, 260, 10, ['tilapia', 'chicken_breast', 'tofu']),
      ing('potato', 'C', 250, 100, 550, 10, ['sweet_potato']),
      ing('green_beans', 'V', 150, 150, 150),
      ing('olive_oil', 'F', 3, 0, 15, 1),
    ],
    seasonings: { es: 'Sal, eneldo, limón y pimienta', en: 'Salt, dill, lemon and pepper' },
    steps: {
      es: [
        'Hornea la papa en cubos a 200 °C (400 °F) por 25 minutos con la mitad del aceite.',
        'Hornea el salmón sazonado de 12 a 15 minutos en la misma bandeja.',
        'Cuece los ejotes al vapor 6 minutos.',
      ],
      en: [
        'Roast the diced potato at 400 °F (200 °C) for 25 minutes with half the oil.',
        'Bake the seasoned salmon for 12–15 minutes on the same tray.',
        'Steam the green beans for 6 minutes.',
      ],
    },
    batchFriendly: false,
  },
  {
    id: 'beef_pasta_tomato',
    name: { es: 'Pasta con carne molida y salsa de jitomate', en: 'Pasta with ground beef and tomato sauce' },
    mealTypes: ['main'],
    prepMinutes: 25,
    ingredients: [
      ing('ground_beef_90', 'P', 130, 70, 260, 10, ['ground_turkey_93', 'lentils_cooked']),
      ing('pasta', 'C', 75, 30, 170, 5),
      ing('tomato', 'V', 150, 150, 150),
      ing('onion', 'V', 50, 50, 50),
      ing('olive_oil', 'F', 3, 0, 15, 1),
    ],
    seasonings: { es: 'Ajo, orégano, albahaca y sal', en: 'Garlic, oregano, basil and salt' },
    steps: {
      es: [
        'Cuece la pasta (peso en seco) según el empaque.',
        'Sofríe la cebolla y el ajo en el aceite, añade la carne y dórala bien.',
        'Agrega el jitomate picado y las hierbas; cocina 10 minutos y mezcla con la pasta.',
      ],
      en: [
        'Cook the pasta (dry weight) according to the package.',
        'Sauté onion and garlic in the oil, add the beef and brown it well.',
        'Add chopped tomato and herbs; simmer 10 minutes and toss with the pasta.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'turkey_tacos',
    name: { es: 'Tacos de pavo con verduras', en: 'Turkey tacos with vegetables' },
    mealTypes: ['main'],
    prepMinutes: 20,
    ingredients: [
      ing('ground_turkey_93', 'P', 140, 70, 280, 10, ['chicken_breast', 'ground_beef_90', 'black_beans_cooked']),
      ing('corn_tortilla', 'C', 78, 52, 208, 26),
      ing('romaine', 'V', 50, 50, 50),
      ing('tomato', 'V', 80, 80, 80),
      ing('avocado', 'F', 40, 0, 120, 10),
    ],
    seasonings: { es: 'Comino, chile en polvo, sal, cilantro y limón', en: 'Cumin, chili powder, salt, cilantro and lime' },
    steps: {
      es: [
        'Cocina el pavo con las especias en un sartén antiadherente hasta que no quede rosado.',
        'Calienta las tortillas.',
        'Arma los tacos con la lechuga, el jitomate y el aguacate.',
      ],
      en: [
        'Cook the turkey with the spices in a non-stick pan until no longer pink.',
        'Warm the tortillas.',
        'Assemble with lettuce, tomato and avocado.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'quinoa_chickpea_bowl',
    name: { es: 'Bowl de quinoa con garbanzos y verduras', en: 'Quinoa bowl with chickpeas and vegetables' },
    mealTypes: ['main'],
    prepMinutes: 20,
    ingredients: [
      ing('chickpeas_cooked', 'P', 150, 80, 330, 10, ['black_beans_cooked', 'lentils_cooked', 'tempeh']),
      ing('quinoa', 'C', 50, 20, 120, 5, ['white_rice']),
      ing('cucumber', 'V', 100, 100, 100),
      ing('tomato', 'V', 100, 100, 100),
      ing('olive_oil', 'F', 8, 0, 25, 1, ['avocado']),
    ],
    seasonings: { es: 'Limón, sal, pimienta y perejil', en: 'Lemon, salt, pepper and parsley' },
    steps: {
      es: [
        'Enjuaga la quinoa y cuécela con el doble de agua 15 minutos.',
        'Pica el pepino y el jitomate.',
        'Mezcla todo con los garbanzos, el aceite, el limón y las especias.',
      ],
      en: [
        'Rinse the quinoa and simmer it in twice its volume of water for 15 minutes.',
        'Dice the cucumber and tomato.',
        'Toss everything with the chickpeas, oil, lemon and seasoning.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'lentil_stew_rice',
    name: { es: 'Lentejas guisadas con arroz', en: 'Lentil stew with rice' },
    mealTypes: ['main'],
    prepMinutes: 30,
    ingredients: [
      ing('lentils_cooked', 'P', 200, 100, 400, 10, ['black_beans_cooked', 'chickpeas_cooked']),
      ing('white_rice', 'C', 50, 0, 130, 5, ['quinoa']),
      ing('carrot', 'V', 80, 80, 80),
      ing('onion', 'V', 50, 50, 50),
      ing('olive_oil', 'F', 8, 0, 25, 1),
    ],
    seasonings: { es: 'Ajo, comino, laurel y sal', en: 'Garlic, cumin, bay leaf and salt' },
    steps: {
      es: [
        'Sofríe la cebolla, el ajo y la zanahoria en el aceite 5 minutos.',
        'Añade las lentejas cocidas, especias y un poco de agua; cocina 15 minutos.',
        'Sirve con el arroz cocido (peso indicado en seco).',
      ],
      en: [
        'Sauté onion, garlic and carrot in the oil for 5 minutes.',
        'Add the cooked lentils, spices and a splash of water; simmer 15 minutes.',
        'Serve with the cooked rice (weight given as dry).',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'tilapia_sweetpotato_spinach',
    name: { es: 'Tilapia con camote y espinaca', en: 'Tilapia with sweet potato and spinach' },
    mealTypes: ['main'],
    prepMinutes: 25,
    ingredients: [
      ing('tilapia', 'P', 170, 90, 320, 10, ['salmon', 'chicken_breast', 'shrimp']),
      ing('sweet_potato', 'C', 220, 100, 500, 10, ['potato']),
      ing('spinach', 'V', 80, 80, 80),
      ing('olive_oil', 'F', 8, 0, 25, 1),
    ],
    seasonings: { es: 'Ajo, limón, sal y pimentón', en: 'Garlic, lemon, salt and paprika' },
    steps: {
      es: [
        'Hornea el camote en cubos a 200 °C (400 °F) por 25 minutos.',
        'Cocina la tilapia sazonada en la mitad del aceite 3–4 minutos por lado.',
        'Saltea la espinaca con el aceite restante 1 minuto.',
      ],
      en: [
        'Roast the diced sweet potato at 400 °F (200 °C) for 25 minutes.',
        'Pan-cook the seasoned tilapia in half the oil, 3–4 minutes per side.',
        'Wilt the spinach in the remaining oil for 1 minute.',
      ],
    },
    batchFriendly: false,
  },
  {
    id: 'shrimp_rice_stirfry',
    name: { es: 'Camarones salteados con arroz y verduras', en: 'Shrimp stir-fry with rice and vegetables' },
    mealTypes: ['main'],
    prepMinutes: 20,
    ingredients: [
      ing('shrimp', 'P', 170, 90, 320, 10, ['chicken_breast', 'tofu', 'tempeh']),
      ing('white_rice', 'C', 70, 30, 160, 5, ['quinoa']),
      ing('red_bell_pepper', 'V', 80, 80, 80),
      ing('zucchini', 'V', 100, 100, 100),
      ing('olive_oil', 'F', 8, 0, 25, 1),
    ],
    seasonings: { es: 'Ajo, jengibre, limón y sal', en: 'Garlic, ginger, lime and salt' },
    steps: {
      es: [
        'Cuece el arroz (peso en seco).',
        'Saltea las verduras en el aceite a fuego alto 4 minutos.',
        'Añade los camarones y cocina 2–3 minutos hasta que estén rosados y opacos.',
      ],
      en: [
        'Cook the rice (dry weight).',
        'Stir-fry the vegetables in the oil over high heat for 4 minutes.',
        'Add the shrimp and cook 2–3 minutes until pink and opaque.',
      ],
    },
    batchFriendly: false,
  },
  {
    id: 'tempeh_rice_broccoli',
    name: { es: 'Tempeh salteado con arroz y brócoli', en: 'Tempeh stir-fry with rice and broccoli' },
    mealTypes: ['main'],
    prepMinutes: 20,
    ingredients: [
      ing('tempeh', 'P', 120, 60, 240, 10, ['tofu', 'chickpeas_cooked']),
      ing('white_rice', 'C', 60, 20, 150, 5, ['quinoa']),
      ing('broccoli', 'V', 150, 150, 150),
      ing('olive_oil', 'F', 5, 0, 20, 1),
    ],
    seasonings: { es: 'Ajo, jengibre y salsa de soya baja en sodio (contiene soya y trigo)', en: 'Garlic, ginger and low-sodium soy sauce (contains soy and wheat)' },
    steps: {
      es: [
        'Cuece el arroz (peso en seco).',
        'Corta el tempeh en cubos y dóralo en el aceite 6 minutos.',
        'Añade el brócoli y los condimentos; saltea 4 minutos más.',
      ],
      en: [
        'Cook the rice (dry weight).',
        'Cube the tempeh and brown it in the oil for 6 minutes.',
        'Add the broccoli and seasonings; stir-fry 4 more minutes.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'tofu_quinoa_stirfry',
    name: { es: 'Tofu salteado con quinoa y verduras', en: 'Tofu stir-fry with quinoa and vegetables' },
    mealTypes: ['main'],
    prepMinutes: 25,
    ingredients: [
      ing('tofu', 'P', 250, 120, 450, 10, ['tempeh']),
      ing('quinoa', 'C', 50, 20, 120, 5, ['white_rice']),
      ing('broccoli', 'V', 120, 120, 120),
      ing('red_bell_pepper', 'V', 80, 80, 80),
      ing('olive_oil', 'F', 6, 0, 20, 1),
    ],
    seasonings: { es: 'Ajo, jengibre, limón y sal', en: 'Garlic, ginger, lime and salt' },
    steps: {
      es: [
        'Enjuaga la quinoa y cuécela con el doble de agua 15 minutos.',
        'Seca el tofu con papel, córtalo en cubos y dóralo en el aceite 8 minutos.',
        'Añade las verduras y saltea 4 minutos; sirve sobre la quinoa.',
      ],
      en: [
        'Rinse the quinoa and simmer it in twice its volume of water for 15 minutes.',
        'Pat the tofu dry, cube it and brown it in the oil for 8 minutes.',
        'Add the vegetables, stir-fry 4 minutes and serve over the quinoa.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'black_bean_tacos',
    name: { es: 'Tacos de frijol negro con aguacate', en: 'Black bean tacos with avocado' },
    mealTypes: ['main'],
    prepMinutes: 15,
    ingredients: [
      ing('black_beans_cooked', 'P', 180, 90, 360, 10, ['lentils_cooked', 'chickpeas_cooked']),
      ing('corn_tortilla', 'C', 78, 52, 182, 26),
      ing('romaine', 'V', 40, 40, 40),
      ing('tomato', 'V', 80, 80, 80),
      ing('avocado', 'F', 40, 0, 120, 10),
    ],
    seasonings: { es: 'Comino, salsa, cilantro, cebolla y limón', en: 'Cumin, salsa, cilantro, onion and lime' },
    steps: {
      es: ['Calienta los frijoles con comino y aplástalos ligeramente.', 'Calienta las tortillas.', 'Arma los tacos con lechuga, jitomate, aguacate y salsa.'],
      en: ['Warm the beans with cumin and lightly mash them.', 'Warm the tortillas.', 'Assemble with lettuce, tomato, avocado and salsa.'],
    },
    batchFriendly: true,
  },
  {
    id: 'tuna_potato_salad',
    name: { es: 'Ensalada de atún con papa', en: 'Tuna and potato salad' },
    mealTypes: ['main'],
    prepMinutes: 20,
    ingredients: [
      ing('tuna_canned_water', 'P', 140, 70, 280, 10, ['chicken_breast', 'egg', 'chickpeas_cooked']),
      ing('potato', 'C', 200, 80, 450, 10, ['sweet_potato']),
      ing('romaine', 'V', 80, 80, 80),
      ing('tomato', 'V', 80, 80, 80),
      ing('cucumber', 'V', 60, 60, 60),
      ing('olive_oil', 'F', 10, 0, 25, 1),
    ],
    seasonings: { es: 'Vinagre, mostaza, sal y pimienta', en: 'Vinegar, mustard, salt and pepper' },
    steps: {
      es: [
        'Cuece la papa en cubos 12 minutos y deja enfriar.',
        'Pica las verduras.',
        'Mezcla con el atún escurrido, el aceite y el aderezo.',
      ],
      en: [
        'Boil the diced potato for 12 minutes and let it cool.',
        'Chop the vegetables.',
        'Toss with the drained tuna, oil and dressing.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'pork_sweetpotato_carrot',
    name: { es: 'Lomo de cerdo con camote y zanahoria', en: 'Pork tenderloin with sweet potato and carrot' },
    mealTypes: ['main'],
    prepMinutes: 35,
    ingredients: [
      ing('pork_tenderloin', 'P', 150, 80, 300, 10, ['chicken_breast', 'ground_turkey_93']),
      ing('sweet_potato', 'C', 220, 100, 500, 10, ['potato']),
      ing('carrot', 'V', 100, 100, 100),
      ing('olive_oil', 'F', 8, 0, 25, 1),
    ],
    seasonings: { es: 'Romero, ajo, sal y pimienta', en: 'Rosemary, garlic, salt and pepper' },
    steps: {
      es: [
        'Hornea el camote y la zanahoria en cubos con la mitad del aceite a 200 °C (400 °F), 25 minutos.',
        'Sella el lomo en el aceite restante y termina en el horno hasta 63 °C (145 °F) en el centro.',
        'Deja reposar la carne 3 minutos antes de rebanar.',
      ],
      en: [
        'Roast the diced sweet potato and carrot with half the oil at 400 °F (200 °C) for 25 minutes.',
        'Sear the tenderloin in the remaining oil and finish in the oven to an internal 145 °F (63 °C).',
        'Rest the meat for 3 minutes before slicing.',
      ],
    },
    batchFriendly: true,
  },
  {
    id: 'beans_rice_egg',
    name: { es: 'Frijoles negros con arroz, huevo y aguacate', en: 'Black beans with rice, egg and avocado' },
    mealTypes: ['main'],
    prepMinutes: 15,
    ingredients: [
      ing('egg', 'P', 100, 50, 200, 50),
      ing('egg_white', 'P', 60, 0, 200, 10),
      ing('black_beans_cooked', 'V', 120, 120, 120),
      ing('white_rice', 'C', 50, 0, 140, 5, ['corn_tortilla']),
      ing('avocado', 'F', 40, 0, 120, 10),
    ],
    seasonings: { es: 'Salsa, cilantro, sal y comino', en: 'Salsa, cilantro, salt and cumin' },
    steps: {
      es: [
        'Cuece el arroz (peso en seco) y calienta los frijoles con comino.',
        'Cocina los huevos y las claras a tu gusto en sartén antiadherente.',
        'Sirve con aguacate, salsa y cilantro.',
      ],
      en: [
        'Cook the rice (dry weight) and warm the beans with cumin.',
        'Cook the eggs and whites your way in a non-stick pan.',
        'Serve with avocado, salsa and cilantro.',
      ],
    },
    batchFriendly: false,
  },
  // ---------------- Colaciones ----------------
  {
    id: 'yogurt_apple_walnuts',
    name: { es: 'Yogur griego con manzana y nueces', en: 'Greek yogurt with apple and walnuts' },
    mealTypes: ['snack'],
    prepMinutes: 3,
    ingredients: [
      ing('greek_yogurt', 'P', 170, 100, 340, 10),
      ing('apple', 'C', 100, 50, 200, 10, ['banana', 'strawberries']),
      ing('walnuts', 'F', 10, 0, 30, 5, ['almonds']),
    ],
    seasonings: { es: 'Canela al gusto', en: 'Cinnamon to taste' },
    steps: { es: ['Pica la manzana y mézclala con el yogur y las nueces.'], en: ['Dice the apple and mix with the yogurt and walnuts.'] },
    batchFriendly: false,
  },
  {
    id: 'hummus_carrot_bread',
    name: { es: 'Hummus con zanahoria y pan integral', en: 'Hummus with carrot and whole-wheat bread' },
    mealTypes: ['snack'],
    prepMinutes: 5,
    ingredients: [
      ing('hummus', 'F', 60, 30, 120, 10),
      ing('carrot', 'V', 100, 100, 100),
      ing('whole_wheat_bread', 'C', 32, 0, 96, 32, ['corn_tortilla']),
    ],
    seasonings: { es: 'Pimentón al gusto', en: 'Paprika to taste' },
    steps: { es: ['Corta la zanahoria en bastones y sirve con el hummus y el pan.'], en: ['Cut the carrot into sticks and serve with hummus and bread.'] },
    batchFriendly: false,
  },
  {
    id: 'banana_pb',
    name: { es: 'Plátano con crema de cacahuate', en: 'Banana with peanut butter' },
    mealTypes: ['snack'],
    prepMinutes: 2,
    ingredients: [
      ing('banana', 'C', 118, 60, 240, 10, ['apple']),
      ing('peanut_butter', 'F', 15, 5, 40, 5, ['almonds']),
    ],
    seasonings: { es: '—', en: '—' },
    steps: { es: ['Rebana el plátano y úntalo con la crema de cacahuate.'], en: ['Slice the banana and spread with the peanut butter.'] },
    batchFriendly: false,
  },
  {
    id: 'eggs_orange',
    name: { es: 'Huevos cocidos con naranja', en: 'Hard-boiled eggs with an orange' },
    mealTypes: ['snack'],
    prepMinutes: 12,
    ingredients: [
      ing('egg', 'P', 100, 50, 150, 50),
      ing('orange', 'C', 131, 0, 262, 10, ['apple', 'banana']),
    ],
    seasonings: { es: 'Sal y pimienta', en: 'Salt and pepper' },
    steps: { es: ['Cuece los huevos 10 minutos, enfría en agua y pela.', 'Acompaña con la naranja.'], en: ['Boil the eggs for 10 minutes, cool in water and peel.', 'Serve with the orange.'] },
    batchFriendly: true,
  },
  {
    id: 'mozzarella_strawberries_almonds',
    name: { es: 'Queso mozzarella con fresas y almendras', en: 'Mozzarella with strawberries and almonds' },
    mealTypes: ['snack'],
    prepMinutes: 3,
    ingredients: [
      ing('mozzarella_part_skim', 'P', 40, 20, 80, 5),
      ing('strawberries', 'C', 150, 80, 300, 10, ['blueberries', 'apple']),
      ing('almonds', 'F', 10, 0, 30, 5),
    ],
    seasonings: { es: '—', en: '—' },
    steps: { es: ['Sirve el queso en cubos con las fresas y las almendras.'], en: ['Serve the cubed cheese with strawberries and almonds.'] },
    batchFriendly: false,
  },
];

export const RECIPE_BY_ID: Record<string, RecipeTemplate> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export type ShelfSubcategory = { id: string; label: string; allow_custom?: boolean };

export type ShelfCategory = {
  id?: string;
  name: string;
  examples: string;
  subcategories?: ShelfSubcategory[];
};

/** Every category ends with an "Others" option that accepts free text. */
const OTHERS: ShelfSubcategory = { id: "others", label: "Others", allow_custom: true };

function subs(...entries: Array<[string, string]>): ShelfSubcategory[] {
  return [...entries.map(([id, label]) => ({ id, label })), OTHERS];
}

export const FALLBACK_CATEGORIES: ShelfCategory[] = [
  {
    id: "beverages",
    name: "Beverages",
    examples: "Water, soft drinks, juices, energy drinks, tea, coffee, sports drinks",
    subcategories: subs(
      ["water", "Water"],
      ["soft_drinks", "Soft drinks"],
      ["juices", "Juices"],
      ["energy_drinks", "Energy drinks"],
      ["tea", "Tea"],
      ["coffee", "Coffee"],
      ["sports_drinks", "Sports drinks"],
    ),
  },
  {
    id: "fresh_food",
    name: "Fresh Food",
    examples: "Fruits, vegetables, fresh meat, fish, eggs",
    subcategories: subs(
      ["fruits", "Fruits"],
      ["vegetables", "Vegetables"],
      ["fresh_meat", "Fresh meat"],
      ["fish", "Fish"],
      ["eggs", "Eggs"],
    ),
  },
  {
    id: "dairy_chilled",
    name: "Dairy & Chilled",
    examples: "Milk, curd, paneer, cheese, butter, yogurt",
    subcategories: subs(
      ["milk", "Milk"],
      ["curd", "Curd"],
      ["paneer", "Paneer"],
      ["cheese", "Cheese"],
      ["butter", "Butter"],
      ["yogurt", "Yogurt"],
    ),
  },
  {
    id: "grocery_staples",
    name: "Grocery & Staples",
    examples: "Rice, atta, dal, pulses, oil, sugar, salt, spices",
    subcategories: subs(
      ["rice", "Rice"],
      ["atta", "Atta"],
      ["dal", "Dal"],
      ["pulses", "Pulses"],
      ["oil", "Oil"],
      ["sugar", "Sugar"],
      ["salt", "Salt"],
      ["spices", "Spices"],
    ),
  },
  {
    id: "packaged_food_snacks",
    name: "Packaged Food & Snacks",
    examples:
      "Biscuits, chips, namkeen, noodles, pasta, cereals, chocolates, confectionery, sauces",
    subcategories: subs(
      ["biscuits", "Biscuits"],
      ["chips", "Chips"],
      ["namkeen", "Namkeen"],
      ["noodles", "Noodles"],
      ["pasta", "Pasta"],
      ["cereals", "Cereals"],
      ["chocolates", "Chocolates"],
      ["confectionery", "Confectionery"],
      ["sauces", "Sauces"],
    ),
  },
  {
    id: "frozen_ice_cream",
    name: "Frozen Foods & Ice Cream",
    examples: "Ice cream, frozen vegetables, frozen snacks, frozen meals",
    subcategories: subs(
      ["ice_cream", "Ice cream"],
      ["frozen_vegetables", "Frozen vegetables"],
      ["frozen_snacks", "Frozen snacks"],
      ["frozen_meals", "Frozen meals"],
    ),
  },
  {
    id: "personal_care",
    name: "Personal Care",
    examples: "Shampoo, soap, toothpaste, deodorant, skincare, cosmetics, shaving",
    subcategories: subs(
      ["shampoo", "Shampoo"],
      ["soap", "Soap"],
      ["toothpaste", "Toothpaste"],
      ["deodorant", "Deodorant"],
      ["skincare", "Skincare"],
      ["cosmetics", "Cosmetics"],
      ["shaving", "Shaving"],
    ),
  },
  {
    id: "home_care",
    name: "Home Care",
    examples:
      "Detergent, dishwash, floor cleaner, toilet cleaner, disinfectants, air fresheners, insecticides",
    subcategories: subs(
      ["detergent", "Detergent"],
      ["dishwash", "Dishwash"],
      ["floor_cleaner", "Floor cleaner"],
      ["toilet_cleaner", "Toilet cleaner"],
      ["disinfectants", "Disinfectants"],
      ["air_fresheners", "Air fresheners"],
      ["insecticides", "Insecticides"],
    ),
  },
  {
    id: "health_wellness",
    name: "Health & Wellness",
    examples: "OTC products, vitamins, supplements, first aid, health foods",
    subcategories: subs(
      ["otc", "OTC products"],
      ["vitamins", "Vitamins"],
      ["supplements", "Supplements"],
      ["first_aid", "First aid"],
      ["health_foods", "Health foods"],
    ),
  },
  {
    id: "baby_pet_care",
    name: "Baby & Pet Care",
    examples: "Baby food, diapers, wipes, pet food, pet hygiene",
    subcategories: subs(
      ["baby_food", "Baby food"],
      ["diapers", "Diapers"],
      ["wipes", "Wipes"],
      ["pet_food", "Pet food"],
      ["pet_hygiene", "Pet hygiene"],
    ),
  },
  {
    id: "others",
    name: "Others",
    examples: "Any shelf that does not fit the categories above",
    subcategories: [],
  },
];

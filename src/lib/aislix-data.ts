// Dummy data for the Aislix frontend prototype. No backend yet.

export type ScanStatus = "completed" | "processing" | "failed";

export interface Scan {
  id: string;
  store: string;
  aisle: string;
  city: string;
  date: string;
  time: string;
  products: number;
  brands: number;
  confidence: number;
  shelfHealth: number;
  emptySlots: number;
  status: ScanStatus;
}

export const scans: Scan[] = [
  {
    id: "SCN-10428",
    store: "MoreMart Superstore",
    aisle: "Aisle 4 · Beverages",
    city: "Bengaluru",
    date: "Aug 6, 2026",
    time: "11:42",
    products: 218,
    brands: 24,
    confidence: 96.4,
    shelfHealth: 92,
    emptySlots: 4,
    status: "completed",
  },
  {
    id: "SCN-10427",
    store: "Sri Balaji Kirana",
    aisle: "Rack 2 · Snacks",
    city: "Hyderabad",
    date: "Aug 6, 2026",
    time: "09:15",
    products: 96,
    brands: 13,
    confidence: 91.2,
    shelfHealth: 74,
    emptySlots: 11,
    status: "completed",
  },
  {
    id: "SCN-10426",
    store: "FreshPick Hypermarket",
    aisle: "Aisle 9 · Personal Care",
    city: "Pune",
    date: "Aug 5, 2026",
    time: "18:03",
    products: 342,
    brands: 31,
    confidence: 94.8,
    shelfHealth: 88,
    emptySlots: 7,
    status: "completed",
  },
  {
    id: "SCN-10425",
    store: "Metro Cash & Carry",
    aisle: "Aisle 1 · Dairy",
    city: "Delhi NCR",
    date: "Aug 5, 2026",
    time: "12:30",
    products: 174,
    brands: 18,
    confidence: 89.6,
    shelfHealth: 66,
    emptySlots: 15,
    status: "completed",
  },
  {
    id: "SCN-10424",
    store: "Green Basket Retail",
    aisle: "Aisle 6 · Home Care",
    city: "Chennai",
    date: "Aug 4, 2026",
    time: "16:20",
    products: 205,
    brands: 22,
    confidence: 93.1,
    shelfHealth: 84,
    emptySlots: 6,
    status: "completed",
  },
  {
    id: "SCN-10423",
    store: "Daily Needs Kirana",
    aisle: "Rack 5 · Staples",
    city: "Jaipur",
    date: "Aug 4, 2026",
    time: "10:05",
    products: 88,
    brands: 11,
    confidence: 87.4,
    shelfHealth: 61,
    emptySlots: 18,
    status: "completed",
  },
  {
    id: "SCN-10422",
    store: "MoreMart Superstore",
    aisle: "Aisle 3 · Confectionery",
    city: "Bengaluru",
    date: "Aug 3, 2026",
    time: "14:48",
    products: 263,
    brands: 27,
    confidence: 95.2,
    shelfHealth: 90,
    emptySlots: 3,
    status: "completed",
  },
  {
    id: "SCN-10421",
    store: "UrbanBazaar Express",
    aisle: "Aisle 7 · Beverages",
    city: "Kolkata",
    date: "Aug 2, 2026",
    time: "08:55",
    products: 0,
    brands: 0,
    confidence: 0,
    shelfHealth: 0,
    emptySlots: 0,
    status: "failed",
  },
  {
    id: "SCN-10420",
    store: "FreshPick Hypermarket",
    aisle: "Aisle 2 · Frozen Foods",
    city: "Pune",
    date: "Aug 2, 2026",
    time: "17:22",
    products: 156,
    brands: 19,
    confidence: 92.8,
    shelfHealth: 79,
    emptySlots: 9,
    status: "completed",
  },
  {
    id: "SCN-10419",
    store: "Metro Cash & Carry",
    aisle: "Aisle 8 · Beverages",
    city: "Delhi NCR",
    date: "Aug 1, 2026",
    time: "13:10",
    products: 289,
    brands: 26,
    confidence: 94.1,
    shelfHealth: 86,
    emptySlots: 5,
    status: "completed",
  },
  {
    id: "SCN-10418",
    store: "Sri Balaji Kirana",
    aisle: "Rack 1 · Biscuits",
    city: "Hyderabad",
    date: "Aug 1, 2026",
    time: "09:48",
    products: 74,
    brands: 9,
    confidence: 88.9,
    shelfHealth: 68,
    emptySlots: 12,
    status: "completed",
  },
  {
    id: "SCN-10417",
    store: "UrbanBazaar Express",
    aisle: "Aisle 5 · Home Care",
    city: "Kolkata",
    date: "Jul 31, 2026",
    time: "15:36",
    products: 132,
    brands: 16,
    confidence: 90.7,
    shelfHealth: 72,
    emptySlots: 10,
    status: "completed",
  },
  {
    id: "SCN-10416",
    store: "Green Basket Retail",
    aisle: "Aisle 2 · Dairy",
    city: "Chennai",
    date: "Jul 31, 2026",
    time: "10:12",
    products: 0,
    brands: 0,
    confidence: 0,
    shelfHealth: 0,
    emptySlots: 0,
    status: "processing",
  },
  {
    id: "SCN-10415",
    store: "MoreMart Superstore",
    aisle: "Aisle 6 · Personal Care",
    city: "Bengaluru",
    date: "Jul 30, 2026",
    time: "18:41",
    products: 311,
    brands: 29,
    confidence: 95.9,
    shelfHealth: 91,
    emptySlots: 2,
    status: "completed",
  },
  {
    id: "SCN-10414",
    store: "Daily Needs Kirana",
    aisle: "Rack 3 · Beverages",
    city: "Jaipur",
    date: "Jul 30, 2026",
    time: "11:07",
    products: 64,
    brands: 8,
    confidence: 86.2,
    shelfHealth: 58,
    emptySlots: 21,
    status: "completed",
  },
];


export const inventoryTrend = [
  { month: "Feb", products: 4120, empty: 420 },
  { month: "Mar", products: 4680, empty: 388 },
  { month: "Apr", products: 5240, empty: 356 },
  { month: "May", products: 5610, empty: 302 },
  { month: "Jun", products: 6180, empty: 276 },
  { month: "Jul", products: 6940, empty: 231 },
  { month: "Aug", products: 7420, empty: 198 },
];

export const shelfHealthTrend = [
  { week: "W1", score: 71 },
  { week: "W2", score: 76 },
  { week: "W3", score: 74 },
  { week: "W4", score: 81 },
  { week: "W5", score: 86 },
  { week: "W6", score: 88 },
];

export const topBrands = [
  { brand: "Amul", share: 22, facings: 1642 },
  { brand: "Britannia", share: 18, facings: 1348 },
  { brand: "Parle", share: 15, facings: 1120 },
  { brand: "Nestlé", share: 12, facings: 902 },
  { brand: "Coca-Cola", share: 9, facings: 684 },
  { brand: "Dabur", share: 7, facings: 512 },
];

export const lowStockAlerts = [
  { sku: "Amul Gold 1L", store: "MoreMart · Aisle 1", severity: "critical", facings: 1 },
  { sku: "Maggi Masala 70g", store: "Daily Needs · Rack 5", severity: "critical", facings: 0 },
  { sku: "Coca-Cola 750ml", store: "FreshPick · Aisle 4", severity: "warning", facings: 3 },
  { sku: "Good Day Cashew", store: "Metro · Aisle 3", severity: "warning", facings: 4 },
  { sku: "Dove Soap 100g", store: "Green Basket · Aisle 6", severity: "low", facings: 6 },
];

export const detectedProducts = [
  { name: "Amul Gold Milk 1L", brand: "Amul", facings: 12, confidence: 98.2, price: "₹72", status: "In stock" },
  { name: "Britannia Good Day 200g", brand: "Britannia", facings: 8, confidence: 96.7, price: "₹45", status: "In stock" },
  { name: "Parle-G Gold 1kg", brand: "Parle", facings: 5, confidence: 95.1, price: "₹120", status: "Low stock" },
  { name: "Nescafé Classic 50g", brand: "Nestlé", facings: 4, confidence: 93.8, price: "₹185", status: "Low stock" },
  { name: "Coca-Cola 750ml", brand: "Coca-Cola", facings: 3, confidence: 92.4, price: "₹40", status: "Low stock" },
  { name: "Maggi 2-Minute Noodles", brand: "Nestlé", facings: 0, confidence: 90.6, price: "₹14", status: "Out of stock" },
  { name: "Dabur Honey 250g", brand: "Dabur", facings: 6, confidence: 91.9, price: "₹165", status: "In stock" },
];

export const invoices = [
  { id: "INV-2026-081", date: "Aug 1, 2026", amount: "₹24,999", plan: "Growth (Monthly)", status: "Paid" },
  { id: "INV-2026-071", date: "Jul 1, 2026", amount: "₹24,999", plan: "Growth (Monthly)", status: "Paid" },
  { id: "INV-2026-061", date: "Jun 1, 2026", amount: "₹24,999", plan: "Growth (Monthly)", status: "Paid" },
  { id: "INV-2026-051", date: "May 1, 2026", amount: "₹9,999", plan: "Starter (Monthly)", status: "Paid" },
];

export const stats = {
  totalScans: 1284,
  productsDetected: 74210,
  brandsDetected: 318,
  avgConfidence: 94.6,
  lowStockAlerts: 27,
  shelfHealth: 88,
};

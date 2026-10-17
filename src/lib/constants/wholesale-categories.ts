export interface WholesaleCategory {
  id: string;
  name: string;
  sector: string;
}

export const WHOLESALE_CATEGORIES: WholesaleCategory[] = [
  // Consumer Electronics & Tech
  { id: 'consumer-electronics', name: 'Consumer Electronics & Gadgets', sector: 'Consumer Technology' },
  { id: 'smartphones-tablets', name: 'Smartphones, Tablets & Mobile Devices', sector: 'Consumer Technology' },
  { id: 'computers-laptops', name: 'Laptops, PCs & Workstations', sector: 'Consumer Technology' },
  { id: 'computer-hardware', name: 'Computer Components, Storage & RAM', sector: 'Consumer Technology' },
  { id: 'audio-sound', name: 'Audio, Headphones & Speakers', sector: 'Consumer Technology' },
  { id: 'tv-entertainment', name: 'TV, Displays & Video Entertainment', sector: 'Consumer Technology' },
  { id: 'gaming-consoles', name: 'Gaming Consoles & Video Game Accessories', sector: 'Consumer Technology' },
  { id: 'wearables-smartwatches', name: 'Smartwatches & Wearable Tech', sector: 'Consumer Technology' },
  { id: 'cameras-optics', name: 'Cameras, Drones & Optics', sector: 'Consumer Technology' },
  { id: 'telecom-networking', name: 'Telecom, Routers & Networking Equipment', sector: 'Consumer Technology' },
  { id: 'smart-home-iot', name: 'Smart Home Automation & IoT Devices', sector: 'Consumer Technology' },
  { id: 'printers-office-tech', name: 'Printers, Scanners & Office Electronics', sector: 'Consumer Technology' },

  // Household & Appliances
  { id: 'major-appliances', name: 'Major Appliances (White Goods)', sector: 'Household & Appliances' },
  { id: 'small-domestic-appliances', name: 'Small Domestic Appliances (SDA & Kitchen)', sector: 'Household & Appliances' },
  { id: 'hvac-climate-control', name: 'Air Conditioning, Heating & HVAC', sector: 'Household & Appliances' },

  // Beauty, Health & Personal Care
  { id: 'cosmetics-makeup', name: 'Cosmetics & Makeup', sector: 'Beauty & Personal Care' },
  { id: 'skincare-dermatology', name: 'Skincare & Clinical Treatments', sector: 'Beauty & Personal Care' },
  { id: 'fragrances-luxury-perfumes', name: 'Luxury Fragrances & Designer Perfumes', sector: 'Beauty & Personal Care' },
  { id: 'haircare-salon', name: 'Haircare & Professional Salon Supplies', sector: 'Beauty & Personal Care' },
  { id: 'personal-care-toiletries', name: 'Personal Care, Hygiene & Toiletries', sector: 'Beauty & Personal Care' },
  { id: 'vitamins-dietary-supplements', name: 'Vitamins & Dietary Supplements', sector: 'Health & Wellness' },
  { id: 'sports-nutrition', name: 'Sports Nutrition, Whey & Performance', sector: 'Health & Wellness' },
  { id: 'medical-supplies-ppe', name: 'Medical Devices, PPE & Diagnostic Tests', sector: 'Health & Wellness' },

  // FMCG, Food & Beverage
  { id: 'packaged-foods-fmcg', name: 'Ambient Packaged Foods & Grocery (FMCG)', sector: 'FMCG & Groceries' },
  { id: 'confectionery-chocolate-sweets', name: 'Confectionery, Chocolates, Sweets & Snacks', sector: 'FMCG & Groceries' },
  { id: 'soft-drinks-energy-waters', name: 'Soft Drinks, Juices & Energy Waters', sector: 'FMCG & Groceries' },
  { id: 'coffee-tea-beverages', name: 'Wholesale Coffee, Tea & Hot Drinks', sector: 'FMCG & Groceries' },
  { id: 'beer-wine-spirits', name: 'Beer, Wines & Spirits (Bonded Wholesale)', sector: 'Beverages & Spirits' },
  { id: 'organic-specialty-foods', name: 'Organic, Vegan & Specialty Nutrition', sector: 'FMCG & Groceries' },
  { id: 'cleaning-detergents', name: 'Household Cleaning & Industrial Detergents', sector: 'FMCG & Groceries' },

  // Fashion, Apparel & Footwear
  { id: 'menswear-apparel', name: "Men's Clothing & Designer Fashion", sector: 'Fashion & Apparel' },
  { id: 'womenswear-apparel', name: "Women's Clothing & Luxury Apparel", sector: 'Fashion & Apparel' },
  { id: 'footwear-sneakers', name: 'Footwear, Sneakers & Athletic Shoes', sector: 'Fashion & Apparel' },
  { id: 'luxury-watches-jewelry', name: 'Luxury Watches & Fine Jewelry', sector: 'Luxury & Accessories' },
  { id: 'designer-handbags-leather', name: 'Designer Handbags & Leather Goods', sector: 'Luxury & Accessories' },
  { id: 'eyewear-sunglasses', name: 'Designer Eyewear & Sunglasses', sector: 'Luxury & Accessories' },
  { id: 'sportswear-fitness-gear', name: 'Sportswear & Athletic Gear', sector: 'Fashion & Apparel' },
  { id: 'childrens-apparel', name: "Baby & Children's Clothing", sector: 'Fashion & Apparel' },

  // Home, Living & Furniture
  { id: 'furniture-interior-decor', name: 'Home Furniture & Interior Decor', sector: 'Home & Living' },
  { id: 'kitchenware-tableware', name: 'Cookware, Kitchenware & Tableware', sector: 'Home & Living' },
  { id: 'bedding-linens-textiles', name: 'Bedding, Linens & Home Textiles', sector: 'Home & Living' },
  { id: 'garden-patio-outdoor', name: 'Garden Furniture, BBQ & Outdoor Living', sector: 'Home & Living' },
  { id: 'lighting-fixtures', name: 'LED Lighting & Commercial Fixtures', sector: 'Home & Living' },

  // Hardware, Industrial & Tools
  { id: 'power-tools-hand-tools', name: 'Power Tools & Hand Tools', sector: 'Industrial & Hardware' },
  { id: 'industrial-machinery-plant', name: 'Industrial Machinery & Workshop Equipment', sector: 'Industrial & Hardware' },
  { id: 'electrical-supplies-cables', name: 'Electrical Supplies, Wiring & Switchgear', sector: 'Industrial & Hardware' },
  { id: 'plumbing-pipes-pumps', name: 'Plumbing Supplies, Pipes & Valves', sector: 'Industrial & Hardware' },
  { id: 'building-materials-timber', name: 'Building Materials, Cement & Timber', sector: 'Industrial & Hardware' },
  { id: 'security-cctv-ppe', name: 'CCTV, Access Control & Site Safety Wear', sector: 'Industrial & Hardware' },

  // Automotive & Transport
  { id: 'automotive-spares-parts', name: 'Automotive Replacement Parts & Spares', sector: 'Automotive' },
  { id: 'tires-wheels-rims', name: 'Commercial & Passenger Tires and Wheels', sector: 'Automotive' },
  { id: 'car-electronics-accessories', name: 'Car Electronics, Dashcams & In-Car Audio', sector: 'Automotive' },
  { id: 'motorcycle-parts-gear', name: 'Motorcycle Parts, Helmets & Gear', sector: 'Automotive' },

  // Green Energy, Solar & Storage
  { id: 'solar-panels-inverters', name: 'Solar Panels, Inverters & PV Modules', sector: 'Green Energy' },
  { id: 'energy-storage-batteries', name: 'Energy Storage Systems & Lithium Batteries', sector: 'Green Energy' },
  { id: 'ev-charging-stations', name: 'EV Charging Stations & Cables', sector: 'Green Energy' },

  // Toys, Baby & Hobbies
  { id: 'toys-games-puzzles', name: 'Toys, Board Games & Action Figures', sector: 'Toys & Kids' },
  { id: 'baby-gear-strollers', name: 'Baby Gear, Strollers & Car Seats', sector: 'Toys & Kids' },
  { id: 'pet-supplies-food', name: 'Pet Food, Care & Veterinary Supplies', sector: 'Pet & Animals' },

  // Surplus, Closeouts & Logistics
  { id: 'overstock-liquidation-lots', name: 'Overstock, Liquidation Lots & Closeouts', sector: 'Surplus & Closeouts' },
  { id: 'graded-returns-refurbished', name: 'Graded Returns, Refurbished & B-Stock', sector: 'Surplus & Closeouts' },
  { id: 'packaging-shipping-pallets', name: 'Pallets, Packaging Materials & Shipping Supplies', sector: 'Logistics' },
];

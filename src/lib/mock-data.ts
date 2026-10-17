import type { Product, WtbRequest, Company, Category } from '@/types/database';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';

export const MOCK_CATEGORIES: Category[] = WHOLESALE_CATEGORIES.map((cat) => ({
  id: cat.id,
  name: cat.name,
  slug: cat.id,
  description: `${cat.name} (${cat.sector})`,
}));

export const MOCK_COMPANIES: Company[] = [];

export const MOCK_PRODUCTS: Product[] = [];

export const MOCK_WTB_REQUESTS: WtbRequest[] = [];

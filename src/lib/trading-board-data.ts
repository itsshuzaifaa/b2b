export interface TradingBoardItem {
  id: string;
  type: 'BUY' | 'SELL';
  category: string;
  brand: string;
  itemCode: string;
  description: string;
  ean: string;
  qty: number;
  condition: string;
  price: number;
  currency: string;
  location: string;
  match: string;
  companyName: string;
  contactEmail: string;
  contactName: string;
  contactPhone?: string;
  moq: number;
}

export const SAMPLE_SELL_LISTINGS: TradingBoardItem[] = [];

export const SAMPLE_BUY_LISTINGS: TradingBoardItem[] = [];

export const ALL_TRADING_BOARD_ITEMS: TradingBoardItem[] = [
  ...SAMPLE_SELL_LISTINGS,
  ...SAMPLE_BUY_LISTINGS,
];

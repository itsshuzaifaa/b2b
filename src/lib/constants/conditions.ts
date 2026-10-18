export const WHOLESALE_CONDITIONS = [
  'New',
  'CPO',
  '14 Day',
  'A Grade',
  'B Grade',
  'C Grade',
  'Untested',
  'Ber',
  'Other',
] as const;

export type WholesaleCondition = (typeof WHOLESALE_CONDITIONS)[number];

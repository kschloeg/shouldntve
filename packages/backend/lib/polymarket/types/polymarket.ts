export interface PolymarketMarket {
  id: string;
  question: string;
  description?: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time?: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  liquidity?: string;
  active: boolean;
  closed: boolean;
  archived?: boolean;
  new?: boolean;
  featured?: boolean;
  restricted?: boolean;
  groupItemTitle?: string;
  category?: string;
  tags?: string[];
}

export interface PolymarketSearchResponse {
  data: PolymarketMarket[];
  count: number;
  limit: number;
  offset: number;
}

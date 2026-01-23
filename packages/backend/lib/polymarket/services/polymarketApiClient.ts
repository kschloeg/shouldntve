import { PolymarketMarket, PolymarketSearchResponse } from '../types/polymarket';

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

export interface SearchMarketsParams {
  query?: string;
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
}

export async function searchMarkets(
  params: SearchMarketsParams = {}
): Promise<PolymarketSearchResponse> {
  const {
    query = '',
    limit = 20,
    offset = 0,
    active = true,
    closed = false,
    archived = false,
  } = params;

  // Build query parameters
  const queryParams = new URLSearchParams();
  queryParams.append('limit', limit.toString());
  queryParams.append('offset', offset.toString());

  if (active !== undefined) queryParams.append('active', active.toString());
  if (closed !== undefined) queryParams.append('closed', closed.toString());
  if (archived !== undefined) queryParams.append('archived', archived.toString());

  let url = `${GAMMA_API_URL}/markets`;

  // If there's a search query, use the search endpoint
  if (query) {
    url = `${GAMMA_API_URL}/markets`;
    queryParams.append('_q', query);
  }

  const fullUrl = `${url}?${queryParams.toString()}`;

  console.log('Fetching Polymarket markets:', fullUrl);

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Transform the response to match our interface
  // Parse JSON string fields into arrays
  const transformedData = (data as any[]).map((market: any) => ({
    ...market,
    outcomes: typeof market.outcomes === 'string'
      ? JSON.parse(market.outcomes)
      : market.outcomes,
    outcomePrices: typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : market.outcomePrices,
  }));

  return {
    data: transformedData as PolymarketMarket[],
    count: transformedData.length,
    limit,
    offset,
  };
}

export async function getMarketById(marketId: string): Promise<PolymarketMarket | null> {
  const url = `${GAMMA_API_URL}/markets/${marketId}`;

  console.log('Fetching Polymarket market by ID:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

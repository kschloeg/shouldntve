import React, { useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Layout from './Layout';
import { useSnackbar } from './snackbarContext';

interface PolymarketMarket {
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
  category?: string;
  tags?: string[];
}

interface SearchResponse {
  data: PolymarketMarket[];
  count: number;
  limit: number;
  offset: number;
}

export default function PolymarketPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const showSnackbar = useSnackbar();

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      params.append('limit', '50');

      const response = await apiFetch(
        `${import.meta.env.VITE_API_URL}/polymarket/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch markets');
      }

      const result: SearchResponse = await response.json();
      setMarkets(result.data || []);

      if (result.data.length === 0) {
        showSnackbar?.('No markets found', 'info');
      }
    } catch (error) {
      console.error('Error searching Polymarket:', error);
      showSnackbar?.('Failed to search markets', 'error');
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (isNaN(num)) return volume;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatOdds = (price: string) => {
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    return `${(num * 100).toFixed(1)}%`;
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Polymarket Search
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            fullWidth
            label="Search markets"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Trump, Bitcoin, Super Bowl..."
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Search'}
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && searched && markets.length === 0 && (
          <Typography variant="body1" sx={{ textAlign: 'center', mt: 4 }}>
            No markets found
          </Typography>
        )}

        {!loading && markets.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Market</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Status</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Outcomes & Odds</strong>
                  </TableCell>
                  <TableCell>
                    <strong>End Date</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Volume</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Link</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {markets.map((market) => (
                  <TableRow key={market.id} hover>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {market.question}
                      </Typography>
                      {market.category && (
                        <Chip
                          label={market.category}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {market.active && !market.closed && (
                        <Chip label="Active" color="success" size="small" />
                      )}
                      {market.closed && (
                        <Chip label="Closed" color="default" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        {market.outcomes?.map((outcome, idx) => (
                          <Box key={idx} sx={{ mb: 0.5 }}>
                            <Typography variant="caption">
                              {outcome}:{' '}
                              <strong>
                                {market.outcomePrices?.[idx]
                                  ? formatOdds(market.outcomePrices[idx])
                                  : 'N/A'}
                              </strong>
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(market.end_date_iso)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatVolume(market.volume)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        href={`https://polymarket.com/event/${market.market_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!searched && (
          <Typography
            variant="body1"
            sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}
          >
            Search for Polymarket prediction markets above
          </Typography>
        )}
      </Box>
    </Layout>
  );
}

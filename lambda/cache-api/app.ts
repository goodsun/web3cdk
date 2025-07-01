import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { getCache, setCache } from './dynamodb';
import { callContractFunction } from './ethereum';
import { CACHE_TTL, CacheItem } from './types';
import { logger } from './logger';

const app = express();

// Disable Express's default x-powered-by header
app.disable('x-powered-by');

// Trust proxy for serverless environment
app.set('trust proxy', true);

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction): void => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// JSON parser with error handling
app.use(express.json({ 
  limit: '1mb',
  strict: true
}));

// URL-encoded parser
app.use(express.urlencoded({ 
  extended: true,
  limit: '1mb'
}));

const CHAIN_ID = process.env.CHAIN_ID || '1';
const CONTRACT_ADDRESSES = (process.env.CONTRACT_ADDRESSES || '').split(',').map(addr => addr.trim().toLowerCase());

// Middleware to validate contract address
const validateContract = (req: Request, res: Response, next: NextFunction): void => {
  const { address } = req.params;
  
  if (!address || !ethers.isAddress(address)) {
    res.status(400).json({ error: 'Invalid contract address' });
    return;
  }

  const normalizedAddress = address.toLowerCase();
  
  if (CONTRACT_ADDRESSES.length > 0 && !CONTRACT_ADDRESSES.includes(normalizedAddress)) {
    res.status(403).json({ error: 'Contract not whitelisted' });
    return;
  }

  req.params.address = normalizedAddress;
  next();
};

// Parse function parameters from query string
const parseParams = (functionName: string, query: any): any[] => {
  // Handle functions with tokenId parameter
  if (['tokenURI', 'ownerOf', 'getApproved', 'getTokenCreator', '_originalTokenInfo', 
       '_sbtFlag', 'tokenByIndex', 'royalties'].includes(functionName)) {
    return query.tokenId ? [query.tokenId] : [];
  }
  
  // Handle functions with address parameter
  if (['balanceOf', '_importers', '_totalDonations', 'getCreatorName', 
       'getCreatorTokenCount', 'getCreatorTokens'].includes(functionName)) {
    return query.address ? [query.address] : [];
  }
  
  // Handle functions with bytes4 parameter
  if (functionName === 'supportsInterface') {
    return query.interfaceId ? [query.interfaceId] : [];
  }
  
  // Handle TBA isValidSignature function
  if (functionName === 'isValidSignature') {
    return (query.hash && query.signature) ? [query.hash, query.signature] : [];
  }
  
  // Handle TBA Registry account function
  if (functionName === 'account') {
    return (query.implementation && query.chainId && query.tokenContract && query.tokenId && query.salt) 
      ? [query.implementation, query.chainId, query.tokenContract, query.tokenId, query.salt] 
      : [];
  }
  
  // Handle functions with multiple parameters
  if (functionName === 'isApprovedForAll') {
    return (query.owner && query.operator) ? [query.owner, query.operator] : [];
  }
  
  if (functionName === 'royaltyInfo') {
    return (query.tokenId && query.salePrice) ? [query.tokenId, query.salePrice] : [];
  }
  
  if (functionName === 'tokenOfOwnerByIndex') {
    return (query.owner && query.index) ? [query.owner, query.index] : [];
  }
  
  // Functions with no parameters (most contract-specific functions)
  return [];
};

// Generate cache key
const getCacheKey = (address: string, functionName: string, params: any[]): string => {
  const paramStr = params.length > 0 ? `:${params.join(':')}` : '';
  return `${CHAIN_ID}:${address}:${functionName}${paramStr}`;
};

// Main handler
app.get('/contract/:address/:function', validateContract, async (req: Request, res: Response) => {
  const { address, function: functionName } = req.params;
  
  if (!CACHE_TTL[functionName]) {
    return res.status(400).json({ error: 'Unsupported function' });
  }

  const params = parseParams(functionName, req.query);
  const cacheKey = getCacheKey(address, functionName, params);

  try {
    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info('Cache hit', { cacheKey });
      return res.json({
        result: cached.value,
        cached: true,
        cachedAt: new Date(cached.createdAt).toISOString()
      });
    }

    // Call contract
    logger.info('Cache miss, calling contract', { address, functionName, params });
    const result = await callContractFunction(address, functionName, params);

    // Store in cache
    const ttl = CACHE_TTL[functionName];
    const now = Date.now();
    const cacheItem: CacheItem = {
      cacheKey,
      value: result,
      expireAt: Math.floor(now / 1000) + ttl,
      createdAt: now,
      contractAddress: address,
      functionName,
      parameters: params.length > 0 ? params.join(',') : undefined
    };

    await setCache(cacheItem);

    return res.json({
      result,
      cached: false
    });

  } catch (error) {
    logger.error('Error processing request', { error, address, functionName });
    
    // Try to return stale cache on RPC error
    const staleCache = await getCache(cacheKey);
    if (staleCache) {
      logger.warn('Returning stale cache due to error', { cacheKey });
      return res.json({
        result: staleCache.value,
        cached: true,
        stale: true,
        cachedAt: new Date(staleCache.createdAt).toISOString(),
        error: 'RPC error, returning cached data'
      });
    }

    return res.status(500).json({ 
      error: 'Failed to fetch data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST handler for cache invalidation (same logic as GET but bypasses cache)
app.post('/contract/:address/:function', validateContract, async (req: Request, res: Response) => {
  const { address, function: functionName } = req.params;
  
  if (!CACHE_TTL[functionName]) {
    return res.status(400).json({ error: 'Unsupported function' });
  }

  const params = parseParams(functionName, req.query);
  const cacheKey = getCacheKey(address, functionName, params);

  try {
    // Call contract directly (bypass cache)
    logger.info('POST request, bypassing cache', { address, functionName, params });
    const result = await callContractFunction(address, functionName, params);

    // Store in cache
    const ttl = CACHE_TTL[functionName];
    const now = Date.now();
    const cacheItem: CacheItem = {
      cacheKey,
      value: result,
      expireAt: Math.floor((now + (ttl * 1000)) / 1000),
      createdAt: now,
      contractAddress: address.toLowerCase(),
      functionName,
      parameters: params.length > 0 ? JSON.stringify(params) : undefined
    };

    await setCache(cacheItem);
    logger.info('Cache updated via POST', { cacheKey });

    return res.json({
      result,
      cached: false,
      updated: true
    });

  } catch (error) {
    logger.error('Error processing POST request', { error, address, functionName });
    return res.status(500).json({ 
      error: 'Failed to fetch data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Root endpoint (health check)
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    service: 'ca-casher-api',
    timestamp: new Date().toISOString() 
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Unhandled error', { error, url: req.url, method: req.method });
  
  if (res.headersSent) {
    return;
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not found',
    message: `Path ${req.path} not found`
  });
});

export default app;
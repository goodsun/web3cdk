export interface CacheItem {
  cacheKey: string;
  value: any;
  expireAt: number;
  createdAt: number;
  contractAddress: string;
  functionName: string;
  parameters?: string;
}

export interface ContractFunction {
  name: string;
  ttlSeconds: number;
}

export const CACHE_TTL: Record<string, number> = {
  // Standard ERC721 functions
  'name': 86400,                    // 24 hours - rarely changes
  'symbol': 86400,                  // 24 hours - rarely changes
  'totalSupply': 300,               // 5 minutes - can change with mints/burns
  'balanceOf': 60,                  // 1 minute - frequently changes
  'ownerOf': 300,                   // 5 minutes - changes with transfers
  'getApproved': 300,               // 5 minutes - changes with approvals
  'isApprovedForAll': 300,          // 5 minutes - changes with approval for all
  'tokenURI': 3600,                 // 1 hour - metadata rarely changes
  'tokenByIndex': 300,              // 5 minutes - can change with mints/burns
  'tokenOfOwnerByIndex': 60,        // 1 minute - changes with transfers
  'supportsInterface': 86400,       // 24 hours - contract interfaces don't change
  
  // Contract-specific simple functions
  'INVERSE_BASIS_POINT': 86400,     // 24 hours - constant value
  '_lastId': 60,                    // 1 minute - changes with new mints
  '_maxFeeRate': 3600,              // 1 hour - admin setting, rarely changes
  '_mintFee': 3600,                 // 1 hour - admin setting, rarely changes
  '_owner': 3600,                   // 1 hour - ownership rarely changes
  '_totalBurned': 300,              // 5 minutes - changes with burns
  'getCreatorCount': 300,           // 5 minutes - changes when new creators join
  'getCreators': 300,               // 5 minutes - changes when new creators join
  'getTotalBurned': 300,            // 5 minutes - changes with burns
  
  // Contract-specific functions with parameters
  '_importers': 3600,               // 1 hour - importer status rarely changes
  '_originalTokenInfo': 3600,       // 1 hour - original token info rarely changes
  '_sbtFlag': 3600,                 // 1 hour - SBT flag rarely changes after mint
  '_totalDonations': 300,           // 5 minutes - changes with donations
  'getCreatorName': 3600,           // 1 hour - creator names rarely change
  'getCreatorTokenCount': 300,      // 5 minutes - changes with new mints by creator
  'getCreatorTokens': 300,          // 5 minutes - changes with new mints by creator
  'getTokenCreator': 86400,         // 24 hours - creator never changes after mint
  'royalties': 86400,               // 24 hours - royalty settings rarely change
  'royaltyInfo': 86400,             // 24 hours - royalty info rarely changes
  
  // TBA Account functions
  'owner': 300,                     // 5 minutes - TBA owner can change with NFT transfers
  'token': 86400,                   // 24 hours - TBA token binding never changes
  'nonce': 60,                      // 1 minute - nonce changes with transactions
  'isValidSignature': 300,          // 5 minutes - signature validation can change
  
  // TBA Registry functions
  'account': 86400,                 // 24 hours - account address calculation is deterministic
};

export const SUPPORTED_FUNCTIONS = Object.keys(CACHE_TTL);
import { ethers } from 'ethers';
import { logger } from './logger';
import { SUPPORTED_FUNCTIONS } from './types';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || '';
const RPC_TIMEOUT = parseInt(process.env.RPC_TIMEOUT || '5000');

// Comprehensive view function ABI fragments from donaterble_nft_abi.json
const ABI_FRAGMENTS = [
  // Standard ERC721 functions
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  
  // Contract-specific simple functions (no parameters)
  'function INVERSE_BASIS_POINT() view returns (uint16)',
  'function _lastId() view returns (uint256)',
  'function _maxFeeRate() view returns (uint256)',
  'function _mintFee() view returns (uint256)',
  'function _owner() view returns (address)',
  'function _totalBurned() view returns (uint256)',
  'function getCreatorCount() view returns (uint256)',
  'function getCreators() view returns (address[])',
  'function getTotalBurned() view returns (uint256)',
  
  // Contract-specific functions with parameters
  'function _importers(address) view returns (bool)',
  'function _originalTokenInfo(uint256) view returns (string)',
  'function _sbtFlag(uint256) view returns (bool)',
  'function _totalDonations(address) view returns (uint256)',
  'function getCreatorName(address creator) view returns (string)',
  'function getCreatorTokenCount(address creator) view returns (uint256)',
  'function getCreatorTokens(address creator) view returns (uint256[])',
  'function getTokenCreator(uint256 tokenId) view returns (address)',
  'function royalties(uint256) view returns (address recipient, uint16 feeRate)',
  'function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)',
];

export async function callContractFunction(
  contractAddress: string,
  functionName: string,
  params: any[] = []
): Promise<any> {
  if (!SUPPORTED_FUNCTIONS.includes(functionName)) {
    throw new Error(`Unsupported function: ${functionName}`);
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);
    provider._getConnection().timeout = RPC_TIMEOUT;

    const contract = new ethers.Contract(contractAddress, ABI_FRAGMENTS, provider);

    logger.debug('Calling contract function', { contractAddress, functionName, params });

    const result = await contract[functionName](...params);
    
    // Convert BigInt to string for JSON serialization
    if (typeof result === 'bigint') {
      return result.toString();
    }
    
    return result;
  } catch (error) {
    logger.error('Error calling contract function', { 
      contractAddress, 
      functionName, 
      params,
      error: error instanceof Error ? error.message : error 
    });
    throw error;
  }
}

export async function getBlockNumber(): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);
    return await provider.getBlockNumber();
  } catch (error) {
    logger.error('Error getting block number', { error });
    throw error;
  }
}

export async function getContractEvents(
  contractAddress: string,
  eventNames: string[],
  fromBlock: number,
  toBlock: number
): Promise<ethers.Log[]> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);
    
    // Create event filters
    const filters = eventNames.map(eventName => ({
      address: contractAddress,
      topics: [ethers.id(eventName + '(address,address,uint256)')] // Adjust based on actual event signature
    }));

    const logs: ethers.Log[] = [];
    
    for (const filter of filters) {
      const eventLogs = await provider.getLogs({
        ...filter,
        fromBlock,
        toBlock
      });
      logs.push(...eventLogs);
    }

    return logs;
  } catch (error) {
    logger.error('Error getting contract events', { 
      contractAddress, 
      eventNames,
      fromBlock,
      toBlock,
      error 
    });
    throw error;
  }
}
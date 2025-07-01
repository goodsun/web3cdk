import { EventBridgeEvent } from 'aws-lambda';
import { getBlockNumber, getContractEvents } from './ethereum';
import { clearCacheByContract } from './dynamodb';
import { logger } from './logger';

const CONTRACT_ADDRESSES = (process.env.CONTRACT_ADDRESSES || '').split(',').map(addr => addr.trim().toLowerCase());
const CHAIN_ID = process.env.CHAIN_ID || '1';

// Store last processed block in memory (for Lambda)
// In production, you might want to store this in DynamoDB
let lastProcessedBlock: number | null = null;

const MONITORED_EVENTS = [
  'Transfer',
  'Approval',
  'ApprovalForAll',
  'OwnershipTransferred'
];

const EVENT_CACHE_INVALIDATION_MAP: Record<string, string[]> = {
  'Transfer': ['balanceOf', 'ownerOf', 'totalSupply'],
  'Approval': ['allowance'],
  'ApprovalForAll': ['isApprovedForAll'],
  'OwnershipTransferred': ['owner']
};

export const handler = async (event: EventBridgeEvent<string, any>) => {
  logger.info('Event monitor started', { event: event.source });

  try {
    const currentBlock = await getBlockNumber();
    
    // First run, start from recent blocks only
    if (!lastProcessedBlock) {
      lastProcessedBlock = currentBlock - 10; // Process last 10 blocks on first run
      logger.info('First run, starting from recent blocks', { startBlock: lastProcessedBlock });
    }

    if (currentBlock <= lastProcessedBlock) {
      logger.info('No new blocks to process', { currentBlock, lastProcessedBlock });
      return;
    }

    logger.info('Processing blocks', { 
      fromBlock: lastProcessedBlock + 1, 
      toBlock: currentBlock,
      contractAddresses: CONTRACT_ADDRESSES 
    });

    // Process each contract
    for (const contractAddress of CONTRACT_ADDRESSES) {
      if (!contractAddress) continue;

      try {
        const logs = await getContractEvents(
          contractAddress,
          MONITORED_EVENTS,
          lastProcessedBlock + 1,
          currentBlock
        );

        if (logs.length > 0) {
          logger.info('Found events', { 
            contractAddress, 
            eventCount: logs.length 
          });

          // Group events by type
          const eventsByType: Record<string, number> = {};
          logs.forEach(log => {
            // Decode event name from topic (simplified)
            const topic = log.topics[0];
            for (const eventName of MONITORED_EVENTS) {
              // This is simplified - in production you'd need proper event decoding
              if (topic.includes(eventName.toLowerCase())) {
                eventsByType[eventName] = (eventsByType[eventName] || 0) + 1;
                break;
              }
            }
          });

          // Clear cache based on event types
          const functionsToInvalidate = new Set<string>();
          
          Object.keys(eventsByType).forEach(eventType => {
            const functions = EVENT_CACHE_INVALIDATION_MAP[eventType] || [];
            functions.forEach(func => functionsToInvalidate.add(func));
          });

          // Clear cache for affected functions
          for (const functionName of functionsToInvalidate) {
            await clearCacheByContract(contractAddress, functionName);
          }

          logger.info('Cache invalidated', {
            contractAddress,
            events: eventsByType,
            invalidatedFunctions: Array.from(functionsToInvalidate)
          });
        } else {
          logger.debug('No events found', { contractAddress });
        }
      } catch (error) {
        logger.error('Error processing contract events', { 
          contractAddress, 
          error: error instanceof Error ? error.message : error 
        });
      }
    }

    lastProcessedBlock = currentBlock;
    logger.info('Event monitoring completed', { lastProcessedBlock });

  } catch (error) {
    logger.error('Event monitor failed', { 
      error: error instanceof Error ? error.message : error 
    });
    throw error;
  }
};
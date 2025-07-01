import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CacheItem } from './types';
import { logger } from './logger';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'ca-casher-cache';

export async function getCache(cacheKey: string): Promise<CacheItem | null> {
  try {
    const response = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { cacheKey }
    }));

    if (!response.Item) {
      return null;
    }

    const item = response.Item as CacheItem;
    
    // Check if expired
    if (item.expireAt && item.expireAt < Math.floor(Date.now() / 1000)) {
      logger.debug('Cache expired', { cacheKey });
      return null;
    }

    return item;
  } catch (error) {
    logger.error('Error getting cache', { cacheKey, error });
    return null;
  }
}

export async function setCache(item: CacheItem): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));
    logger.debug('Cache set', { cacheKey: item.cacheKey });
  } catch (error) {
    logger.error('Error setting cache', { cacheKey: item.cacheKey, error });
    throw error;
  }
}

export async function deleteCache(cacheKey: string): Promise<void> {
  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { cacheKey }
    }));
    logger.debug('Cache deleted', { cacheKey });
  } catch (error) {
    logger.error('Error deleting cache', { cacheKey, error });
  }
}

export async function clearCacheByContract(contractAddress: string, functionName?: string): Promise<void> {
  try {
    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: 'contractAddress = :addr',
      ExpressionAttributeValues: {
        ':addr': contractAddress.toLowerCase()
      }
    };

    if (functionName) {
      scanParams.FilterExpression += ' AND functionName = :func';
      (scanParams.ExpressionAttributeValues as any)[':func'] = functionName;
    }

    const response = await docClient.send(new ScanCommand(scanParams));
    
    if (response.Items && response.Items.length > 0) {
      const deletePromises = response.Items.map(item => 
        deleteCache(item.cacheKey as string)
      );
      await Promise.all(deletePromises);
      logger.info('Cleared cache', { contractAddress, functionName, count: response.Items.length });
    }
  } catch (error) {
    logger.error('Error clearing cache by contract', { contractAddress, functionName, error });
  }
}
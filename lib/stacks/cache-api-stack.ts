import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

interface CacheApiStackProps extends cdk.StackProps {
  environment: string;
}

export class CacheApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CacheApiStackProps) {
    super(scope, id, props);
    
    const environment = props.environment;

    // DynamoDB table for caching
    const cacheTable = new dynamodb.Table(this, 'CacheTable', {
      tableName: `web3cdk-cache-api-table-${environment}`,
      partitionKey: {
        name: 'cacheKey',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expireAt',
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Lambda function for API
    const apiLambda = new lambda.Function(this, 'CacheApiFunction', {
      functionName: `web3cdk-cache-api-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/cache-api'),
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: cacheTable.tableName,
        CONTRACT_ADDRESSES: process.env.CACHE_CONTRACT_ADDRESSES || '',
        CHAIN_ID: process.env.CACHE_CHAIN_ID || '1',
        RPC_ENDPOINT: process.env.CACHE_RPC_ENDPOINT || '',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        ALLOWED_ORIGINS: process.env.CACHE_ALLOWED_ORIGINS || '*',
        NODE_OPTIONS: '--enable-source-maps'
      }
    });

    // Grant DynamoDB permissions to Lambda
    cacheTable.grantReadWriteData(apiLambda);

    // API Gateway
    const api = new apigateway.RestApi(this, 'CacheApi', {
      restApiName: `web3cdk-cache-api-${environment}`,
      description: 'Smart Contract Cache API',
      deployOptions: {
        stageName: 'cacheapi',
        throttlingBurstLimit: 20,
        throttlingRateLimit: 10,
        metricsEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowOrigins: process.env.CACHE_ALLOWED_ORIGINS?.split(',') || ['*'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Api-Key']
      }
    });

    // Lambda integration
    const integration = new apigateway.LambdaIntegration(apiLambda);

    // API routes
    api.root.addMethod('GET', integration);
    
    const contractResource = api.root.addResource('contract');
    const addressResource = contractResource.addResource('{address}');
    const functionResource = addressResource.addResource('{function}');

    functionResource.addMethod('GET', integration);
    functionResource.addMethod('POST', integration);

    // Event monitor Lambda
    const eventMonitorLambda = new lambda.Function(this, 'CacheEventMonitor', {
      functionName: `web3cdk-cache-event-monitor-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'event-monitor.handler',
      code: lambda.Code.fromAsset('lambda/cache-api'),
      memorySize: 256,
      timeout: cdk.Duration.minutes(5),
      environment: {
        TABLE_NAME: cacheTable.tableName,
        CONTRACT_ADDRESSES: process.env.CACHE_CONTRACT_ADDRESSES || '',
        CHAIN_ID: process.env.CACHE_CHAIN_ID || '1',
        RPC_ENDPOINT: process.env.CACHE_RPC_ENDPOINT || '',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
      }
    });

    cacheTable.grantReadWriteData(eventMonitorLambda);

    // EventBridge rule for periodic monitoring
    const eventRule = new events.Rule(this, 'CacheEventRule', {
      ruleName: `web3cdk-cache-event-monitor-rule-${environment}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5))
    });

    eventRule.addTarget(new targets.LambdaFunction(eventMonitorLambda));

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'CacheApiUrl', {
      value: api.url,
      description: 'Cache API Gateway endpoint URL',
      exportName: `web3cdk-${environment}-cache-api-endpoint`,
    });

    new cdk.CfnOutput(this, 'CacheTableName', {
      value: cacheTable.tableName,
      description: 'Cache DynamoDB table name'
    });
  }
}
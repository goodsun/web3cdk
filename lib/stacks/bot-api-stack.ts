import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface BotApiStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

/**
 * Discord Bot API Stack
 * Discord連携機能を提供するLambda + DynamoDB + API Gateway
 */
export class BotApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunction: lambda.Function;
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: BotApiStackProps) {
    super(scope, id, props);

    // DynamoDBテーブル作成
    this.table = new dynamodb.Table(this, 'BotApiTable', {
      tableName: `${props.projectName}-${props.environment}-bot-api`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
    });

    // 追加のDynamoDBテーブル
    const wantRequestTable = new dynamodb.Table(this, 'WantRequestTable', {
      tableName: `${props.projectName}-${props.environment}-want-requests`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const conversationTable = new dynamodb.Table(this, 'ConversationTable', {
      tableName: `${props.projectName}-${props.environment}-conversations`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const discordEOATable = new dynamodb.Table(this, 'DiscordEOATable', {
      tableName: `${props.projectName}-${props.environment}-discord-eoa`,
      partitionKey: {
        name: 'discord_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const registrationTokenTable = new dynamodb.Table(this, 'RegistrationTokenTable', {
      tableName: `${props.projectName}-${props.environment}-registration-tokens`,
      partitionKey: {
        name: 'token',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda関数作成
    this.lambdaFunction = new lambda.Function(this, 'BotApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/bot-api')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        TABLE_NAME: this.table.tableName,
        WANT_REQUEST_TABLE_NAME: wantRequestTable.tableName,
        CONVERSATION_TABLE_NAME: conversationTable.tableName,
        DISCORD_EOA_TABLE_NAME: discordEOATable.tableName,
        REGISTRATION_TOKEN_TABLE_NAME: registrationTokenTable.tableName,
        DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY || '',
        DISCORD_APPLICATION_ID: process.env.DISCORD_APP_ID || '',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
        DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '',
        API_BASE_URL: process.env.API_BASE_URL || `https://${process.env.DOMAIN_NAME}/api/bot`,
        CORS_ORIGIN: process.env.BOT_CORS_ORIGIN || '*',
      },
      description: 'Discord Bot API Lambda Function',
    });

    // Lambda関数にDynamoDBアクセス権限を付与
    this.table.grantReadWriteData(this.lambdaFunction);
    wantRequestTable.grantReadWriteData(this.lambdaFunction);
    conversationTable.grantReadWriteData(this.lambdaFunction);
    discordEOATable.grantReadWriteData(this.lambdaFunction);
    registrationTokenTable.grantReadWriteData(this.lambdaFunction);

    // API Gateway作成
    this.api = new apigateway.RestApi(this, 'BotApi', {
      restApiName: `${props.projectName}-${props.environment}-bot-api`,
      description: 'Discord Bot API Gateway',
      defaultCorsPreflightOptions: {
        allowOrigins: [process.env.BOT_CORS_ORIGIN || '*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: 'bot',
        throttlingBurstLimit: 50,
        throttlingRateLimit: 20,
      },
    });

    // Lambda統合
    const lambdaIntegration = new apigateway.LambdaIntegration(this.lambdaFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      proxy: true,
    });

    // 特定のルートを定義（CacheAPIと競合回避）
    // ルートパス定義
    this.api.root.addMethod('GET', lambdaIntegration);
    
    const discordResource = this.api.root.addResource('discord');
    discordResource.addMethod('POST', lambdaIntegration);
    
    const itemsResource = this.api.root.addResource('items');
    itemsResource.addMethod('GET', lambdaIntegration);
    itemsResource.addMethod('POST', lambdaIntegration);
    
    const itemByIdResource = itemsResource.addResource('{id}');
    itemByIdResource.addMethod('GET', lambdaIntegration);
    
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', lambdaIntegration);
    
    // Discord member情報
    const memberResource = discordResource.addResource('member');
    const memberByIdResource = memberResource.addResource('{userId}');
    memberByIdResource.addMethod('GET', lambdaIntegration);
    
    // Discord member card
    const membercardResource = discordResource.addResource('membercard');
    const membercardByIdResource = membercardResource.addResource('{discordId}');
    membercardByIdResource.addMethod('GET', lambdaIntegration);
    
    // Discord register/verify endpoints for testing
    const registerResource = discordResource.addResource('register');
    const verifyResource = registerResource.addResource('verify');
    verifyResource.addMethod('POST', lambdaIntegration);
    
    // Proxy all other requests
    const proxyResource = this.api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration);

    // タグ設定
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Component', 'BotAPI');

    // 出力
    new cdk.CfnOutput(this, 'BotApiUrl', {
      value: this.api.url,
      description: 'Bot API Gateway URL',
      exportName: `${props.projectName}-${props.environment}-bot-api-url`,
    });

    new cdk.CfnOutput(this, 'BotApiEndpoint', {
      value: this.api.url,
      description: 'Bot API Endpoint URL',
    });

    new cdk.CfnOutput(this, 'BotTableName', {
      value: this.table.tableName,
      description: 'Bot API DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'BotLambdaFunctionName', {
      value: this.lambdaFunction.functionName,
      description: 'Bot API Lambda Function Name',
    });
  }
}
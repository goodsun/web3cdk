#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Web3CdkStorageStack } from '../lib/stacks/storage-stack';
import { Web3CdkNetworkStack } from '../lib/constructs/network-stack';
import { Ec2Stack } from '../lib/constructs/ec2-stack';
import { CacheApiStack } from '../lib/stacks/cache-api-stack';
import { BotApiStack } from '../lib/stacks/bot-api-stack';

/**
 * CDKアプリケーションのエントリーポイント
 * 環境変数から設定を読み込み、適切なスタックを作成
 */

const app = new cdk.App();

try {
  // 環境変数から基本設定を取得
  const environment = process.env.CDK_ENV || 'dev';
  const account = process.env.CDK_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;
  const region = process.env.CDK_REGION || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';

  // 必須環境変数の検証
  validateEnvironmentVariables(account, environment);

  // TypeScriptの型ガード：validateEnvironmentVariablesでaccountが存在することを保証
  if (!account) {
    throw new Error('Account validation failed');
  }

  // 環境変数から設定を読み込み
  console.log(`🔧 Loading configuration for environment: ${environment}`);
  const projectName = process.env.PROJECT_NAME || 'web3cdk';

  // 共通のスタックプロパティ
  const baseProps = {
    env: { account, region },
    environment: environment,
  };

  // 環境情報の表示
  console.log(`📋 Deployment Configuration:`);
  console.log(`├── Environment: ${environment}`);
  console.log(`├── Account: ${account}`);
  console.log(`├── Region: ${region}`);
  console.log(`├── Project: ${projectName}`);
  console.log(`└── Stack Strategy: Separated`);

  // Phase 1: ネットワークスタックの作成
  const networkStack = new Web3CdkNetworkStack(app, `${projectName}-${environment}-network`, {
    ...baseProps,
    projectName,
    description: `${projectName} - Network Infrastructure (${environment})`,
  });

  // Phase 1: EC2スタックの作成（ネットワークに依存）
  const ec2Stack = new Ec2Stack(app, `${projectName}-${environment}-ec2`, {
    ...baseProps,
    projectName,
    description: `${projectName} - EC2 Server with Geth (${environment})`,
    vpc: networkStack.vpc,
    securityGroup: networkStack.securityGroup,
    keyName: process.env.EC2_KEY_NAME,
    useElasticIp: process.env.USE_ELASTIC_IP === 'true',
    elasticIpAllocationId: process.env.ELASTIC_IP_ALLOCATION_ID,
  });

  // Phase 2: ストレージスタックの作成（独立）
  const storageStack = new Web3CdkStorageStack(app, `${projectName}-${environment}-storage`, {
    ...baseProps,
    projectName,
    description: `${projectName} - Storage Stack (${environment})`,
  });

  // Phase 3: Cache API スタックの作成（独立）
  const cacheApiStack = new CacheApiStack(app, `${projectName}-${environment}-cache-api`, {
    ...baseProps,
    description: `${projectName} - Cache API (${environment})`,
  });

  // Phase 4: Bot API スタックの作成（独立）
  const botApiStack = new BotApiStack(app, `${projectName}-${environment}-bot-api`, {
    ...baseProps,
    projectName,
    description: `${projectName} - Discord Bot API (${environment})`,
  });

  // スタック間の依存関係を明示的に設定
  ec2Stack.addDependency(networkStack);
  
  // EC2スタックがAPIスタックのURL出力を参照するため依存関係を設定
  // 注意: ImportValueを使用しているため、APIスタックが先にデプロイされている必要がある

  console.log(`✅ CDK app initialized successfully for ${environment} environment`);

} catch (error) {
  console.error('❌ Failed to initialize CDK app:');
  
  if (error instanceof Error) {
    console.error(`   ${error.message}`);
    
    // 環境変数関連のエラーの場合は詳細なヘルプを表示
    if (error.message.includes('environment')) {
      console.error('\n💡 Environment Help:');
      console.error('   1. Ensure .env.dev file exists');
      console.error('   2. Run setup script: npm run setup dev');
      console.error('   3. Verify environment name is one of: dev, stg, prod');
    }
  }
  
  process.exit(1);
}

/**
 * 必須環境変数の検証
 */
function validateEnvironmentVariables(account: string | undefined, environment: string): void {
  const errors: string[] = [];

  if (!account) {
    errors.push('CDK_ACCOUNT environment variable is required');
  }

  if (!['dev', 'stg', 'prod'].includes(environment)) {
    errors.push(`Invalid environment '${environment}'. Valid options: dev, stg, prod`);
  }

  if (errors.length > 0) {
    console.error('❌ Environment Variable Errors:');
    errors.forEach(error => console.error(`   ${error}`));
    console.error('\n💡 Setup Help:');
    console.error('   export CDK_ACCOUNT=your-aws-account-id');
    console.error('   export CDK_REGION=your-preferred-region  # optional, defaults to ap-northeast-1');
    console.error('   export CDK_ENV=dev|stg|prod             # optional, defaults to dev');
    throw new Error('Missing required environment variables');
  }
}


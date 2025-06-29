#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Web3CdkStack } from '../lib/web3cdk-stack';
import { ConfigLoader } from '../lib/config/config-loader';

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

  // 設定の読み込み
  console.log(`🔧 Loading configuration for environment: ${environment}`);
  const config = ConfigLoader.load(environment);

  // スタック名の生成（設定ベース）
  const stackName = `${config.project.name}-${environment}-stack`;

  // 環境情報の表示
  console.log(`📋 Deployment Configuration:`);
  console.log(`├── Environment: ${environment}`);
  console.log(`├── Account: ${account}`);
  console.log(`├── Region: ${region}`);
  console.log(`├── Stack Name: ${stackName}`);
  console.log(`└── Project: ${config.project.name}`);

  // スタックの作成
  const stack = new Web3CdkStack(app, stackName, {
    env: { account, region },
    environment: environment,
    config: config,
    description: `${config.project.description} (${environment})`,
  });

  // 環境別の追加設定
  applyEnvironmentSpecificSettings(stack, environment);

  console.log(`✅ CDK app initialized successfully for ${environment} environment`);

} catch (error) {
  console.error('❌ Failed to initialize CDK app:');
  
  if (error instanceof Error) {
    console.error(`   ${error.message}`);
    
    // 設定関連のエラーの場合は詳細なヘルプを表示
    if (error.message.includes('configuration')) {
      console.error('\n💡 Configuration Help:');
      console.error('   1. Ensure config files exist in config/environments/');
      console.error('   2. Check config/defaults.json for base configuration');
      console.error('   3. Verify environment name is one of: dev, stg, prod');
      
      // 利用可能な環境を表示
      try {
        const availableEnvs = ConfigLoader.getAvailableEnvironments();
        if (availableEnvs.length > 0) {
          console.error(`   4. Available environments: ${availableEnvs.join(', ')}`);
        }
      } catch (envError) {
        console.error('   4. Could not list available environments');
      }
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

/**
 * 環境別の追加設定を適用
 */
function applyEnvironmentSpecificSettings(stack: Web3CdkStack, environment: string): void {
  switch (environment) {
    case 'dev':
      // 開発環境では詳細な設定表示
      console.log('🔧 Development environment settings applied');
      break;
      
    case 'stg':
      // ステージング環境の設定
      console.log('🧪 Staging environment settings applied');
      break;
      
    case 'prod':
      // 本番環境の設定（追加の検証など）
      console.log('🔒 Production environment settings applied');
      
      // 本番環境では追加の警告
      console.log('⚠️  Production deployment - please ensure all changes are reviewed');
      break;
  }
}
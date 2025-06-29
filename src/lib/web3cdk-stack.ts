import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { BaseStack } from './stacks/base-stack';
import { BaseStackProps } from './config/types';

/**
 * Web3 CDK メインスタック
 * 設定システムを使用したベーシックなインフラストラクチャを提供
 */
export class Web3CdkStack extends BaseStack {
  public readonly storageBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    // メインストレージバケットの作成
    this.storageBucket = this.createStorageBucket();

    // 環境別の追加設定
    this.applyEnvironmentSpecificConfiguration();
    
    // デプロイタイムスタンプの追加
    this.addDeploymentTimestamp();
  }

  /**
   * メインストレージバケットの作成
   */
  private createStorageBucket(): s3.Bucket {
    const bucketName = this.createUniqueResourceName('storage', 'bucket');
    
    // S3設定を環境設定から取得
    const s3Config = this.config.s3;
    
    // 暗号化方式の設定
    let encryption: s3.BucketEncryption;
    switch (s3Config.encryption) {
      case 'KMS':
        encryption = s3.BucketEncryption.KMS_MANAGED;
        break;
      case 'KMS_MANAGED':
        encryption = s3.BucketEncryption.KMS_MANAGED;
        break;
      default:
        encryption = s3.BucketEncryption.S3_MANAGED;
    }

    // パブリックアクセス設定
    let publicAccessBlockConfiguration: s3.BlockPublicAccess;
    switch (s3Config.publicAccess) {
      case 'BLOCK_ALL':
        publicAccessBlockConfiguration = s3.BlockPublicAccess.BLOCK_ALL;
        break;
      case 'BLOCK_ACLS':
        publicAccessBlockConfiguration = s3.BlockPublicAccess.BLOCK_ACLS;
        break;
      case 'BLOCK_POLICY':
        publicAccessBlockConfiguration = new s3.BlockPublicAccess({
          blockPublicPolicy: true,
          blockPublicAcls: false,
          ignorePublicAcls: false,
          restrictPublicBuckets: false,
        });
        break;
      default:
        publicAccessBlockConfiguration = s3.BlockPublicAccess.BLOCK_ALL;
    }

    const bucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: bucketName,
      versioned: s3Config.versioning,
      encryption: encryption,
      blockPublicAccess: publicAccessBlockConfiguration,
      removalPolicy: this.getRemovalPolicy(),
      autoDeleteObjects: this.getAutoDeleteObjects(),
      lifecycleRules: this.createLifecycleRules(),
      serverAccessLogsBucket: this.isDevelopment() ? undefined : this.createAccessLogsBucket(),
    });

    // バケット出力
    new cdk.CfnOutput(this, 'StorageBucketName', {
      value: bucket.bucketName,
      description: 'Name of the main storage S3 bucket',
      exportName: `${this.stackName}-StorageBucketName`,
    });

    new cdk.CfnOutput(this, 'StorageBucketArn', {
      value: bucket.bucketArn,
      description: 'ARN of the main storage S3 bucket',
      exportName: `${this.stackName}-StorageBucketArn`,
    });

    return bucket;
  }

  /**
   * ライフサイクルルールの作成
   */
  private createLifecycleRules(): s3.LifecycleRule[] {
    const lifecycleDays = this.config.s3.lifecycleDays || 30;
    
    const rules: s3.LifecycleRule[] = [
      {
        id: 'DeleteIncompleteMultipartUploads',
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        enabled: true,
      },
    ];

    // 本番以外では古いバージョンを自動削除
    if (!this.isProduction()) {
      rules.push({
        id: 'DeleteOldVersions',
        noncurrentVersionExpiration: cdk.Duration.days(lifecycleDays),
        enabled: true,
      });
    }

    return rules;
  }

  /**
   * アクセスログ用バケットの作成（本番・ステージングのみ）
   */
  private createAccessLogsBucket(): s3.Bucket | undefined {
    if (this.isDevelopment()) {
      return undefined;
    }

    const logsBucketName = this.createUniqueResourceName('access-logs', 'bucket');
    
    return new s3.Bucket(this, 'AccessLogsBucket', {
      bucketName: logsBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: this.getRemovalPolicy(),
      autoDeleteObjects: this.getAutoDeleteObjects(),
      lifecycleRules: [
        {
          id: 'DeleteAccessLogs',
          expiration: cdk.Duration.days(90),
          enabled: true,
        },
      ],
    });
  }

  /**
   * 環境別の追加設定
   */
  private applyEnvironmentSpecificConfiguration(): void {
    // アプリケーション固有の設定をタグとして追加
    const appConfig = this.config.application;
    if (appConfig) {
      this.addCustomTags({
        'AppName': appConfig.appName,
        'DomainName': appConfig.domainName || '',
        'StackName': appConfig.stackName,
      });
    }

    // 開発環境でのみ実行する設定
    if (this.isDevelopment()) {
      console.log('🔧 Development environment specific configuration applied');
    }

    // 本番環境でのみ実行する設定
    if (this.isProduction()) {
      console.log('🔒 Production environment specific configuration applied');
      
      // 本番環境では追加のセキュリティ設定
      this.addCustomTags({
        'DataClassification': 'Production',
        'BackupRequired': 'true',
      });
    }

    // ステージング環境でのみ実行する設定
    if (this.isStaging()) {
      console.log('🧪 Staging environment specific configuration applied');
    }
  }
}
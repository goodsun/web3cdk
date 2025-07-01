import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SimpleStackProps } from './simple-stack-props';

/**
 * Web3 CDK ストレージスタック
 * S3バケットとストレージ関連リソースを管理
 */
export class Web3CdkStorageStack extends cdk.Stack {
  public readonly storageBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SimpleStackProps) {
    super(scope, id, props);

    // ストレージ機能
    this.storageBucket = this.createStorageBucket(props);

    // タグ設定
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  /**
   * メインストレージバケットの作成
   */
  private createStorageBucket(props: SimpleStackProps): s3.Bucket {
    const bucketName = `${props.projectName}-${props.environment}-storage-${this.account?.slice(-6)}`;
    
    const bucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: bucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod',
    });

    // バケット出力
    new cdk.CfnOutput(this, 'StorageBucketName', {
      value: bucket.bucketName,
      description: 'Name of the main storage S3 bucket',
    });

    new cdk.CfnOutput(this, 'StorageBucketArn', {
      value: bucket.bucketArn,
      description: 'ARN of the main storage S3 bucket',
    });

    return bucket;
  }
}
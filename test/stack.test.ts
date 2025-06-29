import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Web3CdkStack } from '../src/lib/web3cdk-stack';

describe('Web3CdkStack', () => {
  test('S3 Bucket Created', () => {
    const app = new cdk.App();
    
    // スタックの作成
    const stack = new Web3CdkStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
      environment: 'test',
    });
    
    // テンプレートの取得
    const template = Template.fromStack(stack);

    // S3バケットが作成されていることを確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled',
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256',
          },
        }],
      },
    });
  });

  test('Stack has correct tags', () => {
    const app = new cdk.App();
    
    const stack = new Web3CdkStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
      environment: 'test',
    });
    
    const template = Template.fromStack(stack);
    
    // タグが設定されていることを確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: [
        { Key: 'Project', Value: 'web3cdk' },
        { Key: 'Environment', Value: 'test' },
        { Key: 'ManagedBy', Value: 'CDK' },
      ],
    });
  });
});
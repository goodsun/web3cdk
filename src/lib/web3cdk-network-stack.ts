import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SimpleStackProps } from './simple-stack-props';
import { NetworkStack } from '../../lib/constructs/network-stack';

/**
 * Web3 CDK ネットワークスタック
 * VPC、サブネット、セキュリティグループを管理
 */
export class Web3CdkNetworkStack extends cdk.Stack {
  public readonly networkConstruct: NetworkStack;

  constructor(scope: Construct, id: string, props: SimpleStackProps) {
    super(scope, id, props);

    // ネットワーク構成の作成
    this.networkConstruct = new NetworkStack(this, 'Network', {
      projectName: props.projectName,
      environment: props.environment,
    });

    // タグ設定
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  // NetworkStackのプロパティを公開
  public get vpc() {
    return this.networkConstruct.vpc;
  }

  public get securityGroup() {
    return this.networkConstruct.securityGroup;
  }

  public get publicSubnet() {
    return this.networkConstruct.publicSubnet;
  }
}
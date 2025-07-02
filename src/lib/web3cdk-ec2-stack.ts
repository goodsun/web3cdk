import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { SimpleStackProps } from './simple-stack-props';
import { Ec2Stack } from '../../lib/constructs/ec2-stack';

export interface Web3CdkEc2StackProps extends SimpleStackProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
}

/**
 * Web3 CDK EC2スタック
 * EC2インスタンスと関連リソースを管理
 */
export class Web3CdkEc2Stack extends cdk.Stack {
  public readonly ec2Construct: Ec2Stack;

  constructor(scope: Construct, id: string, props: Web3CdkEc2StackProps) {
    super(scope, id, props);

    // EC2構成の作成
    this.ec2Construct = new Ec2Stack(this, 'Ec2', {
      projectName: props.projectName,
      environment: props.environment,
      vpc: props.vpc,
      securityGroup: props.securityGroup,
      keyName: process.env.EC2_KEY_NAME,
      useElasticIp: process.env.USE_ELASTIC_IP === 'true',
      elasticIpAllocationId: process.env.ELASTIC_IP_ALLOCATION_ID,
    });

    // タグ設定
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  // Ec2Stackのプロパティを公開
  public get instance() {
    return this.ec2Construct.instance;
  }

  public get elasticIp() {
    return this.ec2Construct.elasticIp;
  }
}
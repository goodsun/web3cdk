import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { SimpleStackProps } from './simple-stack-props';

/**
 * Web3 CDK ネットワークスタック
 * VPC、サブネット、セキュリティグループを管理
 */
export class Web3CdkNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: SimpleStackProps) {
    super(scope, id, props);

    // VPCの作成
    this.vpc = new ec2.Vpc(this, 'Web3CdkVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // セキュリティグループの作成
    this.securityGroup = new ec2.SecurityGroup(this, 'Web3CdkSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Web3 CDK',
      allowAllOutbound: true,
    });

    // SSH接続許可
    const adminCidr = process.env.ADMIN_CIDR || '0.0.0.0/0';
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(adminCidr),
      ec2.Port.tcp(22),
      'SSH access'
    );

    // HTTP/HTTPS接続許可
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP access'
    );
    
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS access'
    );

    // Geth RPC接続許可
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8545),
      'Geth RPC access'
    );

    // タグ設定
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
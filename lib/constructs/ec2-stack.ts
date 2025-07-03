import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface Ec2StackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  keyName?: string;
  useElasticIp?: boolean;
  elasticIpAllocationId?: string;
  botApiUrl?: string;
  cacheApiUrl?: string;
}

export class Ec2Stack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly elasticIp?: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id, props);

    const ec2Role = new iam.Role(this, "Ec2InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });

    const domainName = process.env.DOMAIN_NAME;
    const email = process.env.EMAIL;

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "dnf update -y",
      "dnf install -y httpd mod_ssl git wget unzip python3-pip",
      "dnf install -y curl --allowerasing",
      "dnf install -y tmux htop tree vim jq net-tools nmap-ncat bind-utils rsync zip mlocate",
      "curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -",
      "dnf install -y nodejs",
      "systemctl start httpd",
      "systemctl enable httpd",
      "dnf install -y python3-certbot-apache",
      "mkdir -p /var/log/web3cdk",
      "updatedb &",
      "cd /opt",
      "wget -q https://gethstore.blob.core.windows.net/builds/geth-linux-amd64-1.11.6-ea9e62ca.tar.gz",
      "tar -xzf geth-linux-amd64-1.11.6-ea9e62ca.tar.gz",
      "mv geth-linux-amd64-1.11.6-ea9e62ca geth",
      "ln -sf /opt/geth/geth /usr/local/bin/geth",
      "rm -f geth-linux-amd64-1.11.6-ea9e62ca.tar.gz",
      "mkdir -p /opt/geth/data",
      "chown -R ec2-user:ec2-user /opt/geth/data",
      `cat > /opt/geth/genesis.json << 'GENESIS_EOF'
{
  "config": {
    "chainId": ${process.env.GETH_CHAIN_ID || 21201},
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "berlinBlock": 0,
    "londonBlock": 0,
    "clique": {
      "period": 0,
      "epoch": 30000
    }
  },
  "alloc": {
    "${process.env.GETH_ADDRESS || '0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248'}": {
      "balance": "${process.env.GETH_INITIAL_BALANCE || '500000000000000000000000'}"
    }
  },
  "coinbase": "0x0000000000000000000000000000000000000000",
  "difficulty": "0x1",
  "extraData": "0x0000000000000000000000000000000000000000000000000000000000000000${(process.env.GETH_ADDRESS || '0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248').substring(2)}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "gasLimit": "0x632EA0",
  "nonce": "0x0000000000000042",
  "mixhash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "timestamp": "0x00"
}
GENESIS_EOF`,
      "cd /opt/geth && geth --datadir data init genesis.json",
      `echo "${process.env.GETH_PASSWORD || 'defaultpassword'}" > /opt/geth/password.txt`,
      `echo "${process.env.GETH_PRIVATE_KEY || ''}" > /opt/geth/privatekey.txt`,
      "cd /opt/geth && geth --datadir data account import --password password.txt privatekey.txt || echo 'Account import failed'",
      "rm -f /opt/geth/privatekey.txt /opt/geth/password.txt",
      `cat > /opt/geth/start-geth.sh << 'START_SCRIPT_EOF'
#!/bin/bash
cd /opt/geth
geth --datadir data \\
  --networkid ${process.env.GETH_CHAIN_ID || 21201} \\
  --http --http.addr 0.0.0.0 --http.port 8545 \\
  --http.api eth,net,web3,personal,miner \\
  --http.corsdomain "*" \\
  --ws --ws.addr 0.0.0.0 --ws.port 8546 \\
  --ws.api eth,net,web3,personal,miner \\
  --ws.origins "*" \\
  --allow-insecure-unlock \\
  --mine --miner.threads 1 \\
  --miner.etherbase ${process.env.GETH_ADDRESS || '0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248'} \\
  --nodiscover \\
  --console
START_SCRIPT_EOF`,
      "chmod +x /opt/geth/start-geth.sh",
      "chown -R ec2-user:ec2-user /opt/geth",
      `cat > /etc/systemd/system/geth.service << 'SYSTEMD_EOF'
[Unit]
Description=Geth Ethereum Node
After=network.target

[Service]
Type=simple
User=ec2-user
Group=ec2-user
WorkingDirectory=/opt/geth
ExecStart=/usr/local/bin/geth --datadir data --networkid ${process.env.GETH_CHAIN_ID || 21201} --http --http.addr 0.0.0.0 --http.port 8545 --http.corsdomain "*" --http.api eth,net,web3,personal,miner --ws --ws.addr 0.0.0.0 --ws.port 8546 --ws.api eth,net,web3,personal,miner --ws.origins "*" --allow-insecure-unlock --mine --miner.threads 1 --miner.etherbase ${process.env.GETH_ADDRESS || '0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248'} --nodiscover
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF`,
      "systemctl daemon-reload",
      "systemctl enable geth",
      "systemctl start geth"
    );

    if (domainName && email) {
      userData.addCommands(
        `mkdir -p /var/www/html/${domainName}`,
        `mkdir -p /var/www/html/.well-known/acme-challenge`,
        `echo '<h1>Web3 CDK Server</h1>' > /var/www/html/${domainName}/index.html`,
        `cat > /etc/httpd/conf.d/${domainName}.conf << 'EOF'
<VirtualHost *:80>
    ServerName ${domainName}
    DocumentRoot /var/www/html/${domainName}
    
    # SSL証明書取得のためのWebroot認証
    Alias /.well-known/acme-challenge /var/www/html/.well-known/acme-challenge
    <Directory "/var/www/html/.well-known/acme-challenge">
        Options None
        AllowOverride None
        Require all granted
    </Directory>
</VirtualHost>
EOF`,
        "systemctl reload httpd",
        `SERVER_IP=$(curl -s https://api.ipify.org)`,
        `DNS_IP=$(dig +short ${domainName} | tail -n1)`,
        `if [ "$SERVER_IP" = "$DNS_IP" ]; then
          /usr/bin/certbot-3 --apache -d ${domainName} --email ${email} --agree-tos --non-interactive ${process.env.CERTBOT_STAGING === 'true' ? '--staging' : ''} --redirect
          if [ -f "/etc/httpd/conf.d/${domainName}-le-ssl.conf" ]; then
            sed -i '/<VirtualHost.*:443>/a\\
\\
    # SSL Proxy Engine設定（AWS API Gateway用）\\
    SSLProxyEngine On\\
    SSLProxyVerify none\\
    SSLProxyCheckPeerCN off\\
    SSLProxyCheckPeerName off\\
    SSLProxyCheckPeerExpire off\\
\\
    # API Gateway プロキシ設定（重要: ProxyPreserveHost Off）\\
    ProxyPreserveHost Off\\
    ProxyRequests Off\\
\\
    # リバースプロキシ設定例（手動で設定してください）\\
    # Bot API プロキシ\\
    # ProxyPass /api/bot/ https://[API_ID].execute-api.ap-northeast-1.amazonaws.com/bot/\\
    # ProxyPassReverse /api/bot/ https://[API_ID].execute-api.ap-northeast-1.amazonaws.com/bot/\\
\\
    # Cache API プロキシ\\
    # ProxyPass /api/cache/ https://[API_ID].execute-api.ap-northeast-1.amazonaws.com/cache/\\
    # ProxyPassReverse /api/cache/ https://[API_ID].execute-api.ap-northeast-1.amazonaws.com/cache/\\
\\
    # Geth RPC プロキシ（ローカル）\\
    ProxyPass /rpc http://localhost:8545\\
    ProxyPassReverse /rpc http://localhost:8545\\
\\
    # レスポンスヘッダーの設定\\
    <LocationMatch "^/(api|rpc)/">\\
        Header always set Access-Control-Allow-Origin "*"\\
        Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"\\
        Header always set Access-Control-Allow-Headers "Content-Type, Authorization"\\
    </LocationMatch>' /etc/httpd/conf.d/${domainName}-le-ssl.conf
            systemctl reload httpd
          fi
        fi`,
        "",
        "# リバースプロキシ設定方法",
        `echo "========================================="`,
        `echo "リバースプロキシを設定するには:"`,
        `echo "1. Bot API URL: aws cloudformation describe-stacks --stack-name web3cdk-${props.environment}-bot-api --query 'Stacks[0].Outputs[?OutputKey==\\"BotApiUrl\\"].OutputValue' --output text"`,
        `echo "2. Cache API URL: aws cloudformation describe-stacks --stack-name web3cdk-${props.environment}-cache-api --query 'Stacks[0].Outputs[?OutputKey==\\"CacheApiEndpoint\\"].OutputValue' --output text"`,
        `echo "3. sudo vi /etc/httpd/conf.d/${domainName}-le-ssl.conf"`,
        `echo "4. コメントアウトされたProxyPass設定を有効化し、[API_ID]を実際のIDに置換"`,
        `echo "5. sudo systemctl reload httpd"`,
        `echo "========================================="`,
        ""
      );
    }

    this.instance = new ec2.Instance(this, "Web3CdkInstance", {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: props.securityGroup,
      keyPair: props.keyName ? ec2.KeyPair.fromKeyPairName(this, 'KeyPair', props.keyName) : undefined,
      role: ec2Role,
      userData: userData,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    if (props.useElasticIp) {
      if (props.elasticIpAllocationId) {
        new ec2.CfnEIPAssociation(this, "ElasticIpAssociation", {
          instanceId: this.instance.instanceId,
          allocationId: props.elasticIpAllocationId,
        });
      } else {
        this.elasticIp = new ec2.CfnEIP(this, "ElasticIP", {
          domain: "vpc",
          instanceId: this.instance.instanceId,
        });
      }
    }

    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environment);

    new cdk.CfnOutput(this, "InstanceId", {
      value: this.instance.instanceId,
    });

    new cdk.CfnOutput(this, "InstancePublicIp", {
      value: this.instance.instancePublicIp,
    });
  }
}

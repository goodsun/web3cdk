import express, { Request, Response } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
// Using built-in fetch for avatar image handling

const app = express();

// Discord Response Helper Functions (DRY原則適用)
function createDiscordResponse(content: string, ephemeral = true) {
  return {
    type: 4,
    data: {
      content,
      ...(ephemeral && { flags: 64 }),
    },
  };
}

function sendErrorResponse(res: Response, message: string) {
  res.json(createDiscordResponse(`${message}`));
}

function sendSuccessResponse(res: Response, message: string) {
  res.json(createDiscordResponse(`${message}`));
}

function sendInfoResponse(res: Response, message: string, ephemeral = true) {
  res.json(createDiscordResponse(message, ephemeral));
}

// DynamoDB Helper Functions (DRY原則適用)
async function getFromDynamoDB(tableName: string, key: any) {
  try {
    const command = new GetCommand({ TableName: tableName, Key: key });
    const response = await docClient.send(command);
    return response.Item || null;
  } catch (error) {
    console.error(`Error getting from ${tableName}:`, error);
    return null;
  }
}

async function putToDynamoDB(tableName: string, item: any) {
  try {
    const command = new PutCommand({ TableName: tableName, Item: item });
    await docClient.send(command);
    return true;
  } catch (error) {
    console.error(`Error putting to ${tableName}:`, error);
    return false;
  }
}

async function scanDynamoDB(tableName: string, options: any = {}) {
  try {
    const command = new ScanCommand({ TableName: tableName, ...options });
    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error(`Error scanning ${tableName}:`, error);
    return [];
  }
}

async function deleteDynamoDB(tableName: string, key: any) {
  try {
    const command = new DeleteCommand({ TableName: tableName, Key: key });
    await docClient.send(command);
    return true;
  } catch (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    return false;
  }
}

// Error Handling Wrapper Functions (DRY原則適用)
async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  defaultValue: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
    return defaultValue;
  }
}

function handleDiscordCommand(
  handler: (req: Request, res: Response, interaction: any) => Promise<void>
) {
  return async (req: Request, res: Response, interaction: any) => {
    try {
      await handler(req, res, interaction);
    } catch (error) {
      console.error("Discord command error:", error);
      sendErrorResponse(res, "処理中にエラーが発生しました。");
    }
  };
}

function handleApiEndpoint(
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("API endpoint error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  };
}
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.TABLE_NAME || "";
const discordEOATableName = process.env.DISCORD_EOA_TABLE_NAME || "";
const registrationTokenTableName =
  process.env.REGISTRATION_TOKEN_TABLE_NAME || "";
const discordPublicKey = process.env.DISCORD_PUBLIC_KEY || "";
const discordBotToken = process.env.DISCORD_BOT_TOKEN || "";
const discordGuildId = process.env.DISCORD_GUILD_ID || "";
const apiBaseUrl = process.env.API_BASE_URL || "";
const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS || "";
const nftChainId = process.env.NFT_CHAIN_ID || "";
const nftRpcUrl = process.env.NFT_RPC_URL || "";
const wantRequestTableName = process.env.WANT_REQUEST_TABLE_NAME || "";
const conversationTableName = process.env.CONVERSATION_TABLE_NAME || "";

// ミドルウェア
app.use(express.json());

// Discord署名検証関数
function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  try {
    const message = timestamp + body;

    // Ed25519 raw public key (32 bytes) を SubjectPublicKeyInfo DER format に変換
    const publicKeyHex = discordPublicKey;

    // Ed25519 public key の DER エンコード (SubjectPublicKeyInfo)
    const derPrefix = "302a300506032b6570032100"; // Ed25519 OID + 32 bytes key length
    const derKey = derPrefix + publicKeyHex;

    const publicKey = crypto.createPublicKey({
      key: Buffer.from(derKey, "hex"),
      format: "der",
      type: "spki",
    });

    const isVerified = crypto.verify(
      null,
      Buffer.from(message),
      publicKey,
      Buffer.from(signature, "hex")
    );
    return isVerified;
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

// Discord Helper Functions (DRY原則適用)
function generateDiscordAvatarUrl(
  userId: string,
  avatarHash: string | null
): string {
  if (avatarHash) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}`;
  }
  const defaultAvatarNumber = (BigInt(userId) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
}

async function fetchDiscordAPI(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bot ${discordBotToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Discord API error: ${response.status} - ${errorData}`);
  }

  return response.json();
}

function validateDiscordConfig(res: Response): boolean {
  if (!discordGuildId) {
    res.status(500).json({ error: "Discord Guild ID not configured" });
    return false;
  }
  if (!discordBotToken) {
    res.status(500).json({ error: "Discord Bot Token not configured" });
    return false;
  }
  return true;
}

async function getGuildRoles(): Promise<Map<string, any>> {
  try {
    const guildRoles: any[] = await fetchDiscordAPI(
      `/guilds/${discordGuildId}/roles`
    );
    return new Map<string, any>(guildRoles.map((role: any) => [role.id, role]));
  } catch (error) {
    console.error("Failed to fetch guild roles:", error);
    return new Map();
  }
}

// CSV Processing Helper Functions (DRY原則適用)
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function validateCSVRow(row: string[], rowIndex: number): { isValid: boolean; error?: string } {
  if (row.length < 2) {
    return { isValid: false, error: `Row ${rowIndex}: Missing required columns (DiscordId, Eoa)` };
  }
  
  const [discordId, eoa] = row;
  
  // Discord ID validation
  if (!discordId || !discordId.match(/^\d{17,20}$/)) {
    return { isValid: false, error: `Row ${rowIndex}: Invalid Discord ID format` };
  }
  
  // EOA validation
  if (!eoa || !eoa.match(/^0x[a-fA-F0-9]{40}$/)) {
    return { isValid: false, error: `Row ${rowIndex}: Invalid EOA address format` };
  }
  
  return { isValid: true };
}

async function processCSVImport(csvContent: string): Promise<{ success: number; errors: string[] }> {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  const errors: string[] = [];
  let success = 0;
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const validation = validateCSVRow(row, i + 1);
    
    if (!validation.isValid) {
      errors.push(validation.error!);
      continue;
    }
    
    const [discordId, eoa, username, name] = row;
    
    try {
      // Check for existing registration
      const existing = await getFromDynamoDB(discordEOATableName, { discord_id: discordId });
      if (existing) {
        errors.push(`Row ${i + 1}: Discord ID ${discordId} already registered with EOA ${existing.eoa_address}`);
        continue;
      }
      
      // Check for duplicate EOA
      const duplicateEoa = await scanDynamoDB(discordEOATableName, {
        FilterExpression: "eoa_address = :eoa",
        ExpressionAttributeValues: { ":eoa": eoa.toLowerCase() }
      });
      
      if (duplicateEoa.length > 0) {
        errors.push(`Row ${i + 1}: EOA ${eoa} already registered with Discord ID ${duplicateEoa[0].discord_id}`);
        continue;
      }
      
      // Insert new mapping with correct structure
      const registrationDate = new Date().toISOString();
      const csvImportMessage = `CSV Import - Discord ID: ${discordId}, EOA: ${eoa.toLowerCase()}, Timestamp: ${Date.now()}`;
      
      const item = {
        discord_id: discordId,
        eoa_address: eoa.toLowerCase(),
        registration_date: registrationDate,
        signature: "CSV_IMPORT_NO_SIGNATURE",
        message: csvImportMessage,
        status: "verified"
      };
      
      const result = await putToDynamoDB(discordEOATableName, item);
      if (result) {
        success++;
      } else {
        errors.push(`Row ${i + 1}: Failed to save mapping for Discord ID ${discordId}`);
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: Error processing Discord ID ${discordId} - ${error}`);
    }
  }
  
  return { success, errors };
}

// Discord Member Card Generation (SVG-based)
async function generateMemberCard(memberData: any): Promise<string> {
  // 参加日フォーマット
  const joinDate = memberData.joined_at 
    ? new Date(memberData.joined_at).toLocaleDateString('ja-JP')
    : 'Unknown';

  // EOAアドレス（全体表示）
  const walletAddress = memberData.eoa_address || 'Not connected';

  // トップ6ロール取得（バッジ表示用）
  const topRoles = memberData.roles
    .filter((role: any) => role.name !== '@everyone')
    .sort((a: any, b: any) => b.position - a.position)
    .slice(0, 6);

  // フッターテキスト取得
  const projectName = process.env.PROJECT_NAME || process.env.STACK_NAME || 'FLOW\'S PRD PROJECT';
  const footerText = `Generated by ${projectName}`;

  const width = 800;
  const height = 494;
  
  // SVG生成
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#222222;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#443377;stop-opacity:1"/>
        </linearGradient>
        <clipPath id="avatarClip">
          <circle cx="140" cy="227" r="50"/>
        </clipPath>
      </defs>

      <!-- 背景グラデーション -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

      <!-- カード背景 -->
      <rect x="30" y="30" width="740" height="434" rx="20" fill="rgba(255,255,255,0.95)"/>

      <!-- ユーザー情報グループ -->
      <g id="userInfoGroup" transform="translate(30, 0)">
        <!-- アバター切り抜き枠 -->
        <circle cx="140" cy="227" r="50" fill="none" stroke="#5533aa" stroke-width="5"/>

        <!-- アバター画像 -->
        <image x="90" y="177" width="100" height="100" href="${memberData.avatar_url}" clip-path="url(#avatarClip)"/>

        <!-- ユーザー名 -->
        <text x="220" y="197" font-family="Arial" font-size="28" font-weight="bold" fill="#333333">${memberData.display_name}</text>

        <!-- ユーザーネーム -->
        <text x="220" y="222" font-family="Arial" font-size="18" fill="#666666">@${memberData.username}</text>

        <!-- EOAアドレス -->
        <text x="220" y="247" font-family="monospace" font-size="14" fill="#666666">Wallet: ${walletAddress}</text>

        <!-- 参加日 -->
        <text x="220" y="267" font-family="Arial" font-size="14" fill="#666666">Joined: ${joinDate}</text>
      </g>

      <!-- ロール -->
      ${(() => {
        if (topRoles.length === 0) {
          return `<g id="rolesGroup" transform="translate(122.5, 300)">
            <text x="70" y="20" font-family="Arial" font-size="16" font-weight="bold" fill="#333333" text-anchor="middle">Roles:</text>
            <text x="150" y="20" font-family="Arial" font-size="14" fill="#666666">No roles assigned</text>
          </g>`;
        }

        // バッジ幅を動的に計算
        const badges = topRoles.map((role: any) => {
          const roleColor = role.color !== 0 ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
          const badgeWidth = Math.max(60, role.name.length * 8 + 20);
          return { name: role.name, color: roleColor, width: badgeWidth };
        });

        const totalBadgeWidth = badges.reduce((sum: number, badge: any) => sum + badge.width, 0);
        const gaps = badges.length - 1;
        const gapWidth = 12;
        const totalGapsWidth = gaps * gapWidth;
        const rolesLabelWidth = 70;
        const totalWidth = rolesLabelWidth + 15 + totalBadgeWidth + totalGapsWidth;
        
        // 中央揃えの開始位置計算
        const startX = (800 - totalWidth) / 2;
        
        let result = `<g id="rolesGroup" transform="translate(${startX}, 300)">`;
        result += `<text x="35" y="20" font-family="Arial" font-size="16" font-weight="bold" fill="#333333" text-anchor="middle">Roles:</text>`;
        
        let currentX = rolesLabelWidth + 15;
        badges.forEach((badge: any) => {
          const centerX = currentX + badge.width / 2;
          result += `
          <rect x="${currentX}" y="5" width="${badge.width}" height="25" rx="12" fill="${badge.color}"/>
          <text x="${centerX}" y="20" font-family="Arial" font-size="12" text-anchor="middle" fill="#ffffff">${badge.name}</text>`;
          currentX += badge.width + gapWidth;
        });
        
        result += `</g>`;
        return result;
      })()}

      <!-- フッター -->
      <text x="750" y="448" font-family="Arial" font-size="11" text-anchor="end" fill="#999999">${footerText}</text>
    </svg>`;

  // SVGをそのまま文字列として返す
  return svg;
}

// Discord EOA 関連のヘルパー関数
async function checkExistingRegistration(discordId: string) {
  return await getFromDynamoDB(discordEOATableName, { discord_id: discordId });
}

async function generateRegistrationToken(discordId: string) {
  const token = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1時間後

  console.log(`Generating token for Discord ID: ${discordId}, table: ${registrationTokenTableName}`);
  
  const success = await putToDynamoDB(registrationTokenTableName, {
    token,
    discord_id: discordId,
    expires_at: expiresAt,
    used: false,
  });

  console.log(`Token generation result: ${success}, token: ${success ? token : 'null'}`);
  console.log(`Environment check - DISCORD_PUBLIC_KEY: ${discordPublicKey ? 'SET' : 'EMPTY'}`);
  return success ? token : null;
}

async function getTemporaryToken(token: string) {
  return await getFromDynamoDB(registrationTokenTableName, { token });
}

async function markTokenAsUsed(token: string) {
  return await putToDynamoDB(registrationTokenTableName, {
    token,
    used: true,
    expires_at: Math.floor(Date.now() / 1000) + 60, // 1分後に期限切れ
  });
}

async function saveDiscordEOAMapping(data: any) {
  return await putToDynamoDB(discordEOATableName, data);
}

async function sendDiscordDM(userId: string, message: string) {
  return await handleAsyncOperation(
    async () => {
      // ユーザーとのDMチャンネルを作成
      try {
        const dmChannel = await fetchDiscordAPI("/users/@me/channels", {
          method: "POST",
          body: JSON.stringify({
            recipient_id: userId,
          }),
        });

        // DMを送信
        await fetchDiscordAPI(`/channels/${dmChannel.id}/messages`, {
          method: "POST",
          body: JSON.stringify({
            content: message,
          }),
        });

        return true;
      } catch (error) {
        console.error("Failed to send Discord DM:", error);
        return false;
      }
    },
    "Error sending Discord DM:",
    false
  );
}

async function revokeRegistration(discordId: string) {
  return await deleteDynamoDB(discordEOATableName, { discord_id: discordId });
}

// NFT関連ヘルパー関数
async function getNFTOwner(tokenId: number): Promise<string | null> {
  return handleAsyncOperation(
    async () => {
      const provider = new ethers.JsonRpcProvider(nftRpcUrl);
      const contract = new ethers.Contract(
        nftContractAddress,
        ["function ownerOf(uint256) view returns (address)"],
        provider
      );

      const owner = await contract.ownerOf(tokenId);
      return owner.toLowerCase();
    },
    "Error getting NFT owner:",
    null
  );
}

async function getDiscordIdByEOA(eoaAddress: string): Promise<string | null> {
  const results = await scanDynamoDB(discordEOATableName, {
    FilterExpression: "eoa_address = :eoa",
    ExpressionAttributeValues: {
      ":eoa": eoaAddress.toLowerCase(),
    },
  });

  return results.length > 0 ? results[0].discord_id : null;
}

async function saveWantRequest(data: any) {
  return await putToDynamoDB(wantRequestTableName, data);
}

async function getNFTMetadata(tokenId: number) {
  return handleAsyncOperation(
    async () => {
      const provider = new ethers.JsonRpcProvider(nftRpcUrl);
      const contract = new ethers.Contract(
        nftContractAddress,
        [
          "function tokenURI(uint256) view returns (string)",
          "function name() view returns (string)",
          "function symbol() view returns (string)",
        ],
        provider
      );

      const [tokenURI, name, symbol] = await Promise.all([
        contract.tokenURI(tokenId),
        contract.name(),
        contract.symbol(),
      ]);

      // メタデータJSONを取得
      let metadata: any = {};
      if (tokenURI) {
        try {
          // HTTPSの場合は直接取得、IPFSの場合は変換
          let metadataUrl = tokenURI;
          if (tokenURI.startsWith("ipfs://")) {
            metadataUrl = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
          }

          const response = await fetch(metadataUrl);
          if (response.ok) {
            metadata = await response.json();
          }
        } catch (error) {
          console.error("Error fetching metadata:", error);
        }
      }

      return {
        name: metadata.name || `${name} #${tokenId}`,
        description: metadata.description || "",
        image: metadata.image
          ? metadata.image.startsWith("ipfs://")
            ? metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")
            : metadata.image
          : "",
        collection_name: name,
        collection_symbol: symbol,
        token_id: tokenId,
      };
    },
    "Error getting NFT metadata:",
    {
      name: `NFT #${tokenId}`,
      description: "",
      image: "",
      collection_name: "Unknown Collection",
      collection_symbol: "",
      token_id: tokenId,
    }
  );
}

async function getDiscordUserInfo(userId: string) {
  return handleAsyncOperation(
    async () => {
      // まずギルドメンバーとして取得を試行
      try {
        const member: any = await fetchDiscordAPI(
          `/guilds/${discordGuildId}/members/${userId}`
        );

        // アバターURLを構築
        const avatarUrl = generateDiscordAvatarUrl(
          member.user.id,
          member.user.avatar
        );

        return {
          username: member.user.username,
          display_name:
            member.nick || member.user.global_name || member.user.username,
          avatar_url: avatarUrl,
          user_id: userId,
        };
      } catch (memberError) {
        // ギルドメンバーでない場合は直接ユーザー情報を取得
        try {
          const user: any = await fetchDiscordAPI(`/users/${userId}`);

          // アバターURLを構築
          const avatarUrl = generateDiscordAvatarUrl(user.id, user.avatar);

          return {
            username: user.username,
            display_name: user.global_name || user.username,
            avatar_url: avatarUrl,
            user_id: userId,
          };
        } catch (userError) {
          console.error("Failed to fetch user info:", userError);
        }
      }
      return null;
    },
    "Error fetching Discord user info:",
    null
  );
}

async function saveConversation(data: any) {
  return await putToDynamoDB(conversationTableName, data);
}

async function checkExistingWantRequest(nftId: number, requesterId: string) {
  const currentTime = Math.floor(Date.now() / 1000);

  const results = await scanDynamoDB(wantRequestTableName, {
    FilterExpression:
      "nft_id = :nft_id AND requester_discord_id = :requester_id AND #status = :status AND expires_at > :current_time",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":nft_id": nftId,
      ":requester_id": requesterId,
      ":status": "pending",
      ":current_time": currentTime,
    },
  });

  return results.length > 0 ? results[0] : null;
}

async function getActiveConversation(user1Id: string, user2Id: string) {
  try {
    // 両方向で検索
    const results = await scanDynamoDB(conversationTableName, {
      FilterExpression:
        "(user1_id = :u1 AND user2_id = :u2) OR (user1_id = :u2 AND user2_id = :u1)",
      ExpressionAttributeValues: {
        ":u1": user1Id,
        ":u2": user2Id,
      },
    });

    if (results && results.length > 0) {
      // 最新の会話を取得
      return results.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    }
    return null;
  } catch (error) {
    console.error("Error getting active conversation:", error);
    return null;
  }
}

// ルートエンドポイント
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Web3DiscordTools",
    endpoints: [
      "GET /health - Health check",
      "GET /items - Get all items",
      "GET /items/:id?timestamp=xxx - Get specific item",
      "POST /items - Create new item",
      "POST /discord - Discord webhook endpoint",
      "GET /discord/info - Get guild information",
      "GET /discord/members?limit=100 - Get guild members",
      "GET /discord/member/:userId - Get specific member",
      "GET /discord/eoa/:eoa - Get Discord member by EOA address",
      "GET /discord/membercard/:discordId - Generate member card image (WebP)",
      "GET /register.html - Registration page",
      "POST /discord/register/verify - Verify wallet signature",
      "GET /transfer.html - NFT transfer page",
      "POST /discord/transfer/verify - Verify NFT transfer",
      "POST /discord/reply - Reply to DM conversation",
    ],
  });
});

// ヘルスチェック
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "healthy", tableName });
});

// 全アイテムを取得
app.get("/items", async (req: Request, res: Response) => {
  try {
    const items = await scanDynamoDB(tableName);
    res.json(items);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 特定のアイテムを取得
app.get("/items/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const timestamp = req.query.timestamp as string;

    if (!timestamp) {
      res
        .status(400)
        .json({ message: "timestamp query parameter is required" });
      return;
    }

    const command = new GetCommand({
      TableName: tableName,
      Key: {
        id: id,
        timestamp: Number(timestamp),
      },
    });
    const response = await docClient.send(command);

    if (!response.Item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    res.json(response.Item);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 新しいアイテムを作成
app.post("/items", async (req: Request, res: Response) => {
  try {
    const item = {
      id: req.body.id || Date.now().toString(),
      timestamp: Date.now(),
      ...req.body,
    };

    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });
    await docClient.send(command);

    res.status(201).json(item);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Discord Webhookエンドポイント
app.post("/discord", async (req: Request, res: Response) => {
  console.log("Discord webhook received");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  const signature = req.headers["x-signature-ed25519"] as string;
  const timestamp = req.headers["x-signature-timestamp"] as string;
  const rawBody = JSON.stringify(req.body);

  // 署名検証をスキップして、まずは疎通確認
  if (!signature || !timestamp) {
    console.error("Missing signature or timestamp headers");
    res.status(401).json({ error: "Missing required headers" });
    return;
  }

  // 署名検証
  if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
    console.error("Invalid signature");
    console.error("Public Key:", discordPublicKey);
    console.error("Signature:", signature);
    console.error("Timestamp:", timestamp);
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const interaction = req.body;

  // Ping応答
  if (interaction.type === 1) {
    res.json({ type: 1 });
    return;
  }

  // スラッシュコマンド処理
  if (interaction.type === 2) {
    const { name, options } = interaction.data;

    switch (name) {
      case "ping":
        sendInfoResponse(res, "pingを受信しました。", false);
        break;

      case "echo":
        const message = options?.[0]?.value || "No message provided";
        sendInfoResponse(res, `Echo: ${message}`, false);
        break;

      case "items":
        const items = await scanDynamoDB(tableName, { Limit: 10 });
        const content =
          items.length > 0
            ? `Found ${items.length} items:\n${items
                .map((item) => `- ${item.id}: ${JSON.stringify(item)}`)
                .join("\n")}`
            : "No items found in the database.";
        sendInfoResponse(res, content, false);
        break;

      case "register":
        try {
          const userId = interaction.member?.user?.id || interaction.user?.id;

          // 既に登録済みかチェック
          const existingRecord = await checkExistingRegistration(userId);
          if (existingRecord) {
            const content = `既に登録済みです。\nアドレス: \`${
              existingRecord.eoa_address
            }\`\n登録日: ${new Date(
              existingRecord.registration_date
            ).toLocaleDateString("ja-JP")}`;
            sendInfoResponse(res, content);
            break;
          }

          // 一時トークン生成
          const token = await generateRegistrationToken(userId);

          // DM送信
          const registrationUrl = `${apiBaseUrl}/register.html?token=${token}`;
          const dmMessage = `🔗 **ウォレット登録**\n\n以下のリンクをクリックしてMetaMaskを接続し、署名を完了してください：\n${registrationUrl}\n\n⏰ このリンクは1時間で期限切れになります。`;

          const dmSent = await sendDiscordDM(userId, dmMessage);

          if (dmSent) {
            sendSuccessResponse(
              res,
              "登録用URLをDMで送信しました。DMを確認してください。"
            );
          } else {
            sendErrorResponse(
              res,
              "DMの送信に失敗しました。DMが無効になっていないか確認してください。"
            );
          }
        } catch (error) {
          console.error("Registration error:", error);
          sendErrorResponse(res, "登録処理中にエラーが発生しました。");
        }
        break;

      case "status":
        try {
          const userId = interaction.member?.user?.id || interaction.user?.id;
          const registration = await checkExistingRegistration(userId);

          if (registration) {
            const content = `**登録済み**\n\nアドレス: \`${
              registration.eoa_address
            }\`\n登録日: ${new Date(
              registration.registration_date
            ).toLocaleDateString("ja-JP")}\nステータス: ${registration.status}`;
            sendInfoResponse(res, content);
          } else {
            sendErrorResponse(
              res,
              "**未登録**\n\n`/register` コマンドでウォレットを登録してください。"
            );
          }
        } catch (error) {
          console.error("Status check error:", error);
          sendErrorResponse(res, "ステータス確認中にエラーが発生しました。");
        }
        break;

      case "unregister":
        try {
          const userId = interaction.member?.user?.id || interaction.user?.id;
          const registration = await checkExistingRegistration(userId);

          if (!registration) {
            sendErrorResponse(res, "登録されていません。");
            break;
          }

          const success = await revokeRegistration(userId);

          if (success) {
            sendSuccessResponse(
              res,
              `ウォレット登録を解除しました。\n解除されたアドレス: \`${registration.eoa_address}\``
            );
          } else {
            sendErrorResponse(res, "登録解除中にエラーが発生しました。");
          }
        } catch (error) {
          console.error("Unregister error:", error);
          sendErrorResponse(res, "登録解除中にエラーが発生しました。");
        }
        break;

      case "want":
        try {
          const userId = interaction.member?.user?.id || interaction.user?.id;
          const nftId = options?.[0]?.value;
          const message = options?.[1]?.value || "";

          if (!nftId || typeof nftId !== "number") {
            sendErrorResponse(res, "有効なNFT IDを指定してください。");
            break;
          }

          // ユーザーが登録済みか確認
          const requesterRegistration = await checkExistingRegistration(userId);
          if (!requesterRegistration) {
            sendErrorResponse(
              res,
              "先に `/register` コマンドでウォレットを登録してください。"
            );
            break;
          }

          // NFTオーナーを取得
          const ownerAddress = await getNFTOwner(nftId);
          if (!ownerAddress) {
            sendErrorResponse(
              res,
              `NFT #${nftId} は存在しないか、取得できませんでした。`
            );
            break;
          }

          // オーナーのDiscord IDを取得
          const ownerDiscordId = await getDiscordIdByEOA(ownerAddress);
          if (!ownerDiscordId) {
            sendErrorResponse(
              res,
              `NFT #${nftId} のオーナー (EOA: ${ownerAddress}) はDiscordアカウントを登録していません。`
            );
            break;
          }

          // 既存のアクティブなリクエストをチェック
          const existingRequest = await checkExistingWantRequest(nftId, userId);
          if (existingRequest) {
            const expiresDate = new Date(existingRequest.expires_at * 1000);
            const expiresString = expiresDate.toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });

            sendErrorResponse(
              res,
              `NFT #${nftId} に対して既にリクエスト中です。\n期限: ${expiresString}`
            );
            break;
          }

          // 自分のNFTを要求していないかチェック
          if (ownerDiscordId === userId) {
            sendErrorResponse(res, "自分のNFTを要求することはできません。");
            break;
          }

          // Wantリクエストを保存
          const requestId = uuidv4();
          const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24時間後

          await saveWantRequest({
            request_id: requestId,
            nft_id: nftId,
            requester_discord_id: userId,
            owner_discord_id: ownerDiscordId,
            message: message,
            created_at: new Date().toISOString(),
            status: "pending",
            expires_at: expiresAt,
          });

          // 会話を作成/取得
          const conversationId = uuidv4();
          await saveConversation({
            conversation_id: conversationId,
            user1_id: userId,
            user2_id: ownerDiscordId,
            nft_id: nftId,
            request_id: requestId,
            status: "active",
            created_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          });

          // オーナーにDM送信
          const requesterUser = interaction.member?.user || interaction.user;
          const requesterName =
            requesterUser?.global_name || requesterUser?.username || "Unknown";

          const transferUrl = `${apiBaseUrl}/transfer.html?token=${requestId}&nft_id=${nftId}`;

          let dmMessage = `🎯 **NFT譲渡リクエスト**\n\n`;
          dmMessage += `**NFT**: #${nftId}\n`;
          dmMessage += `**リクエスト者**: @${requesterUser?.username} (${requesterName})\n\n`;

          if (message) {
            dmMessage += `**メッセージ**:\n> ${message}\n\n`;
          }

          dmMessage += `**返信するには**: \`/reply ${conversationId} あなたのメッセージ\`\n\n`;
          dmMessage += `**フレンド申請する場合**: \`@${requesterUser?.username}\` を検索してフレンド申請\n\n`;
          dmMessage += `**NFTを譲渡する場合は以下のリンクをクリック**:\n${transferUrl}\n\n`;
          dmMessage += `⏰ このリンクは24時間で期限切れになります。`;

          const dmSent = await sendDiscordDM(ownerDiscordId, dmMessage);

          if (dmSent) {
            let responseMessage = `NFT #${nftId} のオーナーに譲渡リクエストを送信しました\n\n`;
            if (message) {
              responseMessage += `**あなたのメッセージ**:\n> ${message}\n\n`;
            }
            responseMessage += `**オーナーからの返信を待つか、以下のコマンドで返信**:\n\`/reply ${conversationId} あなたのメッセージ\``;

            // リクエスト者にも会話IDを含むDMを送信
            const ownerUser = await getDiscordUserInfo(ownerDiscordId);
            const ownerUsername = ownerUser?.username || "Unknown";
            const requesterDM = `📩 **NFT #${nftId} 譲渡リクエスト送信完了**\n\n${
              message ? `あなたのメッセージ: "${message}"\n\n` : ""
            }**返信を受け取る、または追加メッセージを送るには**:\n\`/reply ${conversationId} あなたのメッセージ\`\n\n**オーナーとフレンドになる場合**: \`@${ownerUsername}\` を検索してフレンド申請\n\n返信をお待ちください。`;
            await sendDiscordDM(userId, requesterDM);

            sendInfoResponse(res, responseMessage);
          } else {
            sendErrorResponse(res, "オーナーへの通知送信に失敗しました。");
          }
        } catch (error) {
          console.error("Want command error:", error);
          sendErrorResponse(res, "処理中にエラーが発生しました。");
        }
        break;

      case "reply":
        try {
          const userId = interaction.member?.user?.id || interaction.user?.id;
          const conversationId = options?.[0]?.value;
          const message = options?.[1]?.value;

          if (!conversationId || !message) {
            sendErrorResponse(res, "会話IDとメッセージを指定してください。");
            break;
          }

          // 会話を取得
          const conversation = await getFromDynamoDB(conversationTableName, {
            conversation_id: conversationId,
          });

          if (!conversation) {
            sendErrorResponse(res, "会話が見つかりません。");
            break;
          }

          // 送信者が会話の参加者か確認
          if (
            conversation.user1_id !== userId &&
            conversation.user2_id !== userId
          ) {
            sendErrorResponse(res, "この会話に参加する権限がありません。");
            break;
          }

          // 相手のユーザーIDを取得
          const recipientId =
            conversation.user1_id === userId
              ? conversation.user2_id
              : conversation.user1_id;

          // 送信者の情報を取得
          const senderInfo = await getDiscordUserInfo(userId);
          const senderName = senderInfo?.display_name || "Unknown User";

          // 相手の情報も取得してフレンド申請情報を追加
          const recipientInfo = await getDiscordUserInfo(recipientId);
          const senderUsername = senderInfo?.username || "Unknown";

          // 相手にDM送信
          const replyMessage = `💬 **NFT #${conversation.nft_id} の会話**\n\n**${senderName}** からの返信:\n> ${message}\n\n**返信するには**: \`/reply ${conversationId} あなたのメッセージ\`\n\n**フレンド申請する場合**: \`@${senderUsername}\` を検索してフレンド申請`;

          const dmSent = await sendDiscordDM(recipientId, replyMessage);

          if (dmSent) {
            // 会話の最終メッセージ時刻を更新
            await saveConversation({
              ...conversation,
              last_message_at: new Date().toISOString(),
            });

            sendSuccessResponse(res, "メッセージを送信しました。");
          } else {
            sendErrorResponse(res, "メッセージ送信に失敗しました。");
          }
        } catch (error) {
          console.error("Reply command error:", error);
          sendErrorResponse(res, "処理中にエラーが発生しました。");
        }
        break;

      default:
        sendInfoResponse(res, "Unknown command", false);
    }
    return;
  }

  res.status(400).json({ error: "Unknown interaction type" });
});

// 登録ページの提供
app.get("/register.html", (req: Request, res: Response) => {
  const registerHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord wallet登録</title>
    <script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #222222 0%, #443377 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 90%;
            text-align: center;
        }

        .logo {
            font-size: 48px;
            margin-bottom: 20px;
        }

        h1 {
            color: #333;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }

        .connect-button {
            background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
            margin: 10px;
        }

        .connect-button:hover {
            transform: translateY(-2px);
        }

        .connect-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 10px;
            font-weight: bold;
        }

        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .status.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }

        .wallet-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #007bff;
        }

        .address {
            font-family: monospace;
            background: #e9ecef;
            padding: 10px;
            border-radius: 5px;
            word-break: break-all;
            margin: 10px 0;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 10px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo"></div>
        <h1>Discord wallet登録</h1>
        <p class="subtitle">MetaMaskを接続してDiscordアカウントとウォレットを紐づけます</p>

        <div id="step1" class="step">
            <button id="connectWallet" class="connect-button">
                MetaMask を接続
            </button>
        </div>

        <div id="step2" class="step hidden">
            <div class="wallet-info">
                <h3>接続されたウォレット</h3>
                <div class="address" id="walletAddress"></div>
                <p>上記のアドレスでDiscordアカウントを登録しますか？</p>
            </div>
            <button id="signMessage" class="connect-button">
                署名して登録
            </button>
            <button id="switchWallet" class="connect-button" style="background: #6c757d; margin-top: 10px;">
                別のウォレットに切り替え
            </button>
        </div>

        <div id="step3" class="step hidden">
            <div class="spinner"></div>
            <p>署名を検証中...</p>
        </div>

        <div id="status" class="status hidden"></div>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
            document.getElementById('status').innerHTML = '無効なトークンです。Discordで /register コマンドを再実行してください。';
            document.getElementById('status').className = 'status error';
            document.getElementById('status').classList.remove('hidden');
            document.getElementById('step1').style.display = 'none';
        }

        let provider = null;
        let signer = null;
        let userAddress = null;

        // MetaMask アカウント変更の監視
        if (typeof window.ethereum !== 'undefined') {
            window.ethereum.on('accountsChanged', async (accounts) => {
                if (accounts.length === 0) {
                    // アカウントが切断された場合
                    resetToStep1();
                } else if (userAddress && accounts[0] !== userAddress) {
                    // アカウントが変更された場合
                    await updateWalletAddress();
                }
            });
        }

        // ウォレットアドレスの更新
        async function updateWalletAddress() {
            try {
                if (provider && signer) {
                    const newAddress = await signer.getAddress();
                    if (newAddress !== userAddress) {
                        userAddress = newAddress;
                        document.getElementById('walletAddress').textContent = userAddress;
                        showStatus('ウォレットが切り替わりました: ' + userAddress.slice(0, 6) + '...', 'info');
                    }
                }
            } catch (error) {
                console.error('Error updating wallet address:', error);
            }
        }

        // Step1に戻る
        function resetToStep1() {
            provider = null;
            signer = null;
            userAddress = null;
            document.getElementById('step1').classList.remove('hidden');
            document.getElementById('step2').classList.add('hidden');
            document.getElementById('step3').classList.add('hidden');
            document.getElementById('connectWallet').disabled = false;
            document.getElementById('connectWallet').textContent = ' MetaMask を接続';
            hideStatus();
        }

        // ステータス非表示
        function hideStatus() {
            document.getElementById('status').classList.add('hidden');
        }

        // MetaMask 接続
        document.getElementById('connectWallet').onclick = async () => {
            try {
                if (typeof window.ethereum === 'undefined') {
                    showStatus('MetaMaskがインストールされていません。', 'error');
                    return;
                }

                document.getElementById('connectWallet').disabled = true;
                document.getElementById('connectWallet').textContent = '接続中...';

                provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send("eth_requestAccounts", []);
                signer = provider.getSigner();
                userAddress = await signer.getAddress();

                document.getElementById('walletAddress').textContent = userAddress;
                document.getElementById('step1').classList.add('hidden');
                document.getElementById('step2').classList.remove('hidden');

            } catch (error) {
                console.error('Connection error:', error);
                showStatus('MetaMask接続に失敗しました: ' + error.message, 'error');
                document.getElementById('connectWallet').disabled = false;
                document.getElementById('connectWallet').textContent = 'MetaMask を接続';
            }
        };

        // 署名と登録
        document.getElementById('signMessage').onclick = async () => {
            try {
                document.getElementById('step2').classList.add('hidden');
                document.getElementById('step3').classList.remove('hidden');

                // 署名メッセージ作成
                const timestamp = Date.now();
                const message = \`Discord verification for user token: \${token}\\nWallet: \${userAddress}\\nTimestamp: \${timestamp}\`;

                // 署名
                const signature = await signer.signMessage(message);

                // サーバーに送信
                const response = await fetch('/api/bot/discord/register/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        address: userAddress,
                        message,
                        signature
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Error:', response.status, errorText);
                    throw new Error('API Error: ' + response.status);
                }
                
                const result = await response.json();

                document.getElementById('step3').classList.add('hidden');

                if (result.success) {
                    showStatus('登録が完了しました！Discordで確認してください。', 'success');
                } else {
                    showStatus('登録に失敗しました: ' + result.error, 'error');
                }

            } catch (error) {
                console.error('Signature error:', error);
                document.getElementById('step3').classList.add('hidden');
                showStatus('署名に失敗しました: ' + error.message, 'error');
            }
        };

        // 別のウォレットに切り替え
        document.getElementById('switchWallet').onclick = async () => {
            try {
                // MetaMaskに新しいアカウント選択を要求
                await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
                // 新しいアカウントを取得
                signer = provider.getSigner();
                const newAddress = await signer.getAddress();
                userAddress = newAddress;
                document.getElementById('walletAddress').textContent = userAddress;
                showStatus('🔄 ウォレットを切り替えました: ' + userAddress.slice(0, 6) + '...', 'info');
            } catch (error) {
                console.error('Switch wallet error:', error);
                showStatus('ウォレット切り替えに失敗しました: ' + error.message, 'error');
            }
        };

        function showStatus(message, type) {
            const statusElement = document.getElementById('status');
            statusElement.innerHTML = message;
            statusElement.className = \`status \${type}\`;
            statusElement.classList.remove('hidden');
        }

        // ページ読み込み時の確認
        window.onload = () => {
            if (token) {
                console.log('Registration token:', token);
            }
        };
    </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(registerHtml);
});

// 署名検証エンドポイント
app.post("/discord/register/verify", async (req: Request, res: Response) => {
  try {
    const { token, address, message, signature } = req.body;

    console.log("Registration verification request:", {
      token,
      address,
      message: message?.substring(0, 50) + "...",
    });

    if (!token || !address || !message || !signature) {
      res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
      return;
    }

    // トークン検証
    const tokenData = await getTemporaryToken(token);
    if (
      !tokenData ||
      tokenData.used ||
      Date.now() > tokenData.expires_at * 1000
    ) {
      res
        .status(400)
        .json({ success: false, error: "Invalid or expired token" });
      return;
    }

    // 署名検証
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        res.status(400).json({ success: false, error: "Invalid signature" });
        return;
      }
    } catch (signatureError) {
      console.error("Signature verification error:", signatureError);
      res
        .status(400)
        .json({ success: false, error: "Signature verification failed" });
      return;
    }

    // アドレスの重複チェック（同じEOAが複数のDiscord IDに登録されることを防ぐ）
    const existingMappings = await docClient.send(
      new ScanCommand({
        TableName: discordEOATableName,
        FilterExpression: "eoa_address = :address",
        ExpressionAttributeValues: {
          ":address": address.toLowerCase(),
        },
      })
    );

    if (existingMappings.Items && existingMappings.Items.length > 0) {
      const existingMapping = existingMappings.Items[0];
      if (existingMapping.discord_id !== tokenData.discord_id) {
        res.status(400).json({
          success: false,
          error: "This wallet is already registered to another Discord account",
        });
        return;
      }
    }

    // DynamoDB に保存
    await saveDiscordEOAMapping({
      discord_id: tokenData.discord_id,
      eoa_address: address.toLowerCase(),
      registration_date: new Date().toISOString(),
      signature,
      message,
      status: "verified",
    });

    // トークンを使用済みにマーク
    await markTokenAsUsed(token);

    // Discord 通知
    const notificationMessage = `**ウォレット登録完了**\n\nアドレス: \`${address}\`\n登録日時: ${new Date().toLocaleString(
      "ja-JP"
    )}\n\n登録が正常に完了しました！`;
    await sendDiscordDM(tokenData.discord_id, notificationMessage);

    res.json({ success: true, message: "Registration completed successfully" });
  } catch (error) {
    console.error("Registration verification error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Discord REST API を使ったメンバー情報取得
app.get("/discord/members", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    if (!validateDiscordConfig(res)) {
      return;
    }

    // まずギルドの役職情報を取得
    const rolesMap = await getGuildRoles();

    const members = await fetchDiscordAPI(
      `/guilds/${discordGuildId}/members?limit=${limit}`
    );

    // 全メンバーのEOA情報を一括取得
    const eoaMap = new Map<string, string>();
    try {
      const scanCommand = new ScanCommand({
        TableName: discordEOATableName,
      });
      const eoaResponse = await docClient.send(scanCommand);
      if (eoaResponse.Items) {
        eoaResponse.Items.forEach((item: any) => {
          eoaMap.set(item.discord_id, item.eoa_address);
        });
      }
    } catch (error) {
      console.error("Error fetching EOA mappings:", error);
    }

    res.json({
      guild_id: discordGuildId,
      member_count: members.length,
      members: members.map((member: any) => {
        // アバターURLを構築
        const avatarUrl = generateDiscordAvatarUrl(
          member.user.id,
          member.user.avatar
        );

        const eoaAddress = eoaMap.get(member.user.id);

        return {
          user_id: member.user.id,
          username: member.user.username,
          display_name:
            member.nick || member.user.global_name || member.user.username,
          avatar: member.user.avatar,
          avatar_url: avatarUrl,
          joined_at: member.joined_at,
          roles: member.roles.map((roleId: string) => {
            const role = rolesMap.get(roleId);
            return role
              ? {
                  id: roleId,
                  name: role.name,
                  color: role.color,
                  position: role.position,
                }
              : { id: roleId, name: "Unknown Role" };
          }),
          eoa_address: eoaAddress || null,
          eoa_registered: eoaAddress !== undefined,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching guild members:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 特定のメンバー情報を取得
app.get("/discord/member/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!validateDiscordConfig(res)) {
      return;
    }

    // まずギルドの役職情報を取得
    const rolesMap = await getGuildRoles();

    const member = await fetchDiscordAPI(
      `/guilds/${discordGuildId}/members/${userId}`
    );

    // アバターURLを構築
    const avatarUrl = generateDiscordAvatarUrl(
      member.user.id,
      member.user.avatar
    );

    // EOAアドレスを取得
    let eoaAddress = null;
    try {
      const eoaCommand = new GetCommand({
        TableName: discordEOATableName,
        Key: { discord_id: userId },
      });
      const eoaResponse = await docClient.send(eoaCommand);
      if (eoaResponse.Item) {
        eoaAddress = eoaResponse.Item.eoa_address;
      }
    } catch (error) {
      console.error("Error fetching EOA mapping:", error);
      // EOA取得エラーでもDiscord情報は返す
    }

    res.json({
      user_id: member.user.id,
      username: member.user.username,
      display_name:
        member.nick || member.user.global_name || member.user.username,
      avatar: member.user.avatar,
      avatar_url: avatarUrl,
      joined_at: member.joined_at,
      roles: member.roles.map((roleId: string) => {
        const role = rolesMap.get(roleId);
        return role
          ? {
              id: roleId,
              name: role.name,
              color: role.color,
              position: role.position,
            }
          : { id: roleId, name: "Unknown Role" };
      }),
      premium_since: member.premium_since,
      permissions: member.permissions,
      eoa_address: eoaAddress,
      eoa_registered: eoaAddress !== null,
    });
  } catch (error) {
    console.error("Error fetching guild member:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ギルド情報を取得
app.get("/discord/info", async (req: Request, res: Response) => {
  try {
    if (!validateDiscordConfig(res)) {
      return;
    }

    const guild = await fetchDiscordAPI(`/guilds/${discordGuildId}`);
    res.json({
      id: guild.id,
      name: guild.name,
      description: guild.description,
      member_count: guild.approximate_member_count,
      presence_count: guild.approximate_presence_count,
      icon: guild.icon,
      banner: guild.banner,
      owner_id: guild.owner_id,
      created_at: new Date(
        parseInt(guild.id) / 4194304 + 1420070400000
      ).toISOString(),
    });
  } catch (error) {
    console.error("Error fetching guild info:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// EOAアドレスからDiscordメンバー情報を取得
app.get("/discord/eoa/:eoa", async (req: Request, res: Response) => {
  try {
    const { eoa } = req.params;

    // EOAアドレスの基本的なバリデーション
    if (!eoa || !eoa.match(/^0x[a-fA-F0-9]{40}$/)) {
      res.status(400).json({ error: "Invalid EOA address format" });
      return;
    }

    // EOAアドレスから対応するDiscord IDを検索
    const scanCommand = new ScanCommand({
      TableName: discordEOATableName,
      FilterExpression: "eoa_address = :eoa",
      ExpressionAttributeValues: {
        ":eoa": eoa.toLowerCase(), // 小文字で統一
      },
    });

    const eoaScanResponse = await docClient.send(scanCommand);

    if (!eoaScanResponse.Items || eoaScanResponse.Items.length === 0) {
      res.status(200).json({
        success: false,
        error: "EOA address not registered",
        message: "This EOA address is not linked to any Discord account",
        eoa_address: eoa.toLowerCase(),
        suggestion: "Please register this EOA address using the Discord /register command"
      });
      return;
    }

    const discordId = eoaScanResponse.Items[0].discord_id;

    if (!validateDiscordConfig(res)) {
      return;
    }

    // まずギルドの役職情報を取得
    const rolesMap = await getGuildRoles();

    try {
      // Discordメンバー情報を取得
      const member = await fetchDiscordAPI(
        `/guilds/${discordGuildId}/members/${discordId}`
      );

      // アバターURLを構築
      const avatarUrl = generateDiscordAvatarUrl(
        member.user.id,
        member.user.avatar
      );

      res.json({
        success: true,
        eoa_address: eoa.toLowerCase(),
        discord_member: {
          user_id: member.user.id,
          username: member.user.username,
          display_name:
            member.nick || member.user.global_name || member.user.username,
          avatar: member.user.avatar,
          avatar_url: avatarUrl,
          joined_at: member.joined_at,
          roles: member.roles.map((roleId: string) => {
            const role = rolesMap.get(roleId);
            return role
              ? {
                  id: roleId,
                  name: role.name,
                  color: role.color,
                  position: role.position,
                }
              : { id: roleId, name: "Unknown Role" };
          }),
          premium_since: member.premium_since,
          permissions: member.permissions,
        },
        registration_info: {
          registration_date: eoaScanResponse.Items[0].registration_date || null,
          verified: true,
        },
      });
    } catch (discordError: any) {
      console.error("Error fetching Discord member by EOA:", discordError);
      
      // Discord API エラーの詳細分析
      if (discordError.message && discordError.message.includes('404')) {
        res.status(200).json({
          success: false,
          error: "Discord user not found",
          message: "The Discord user linked to this EOA address no longer exists or has left the server",
          eoa_address: eoa.toLowerCase(),
          discord_id: discordId,
          suggestion: "The user may need to re-register or rejoin the Discord server"
        });
      } else if (discordError.message && discordError.message.includes('403')) {
        res.status(200).json({
          success: false,
          error: "Discord API access denied",
          message: "Unable to access Discord user information due to permissions",
          eoa_address: eoa.toLowerCase(),
          discord_id: discordId,
          suggestion: "Check Discord bot permissions or try again later"
        });
      } else {
        res.status(200).json({
          success: false,
          error: "Discord service unavailable",
          message: "Unable to fetch Discord user information at this time",
          eoa_address: eoa.toLowerCase(),
          discord_id: discordId,
          suggestion: "Please try again later"
        });
      }
    }
  } catch (error) {
    console.error("Error in EOA lookup:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "An unexpected error occurred while processing your request"
    });
  }
});

// Discord Member Card 画像生成
app.get("/discord/membercard/:discordId", async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;

    if (!validateDiscordConfig(res)) {
      return;
    }

    // まずギルドの役職情報を取得
    const rolesMap = await getGuildRoles();

    const member = await fetchDiscordAPI(
      `/guilds/${discordGuildId}/members/${discordId}`
    );

    // アバターURLを構築
    const avatarUrl = generateDiscordAvatarUrl(
      member.user.id,
      member.user.avatar
    );

    // EOAアドレスを取得
    let eoaAddress = null;
    try {
      const eoaCommand = new GetCommand({
        TableName: discordEOATableName,
        Key: { discord_id: discordId },
      });
      const eoaResponse = await docClient.send(eoaCommand);
      if (eoaResponse.Item) {
        eoaAddress = eoaResponse.Item.eoa_address;
      }
    } catch (error) {
      console.error("Error fetching EOA mapping:", error);
    }

    // メンバーカード画像を生成
    const memberData = {
      user_id: member.user.id,
      username: member.user.username,
      display_name: member.nick || member.user.global_name || member.user.username,
      avatar_url: avatarUrl,
      roles: member.roles.map((roleId: string) => {
        const role = rolesMap.get(roleId);
        return role
          ? {
              id: roleId,
              name: role.name,
              color: role.color,
              position: role.position,
            }
          : { id: roleId, name: "Unknown Role" };
      }),
      eoa_address: eoaAddress,
      joined_at: member.joined_at
    };

    try {
      const cardSvg = await generateMemberCard(memberData);
      
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5分キャッシュ
      res.end(cardSvg);
    } catch (cardError: any) {
      console.error("Member card generation error:", cardError);
      // Fallback to JSON response if image generation fails
      res.status(503).json({
        error: "Member card generation failed",
        message: "Error occurred during image generation",
        discord_id: discordId,
        status: "generation_error",
        member_data: memberData,
        error_details: cardError.message
      });
    }

  } catch (error: any) {
    console.error("Error in member card endpoint:", error);
    res.status(500).json({
      error: "Failed to generate member card",
      message: "An error occurred while generating the member card image"
    });
  }
});

app.get("/transfer.html", (req: Request, res: Response) => {
  const transferHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Want request</title>
    <script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 700px;
            width: 90%;
            text-align: center;
        }

        .logo {
            font-size: 48px;
            margin-bottom: 20px;
        }

        h1 {
            color: #333;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }

        .nft-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            margin: 25px 0;
            border: 2px solid #dee2e6;
            text-align: left;
        }

        .nft-image {
            width: 200px;
            height: 200px;
            object-fit: cover;
            border-radius: 10px;
            margin: 0 auto 20px;
            display: block;
            border: 3px solid #007bff;
        }

        .nft-title {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            text-align: center;
        }

        .nft-description {
            color: #666;
            margin-bottom: 20px;
            line-height: 1.5;
            text-align: center;
        }

        .user-card {
            display: flex;
            align-items: center;
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
        }

        .user-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            margin-right: 15px;
            border: 2px solid #007bff;
        }

        .user-info {
            flex: 1;
        }

        .user-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }

        .user-address {
            font-family: monospace;
            font-size: 12px;
            color: #666;
            background: #e9ecef;
            padding: 5px 8px;
            border-radius: 5px;
            word-break: break-all;
        }

        .transfer-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }

        .transfer-button {
            background: linear-gradient(45deg, #28a745 0%, #20c997 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
            margin: 10px;
        }

        .transfer-button:hover {
            transform: translateY(-2px);
        }

        .transfer-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        .connect-button {
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
            margin: 10px;
        }

        .connect-button:hover {
            transform: translateY(-2px);
        }

        .connect-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 10px;
            font-weight: bold;
        }

        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .status.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 10px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .hidden {
            display: none;
        }

        .step {
            margin: 20px 0;
        }

        .arrow {
            font-size: 30px;
            color: #007bff;
            margin: 20px 0;
        }

        .message-section {
            background: #e7f3ff;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }

        .wallet-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #28a745;
        }

        .reject-button {
            background: linear-gradient(45deg, #dc3545 0%, #c82333 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
            margin: 10px;
        }

        .reject-button:hover {
            transform: translateY(-2px);
        }

        .reject-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>NFT Request</h1>
        <p class="subtitle">要求されたNFTを転送します</p>

        <div id="loadingStep" class="step">
            <div class="spinner"></div>
            <p>リクエスト情報を読み込み中...</p>
        </div>

        <div id="requestInfo" class="step hidden">
            <!-- NFT情報 -->
            <div class="nft-card">
                <img id="nftImage" class="nft-image" src="" alt="NFT Image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEwMEgxMTBWMTMwSDkwVjEwMEg3MEwxMDAgNzBaIiBmaWxsPSIjOUNBM0FGIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Q0EzQUYiPk5GVDwvdGV4dD4KPC9zdmc+'" />
                <div class="nft-title" id="nftTitle">Loading...</div>
                <div class="nft-description" id="nftDescription">Loading...</div>
            </div>

            <!-- 転送元（オーナー） -->
            <div class="transfer-info">
                <h3> 転送元（現在のオーナー）</h3>
                <div class="user-card">
                    <img id="ownerAvatar" class="user-avatar" src="" alt="Owner Avatar" />
                    <div class="user-info">
                        <div class="user-name" id="ownerName">Loading...</div>
                        <div class="user-address" id="ownerAddress">Loading...</div>
                    </div>
                </div>
            </div>

            <div class="arrow">⬇️</div>

            <!-- 転送先（リクエスト者） -->
            <div class="transfer-info">
                <h3> 転送先（リクエスト者）</h3>
                <div class="user-card">
                    <img id="requesterAvatar" class="user-avatar" src="" alt="Requester Avatar" />
                    <div class="user-info">
                        <div class="user-name" id="requesterName">Loading...</div>
                        <div class="user-address" id="requesterAddress">Loading...</div>
                    </div>
                </div>
            </div>

            <!-- メッセージ -->
            <div id="messageSection" class="message-section hidden">
                <h4> リクエストメッセージ</h4>
                <div id="requestMessage"></div>
            </div>
        </div>

        <div id="connectStep" class="step hidden">
            <button id="connectWallet" class="connect-button">
                 MetaMask を接続
            </button>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
                あなたがNFTのオーナーであることを確認するため、ウォレットを接続してください
            </p>
        </div>

        <div id="actionStep" class="step hidden">
            <div class="wallet-info">
                <h3> オーナー確認完了</h3>
                <div class="user-address" id="walletAddress"></div>
                <p style="margin-top: 15px;">このリクエストに対してどのような対応をしますか？</p>
            </div>

            <!-- DM送信フォーム -->
            <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: left;">
                <h4> メッセージを送信</h4>
                <textarea id="dmMessage" placeholder="リクエスト者にメッセージを送信..."
                    style="width: 100%; height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: vertical; font-family: inherit;"></textarea>
                <button id="sendDM" class="connect-button" style="margin-top: 10px;">
                     メッセージを送信
                </button>
            </div>

            <!-- アクションボタン -->
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button id="executeTransfer" class="transfer-button">
                    NFTを転送する
                </button>
                <button id="rejectRequest" class="reject-button">
                    リクエストを拒否
                </button>
            </div>
        </div>

        <!-- 拒否理由入力 -->
        <div id="rejectStep" class="step hidden">
            <div style="background: #fff3cd; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: left;">
                <h4> リクエストを拒否する</h4>
                <p>拒否理由を入力してください（任意）:</p>
                <textarea id="rejectReason" placeholder="拒否理由（例: 今は手放したくない、価格交渉をしたい等）..."
                    style="width: 100%; height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: vertical; font-family: inherit;"></textarea>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="confirmReject" class="reject-button">
                         拒否を確定
                    </button>
                    <button id="cancelReject" class="connect-button">
                        🔙 戻る
                    </button>
                </div>
            </div>
        </div>

        <!-- 完了済み表示 -->
        <div id="completedStep" class="step hidden">
            <div style="background: #d4edda; border-radius: 10px; padding: 30px; margin: 20px 0; text-align: center;">
                <h3>転送完了</h3>
                <p>このNFTの転送は既に完了しています。</p>
                <div style="background: #f8f9fa; border-radius: 5px; padding: 15px; margin: 15px 0;">
                    <p><strong>トランザクションハッシュ:</strong></p>
                    <div class="user-address" id="completedTxHash"></div>
                    <p style="margin-top: 10px;"><strong>完了日時:</strong> <span id="completedDate"></span></p>
                </div>
            </div>
        </div>

        <!-- 拒否済み表示 -->
        <div id="rejectedStep" class="step hidden">
            <div style="background: #f8d7da; border-radius: 10px; padding: 30px; margin: 20px 0; text-align: center;">
                <h3>リクエスト拒否済み</h3>
                <p>このリクエストは既に拒否されています。</p>
                <div style="background: #f8f9fa; border-radius: 5px; padding: 15px; margin: 15px 0; text-align: left;">
                    <p><strong>拒否理由:</strong></p>
                    <div id="rejectedReason" style="padding: 10px; background: #e9ecef; border-radius: 5px;"></div>
                    <p style="margin-top: 10px;"><strong>拒否日時:</strong> <span id="rejectedDate"></span></p>
                </div>
            </div>
        </div>

        <div id="processingStep" class="step hidden">
            <div class="spinner"></div>
            <p>転送を実行中...</p>
            <p style="font-size: 12px; color: #666;">MetaMaskでトランザクションを確認してください</p>
        </div>

        <div id="status" class="status hidden"></div>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const nftId = urlParams.get('nft_id');

        let provider = null;
        let signer = null;
        let userAddress = null;
        let requestData = null;

        // ページ読み込み時の処理
        window.onload = async () => {
            if (!token || !nftId) {
                showStatus('無効なURLです。', 'error');
                return;
            }

            try {
                // リクエスト情報を取得
                const response = await fetch(\`/discord/transfer/info?token=\${token}\`);
                const result = await response.json();

                if (!result.success) {
                    showStatus(result.error, 'error');
                    return;
                }

                requestData = result.data;

                // ステータスに応じて表示を切り替え
                if (result.status === 'completed') {
                    showCompletedStatus(result.data);
                } else if (result.status === 'rejected') {
                    showRejectedStatus(result.data);
                } else {
                    showRequestInfo();
                    // 自動でMetaMask接続を試行
                    setTimeout(autoConnectWallet, 1000);
                }

            } catch (error) {
                console.error('Error loading request info:', error);
                showStatus('リクエスト情報の読み込みに失敗しました。', 'error');
            }
        };

        function showRequestInfo() {
            document.getElementById('loadingStep').classList.add('hidden');

            // NFT情報表示
            document.getElementById('nftTitle').textContent = requestData.nft.name;
            document.getElementById('nftDescription').textContent = requestData.nft.description || 'No description available';
            if (requestData.nft.image) {
                document.getElementById('nftImage').src = requestData.nft.image;
            }

            // オーナー情報表示
            document.getElementById('ownerName').textContent = requestData.owner.discord.display_name;
            document.getElementById('ownerAddress').textContent = requestData.owner.address;
            document.getElementById('ownerAvatar').src = requestData.owner.discord.avatar_url;

            // リクエスト者情報表示
            document.getElementById('requesterName').textContent = requestData.requester.discord.display_name;
            document.getElementById('requesterAddress').textContent = requestData.requester.address;
            document.getElementById('requesterAvatar').src = requestData.requester.discord.avatar_url;

            // メッセージ表示
            if (requestData.message) {
                document.getElementById('requestMessage').textContent = requestData.message;
                document.getElementById('messageSection').classList.remove('hidden');
            }

            document.getElementById('requestInfo').classList.remove('hidden');
            document.getElementById('connectStep').classList.remove('hidden');
        }

        function showCompletedStatus(data) {
            document.getElementById('loadingStep').classList.add('hidden');
            document.getElementById('completedTxHash').textContent = data.transaction_hash;
            document.getElementById('completedDate').textContent = new Date(data.completed_at).toLocaleString('ja-JP');
            document.getElementById('completedStep').classList.remove('hidden');
        }

        function showRejectedStatus(data) {
            document.getElementById('loadingStep').classList.add('hidden');
            document.getElementById('rejectedReason').textContent = data.reject_reason || '理由は提供されませんでした';
            document.getElementById('rejectedDate').textContent = new Date(data.rejected_at).toLocaleString('ja-JP');
            document.getElementById('rejectedStep').classList.remove('hidden');
        }

        // 自動ウォレット接続
        async function autoConnectWallet() {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    // すでに接続されているアカウントがあるかチェック
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts.length > 0) {
                        await connectWallet();
                    }
                } catch (error) {
                    console.log('Auto connect failed:', error);
                }
            }
        }

        // MetaMask 接続
        async function connectWallet() {
            try {
                if (typeof window.ethereum === 'undefined') {
                    showStatus('MetaMaskがインストールされていません。', 'error');
                    return;
                }

                document.getElementById('connectWallet').disabled = true;
                document.getElementById('connectWallet').textContent = '接続中...';

                provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send("eth_requestAccounts", []);
                signer = provider.getSigner();
                userAddress = await signer.getAddress();

                // ネットワーク確認
                const network = await provider.getNetwork();
                const expectedChainId = parseInt('${nftChainId}');

                if (network.chainId !== expectedChainId) {
                    showStatus(\`ネットワークを Chain ID \${expectedChainId} に切り替えてください。\`, 'error');
                    document.getElementById('connectWallet').disabled = false;
                    document.getElementById('connectWallet').textContent = 'MetaMask を接続';
                    return;
                }

                // オーナー確認
                if (userAddress.toLowerCase() !== requestData.owner.address.toLowerCase()) {
                    showStatus('あなたはこのNFTのオーナーではありません。', 'error');
                    document.getElementById('connectWallet').disabled = false;
                    document.getElementById('connectWallet').textContent = 'MetaMask を接続';
                    return;
                }

                document.getElementById('walletAddress').textContent = userAddress;
                document.getElementById('connectStep').classList.add('hidden');
                document.getElementById('actionStep').classList.remove('hidden');

            } catch (error) {
                console.error('Connection error:', error);
                showStatus('MetaMask接続に失敗しました: ' + error.message, 'error');
                document.getElementById('connectWallet').disabled = false;
                document.getElementById('connectWallet').textContent = 'MetaMask を接続';
            }
        }

        // ボタンクリックイベント
        document.getElementById('connectWallet').onclick = connectWallet;

        // DM送信
        document.getElementById('sendDM').onclick = async () => {
            const message = document.getElementById('dmMessage').value.trim();
            if (!message) {
                showStatus('メッセージを入力してください。', 'error');
                return;
            }

            try {
                document.getElementById('sendDM').disabled = true;
                document.getElementById('sendDM').textContent = '送信中...';

                const response = await fetch('/discord/transfer/dm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        message
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showStatus('メッセージを送信しました！', 'success');
                    document.getElementById('dmMessage').value = '';
                } else {
                    showStatus('メッセージ送信に失敗しました。', 'error');
                }
            } catch (error) {
                console.error('DM send error:', error);
                showStatus('メッセージ送信に失敗しました: ' + error.message, 'error');
            } finally {
                document.getElementById('sendDM').disabled = false;
                document.getElementById('sendDM').textContent = 'メッセージを送信';
            }
        };

        // リクエスト拒否
        document.getElementById('rejectRequest').onclick = () => {
            document.getElementById('actionStep').classList.add('hidden');
            document.getElementById('rejectStep').classList.remove('hidden');
        };

        // 拒否確定
        document.getElementById('confirmReject').onclick = async () => {
            const reason = document.getElementById('rejectReason').value.trim();

            try {
                document.getElementById('confirmReject').disabled = true;
                document.getElementById('confirmReject').textContent = '処理中...';

                const response = await fetch('/discord/transfer/reject', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        reason
                    })
                });

                const result = await response.json();

                if (result.success) {
                    document.getElementById('rejectStep').classList.add('hidden');
                    showStatus('リクエストを拒否しました。リクエスト者に通知されました。', 'success');
                } else {
                    showStatus('拒否処理に失敗しました。', 'error');
                    document.getElementById('confirmReject').disabled = false;
                    document.getElementById('confirmReject').textContent = '拒否を確定';
                }
            } catch (error) {
                console.error('Reject error:', error);
                showStatus('拒否処理に失敗しました: ' + error.message, 'error');
                document.getElementById('confirmReject').disabled = false;
                document.getElementById('confirmReject').textContent = '拒否を確定';
            }
        };

        // 拒否キャンセル
        document.getElementById('cancelReject').onclick = () => {
            document.getElementById('rejectStep').classList.add('hidden');
            document.getElementById('actionStep').classList.remove('hidden');
        };

        // NFT転送実行
        document.getElementById('executeTransfer').onclick = async () => {
            try {
                document.getElementById('actionStep').classList.add('hidden');
                document.getElementById('processingStep').classList.remove('hidden');

                // NFT転送用のコントラクト
                const contract = new ethers.Contract(
                    '${nftContractAddress}',
                    [
                        'function safeTransferFrom(address from, address to, uint256 tokenId) external',
                        'function ownerOf(uint256 tokenId) view returns (address)'
                    ],
                    signer
                );

                // 最終オーナー確認
                const currentOwner = await contract.ownerOf(nftId);
                if (currentOwner.toLowerCase() !== userAddress.toLowerCase()) {
                    throw new Error('NFTのオーナーが変更されています');
                }

                // 転送実行
                const tx = await contract.safeTransferFrom(
                    userAddress,
                    requestData.requester.address,
                    nftId
                );

                showStatus('🔄 転送トランザクションを送信しました。確認をお待ちください...', 'info');

                // トランザクション確認待ち
                const receipt = await tx.wait();

                // サーバーに完了を通知
                const response = await fetch('/discord/transfer/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        transaction_hash: receipt.transactionHash,
                        block_number: receipt.blockNumber
                    })
                });

                const result = await response.json();

                document.getElementById('processingStep').classList.add('hidden');

                if (result.success) {
                    showStatus('NFT転送が完了しました！Discordで通知を確認してください。', 'success');
                } else {
                    showStatus(' 転送は完了しましたが、通知送信に失敗しました。', 'info');
                }

            } catch (error) {
                console.error('Transfer error:', error);
                document.getElementById('processingStep').classList.add('hidden');
                showStatus('転送に失敗しました: ' + error.message, 'error');
                // 元の画面に戻る
                document.getElementById('actionStep').classList.remove('hidden');
            }
        };

        function showStatus(message, type) {
            const statusElement = document.getElementById('status');
            statusElement.innerHTML = message;
            statusElement.className = \`status \${type}\`;
            statusElement.classList.remove('hidden');
        }
    </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(transferHtml);
});

// 転送リクエスト情報取得エンドポイント
app.get("/discord/transfer/info", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token) {
      res.status(400).json({ success: false, error: "Token is required" });
      return;
    }

    // リクエスト情報を取得
    const command = new GetCommand({
      TableName: wantRequestTableName,
      Key: { request_id: token },
    });
    const response = await docClient.send(command);

    if (!response.Item) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    const requestData = response.Item;

    // 期限切れチェック
    if (Date.now() > requestData.expires_at * 1000) {
      res.status(400).json({ success: false, error: "Request has expired" });
      return;
    }

    // ステータスチェック - completedやrejectedの場合は特別な処理
    if (requestData.status === "completed") {
      // 転送完了済みの情報を返す
      const completedData = {
        status: "completed",
        nft_id: requestData.nft_id,
        transaction_hash: requestData.transaction_hash,
        completed_at: requestData.completed_at,
        block_number: requestData.block_number,
      };
      res.json({ success: true, data: completedData, status: "completed" });
      return;
    }

    if (requestData.status === "rejected") {
      // 拒否済みの情報を返す
      const rejectedData = {
        status: "rejected",
        nft_id: requestData.nft_id,
        rejected_at: requestData.rejected_at,
        reject_reason: requestData.reject_reason || null,
      };
      res.json({ success: true, data: rejectedData, status: "rejected" });
      return;
    }

    if (requestData.status !== "pending") {
      res
        .status(400)
        .json({ success: false, error: "Request is no longer active" });
      return;
    }

    // リクエスト者の情報を取得
    const requesterRegistration = await checkExistingRegistration(
      requestData.requester_discord_id
    );
    if (!requesterRegistration) {
      res
        .status(400)
        .json({ success: false, error: "Requester registration not found" });
      return;
    }

    // オーナーの情報を取得
    const ownerRegistration = await checkExistingRegistration(
      requestData.owner_discord_id
    );
    if (!ownerRegistration) {
      res
        .status(400)
        .json({ success: false, error: "Owner registration not found" });
      return;
    }

    // NFTメタデータを取得
    const nftMetadata = await getNFTMetadata(requestData.nft_id);

    // Discord APIから詳細情報を取得
    const [requesterInfo, ownerInfo] = await Promise.all([
      getDiscordUserInfo(requestData.requester_discord_id),
      getDiscordUserInfo(requestData.owner_discord_id),
    ]);

    res.json({
      success: true,
      data: {
        nft: nftMetadata,
        requester: {
          address: requesterRegistration.eoa_address,
          discord: requesterInfo || {
            username: "Unknown User",
            display_name: "Unknown User",
            avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
            user_id: requestData.requester_discord_id,
          },
        },
        owner: {
          address: ownerRegistration.eoa_address,
          discord: ownerInfo || {
            username: "Unknown User",
            display_name: "Unknown User",
            avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
            user_id: requestData.owner_discord_id,
          },
        },
        message: requestData.message || null,
        created_at: requestData.created_at,
        expires_at: requestData.expires_at,
      },
    });
  } catch (error) {
    console.error("Error getting transfer info:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// リクエスト拒否エンドポイント
app.post("/discord/transfer/reject", async (req: Request, res: Response) => {
  try {
    const { token, reason } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: "Token is required" });
      return;
    }

    // リクエスト情報を取得
    const command = new GetCommand({
      TableName: wantRequestTableName,
      Key: { request_id: token },
    });
    const response = await docClient.send(command);

    if (!response.Item) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    const requestData = response.Item;

    // ステータス更新
    const updateCommand = new PutCommand({
      TableName: wantRequestTableName,
      Item: {
        ...requestData,
        status: "rejected",
        reject_reason: reason || "No reason provided",
        rejected_at: new Date().toISOString(),
      },
    });
    await docClient.send(updateCommand);

    // リクエスト者に拒否通知を送信
    const rejectionMessage = `**NFT譲渡リクエストが拒否されました**\n\nNFT #${
      requestData.nft_id
    } の譲渡リクエストが拒否されました。\n\n拒否理由: ${
      reason || "特に理由は提供されませんでした"
    }\n\n拒否日時: ${new Date().toLocaleString("ja-JP")}`;

    await sendDiscordDM(requestData.requester_discord_id, rejectionMessage);

    res.json({ success: true, message: "Request rejected successfully" });
  } catch (error) {
    console.error("Error rejecting request:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// DM送信エンドポイント
app.post("/discord/transfer/dm", async (req: Request, res: Response) => {
  try {
    const { token, message } = req.body;

    if (!token || !message) {
      res
        .status(400)
        .json({ success: false, error: "Token and message are required" });
      return;
    }

    // リクエスト情報を取得
    const command = new GetCommand({
      TableName: wantRequestTableName,
      Key: { request_id: token },
    });
    const response = await docClient.send(command);

    if (!response.Item) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    const requestData = response.Item;

    // リクエスト者にDM送信
    const dmMessage = `💬 **NFT #${
      requestData.nft_id
    } のオーナーからメッセージ**\n\n${message}\n\n送信日時: ${new Date().toLocaleString(
      "ja-JP"
    )}`;

    const dmSent = await sendDiscordDM(
      requestData.requester_discord_id,
      dmMessage
    );

    if (dmSent) {
      res.json({ success: true, message: "DM sent successfully" });
    } else {
      res.status(500).json({ success: false, error: "Failed to send DM" });
    }
  } catch (error) {
    console.error("Error sending DM:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// 転送完了エンドポイント
app.post("/discord/transfer/complete", async (req: Request, res: Response) => {
  try {
    const { token, transaction_hash, block_number } = req.body;

    if (!token || !transaction_hash) {
      res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
      return;
    }

    // リクエスト情報を取得
    const command = new GetCommand({
      TableName: wantRequestTableName,
      Key: { request_id: token },
    });
    const response = await docClient.send(command);

    if (!response.Item) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    const requestData = response.Item;

    // ステータス更新
    const updateCommand = new PutCommand({
      TableName: wantRequestTableName,
      Item: {
        ...requestData,
        status: "completed",
        transaction_hash,
        block_number,
        completed_at: new Date().toISOString(),
      },
    });
    await docClient.send(updateCommand);

    // 両者に完了通知を送信
    const completionMessage = `**NFT転送完了**\n\nNFT #${
      requestData.nft_id
    } の転送が完了しました！\n\nトランザクション: ${transaction_hash}\n完了日時: ${new Date().toLocaleString(
      "ja-JP"
    )}`;

    // オーナーに通知
    await sendDiscordDM(requestData.owner_discord_id, completionMessage);

    // リクエスト者に通知
    await sendDiscordDM(requestData.requester_discord_id, completionMessage);

    res.json({ success: true, message: "Transfer completed successfully" });
  } catch (error) {
    console.error("Error completing transfer:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// CSV Import endpoint for Discord-EOA mapping
app.post("/admin/import-csv", handleApiEndpoint(async (req: Request, res: Response) => {
  const { csvContent, dryRun = false } = req.body;

  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({ 
      success: false, 
      error: "CSV content is required as string" 
    });
    return;
  }

  try {
    if (dryRun) {
      // Dry run: validate only, don't insert
      const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
      const errors: string[] = [];
      let validRows = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const validation = validateCSVRow(row, i + 1);
        
        if (!validation.isValid) {
          errors.push(validation.error!);
        } else {
          validRows++;
        }
      }

      res.json({
        success: true,
        dryRun: true,
        totalRows: lines.length - 1, // Exclude header
        validRows,
        errors: errors.slice(0, 10), // Limit errors shown
        totalErrors: errors.length
      });
    } else {
      // Actual import
      const result = await processCSVImport(csvContent);
      
      res.json({
        success: true,
        imported: result.success,
        errors: result.errors.slice(0, 20), // Limit errors shown
        totalErrors: result.errors.length
      });
    }
  } catch (error) {
    console.error("CSV import error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to process CSV import" 
    });
  }
}));

// Get import template
app.get("/admin/csv-template", handleApiEndpoint(async (req: Request, res: Response) => {
  const template = `DiscordId,Eoa,Username,Name
1001730372557607022,0x5A636bdaB39414DE26735f8CDf6dded8b5bcA0e2,taiga.mori,taiga.mori
1001730621745397861,0x41dcCE71B7b89136CaFD8033bEc9ae005BEf9c7E,toshiaki.mori,Toshiaki.Mori`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="discord-eoa-template.csv"');
  res.send(template);
}));

// 404ハンドラー
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

export default app;

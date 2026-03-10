# 火山引擎声音克隆服务 (VoiceCloneService)

## 功能概述

本服务集成了火山引擎的 MegaTTS 声音克隆 API，提供以下核心功能：

1. **上传训练音频** - 用户上传音频样本用于训练自定义音色
2. **查询训练状态** - 实时查询音频的训练进度
3. **语音合成** - 使用已训练的音色进行文本转语音合成
4. **档案管理** - 管理用户的声音档案和访问权限
5. **合规控制** - 确保用户确认"本人声音/合法使用"后才能使用

## API 端点

### 1. 合规确认（必须首先调用）

**定义：** 用户必须确认"本人声音/合法使用"才能继续使用声音克隆功能

```http
POST /api/v1/voice-clone/:voiceProfileId/compliance-confirm
Authorization: Bearer {token}
Content-Type: application/json

{
  "confirmed": true
}
```

**响应（201）：**
```json
{
  "success": true,
  "data": {
    "confirmed": true,
    "confirmedAt": "2024-03-08T12:00:00Z"
  },
  "message": "合规确认已记录，您现在可以使用声音克隆功能"
}
```

**错误：**
- `400` - 必须确认"本人声音/合法使用"
- `401` - 未认证
- `404` - 声音档案不存在

---

### 2. 上传训练音频

**定义：** 上传音频文件用于训练自定义音色

**约束：**
- 每个用户同时只能有一个活跃的（在训练中的）声音档案
- 上传新音频时会自动覆盖之前的训练

```http
POST /api/v1/voice-clone/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "profileName": "我的自定义音色",
  "audioFormat": "wav",
  "file": <binary audio data>
}
```

**支持的音频格式：** `wav`, `mp3`, `pcm`, `aac`, `flac`

**响应（201）：**
```json
{
  "success": true,
  "data": {
    "voiceProfileId": "clh7z0x0c0000z0z0z0z0z0z0",
    "speakerId": "user_abc123_1234567890",
    "message": "音频已上传，训练进行中"
  },
  "message": "上传成功"
}
```

**错误：**
- `400` - 参数验证失败、音频为空、或已有活跃档案
- `401` - 未认证
- `409` - 用户已有活跃的声音档案

---

### 3. 查询训练状态

**定义：** 查询声音档案的当前训练状态

```http
GET /api/v1/voice-clone/:voiceProfileId/status
Authorization: Bearer {token}
```

**响应（200）：**
```json
{
  "success": true,
  "data": {
    "status": "training",
    "statusCode": 1,
    "errorMessage": null
  },
  "message": "查询成功"
}
```

**状态码说明：**
| statusCode | status | 含义 |
|-----------|--------|------|
| 0 | pending | 未发现（可能还未开始处理） |
| 1 | training | 训练中 |
| 2 | completed | 训练完成 ✓ |
| 3 | failed | 训练失败 ✗ |

**错误：**
- `400` - 档案缺少speaker_id
- `401` - 未认证
- `404` - 声音档案不存在

---

### 4. 合成语音

**定义：** 使用已训练的音色进行文本转语音合成

**约束：**
- 声音档案必须已完成训练（status = "completed"）
- 必须已确认合规（compliance_confirmed = true）
- 合成文本长度不能超过500字

```http
POST /api/v1/voice-clone/synthesize
Authorization: Bearer {token}
Content-Type: application/json

{
  "voiceProfileId": "clh7z0x0c0000z0z0z0z0z0z0",
  "text": "你好，这是我的自定义音色",
  "complianceConfirmed": true
}
```

**响应（200）：**
```json
{
  "success": true,
  "data": {
    "audioUrl": "https://openspeech.bytedance.com/audio/xxx.mp3",
    "audioBase64": null
  },
  "message": "语音合成成功"
}
```

**可能返回的字段：**
- `audioUrl`: 生成音频的URL地址
- `audioBase64`: 音频的Base64编码（如果选择此格式）

**错误：**
- `400` - 合规未确认、档案未完成训练、文本为空或过长、权限不足
- `401` - 未认证
- `404` - 档案不存在
- `500` - 服务器错误

---

### 5. 获取用户声音档案列表

**定义：** 获取当前用户的所有声音档案

```http
GET /api/v1/voice-clone/profiles
Authorization: Bearer {token}
```

**响应（200）：**
```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "id": "clh7z0x0c0000z0z0z0z0z0z0",
        "profile_name": "我的自定义音色",
        "voice_id": "user_abc123_1234567890",
        "voice_description": null,
        "is_trained": true,
        "training_status": "completed",
        "error_message": null,
        "created_at": "2024-03-08T10:00:00Z",
        "updated_at": "2024-03-08T11:30:00Z"
      }
    ],
    "total": 1
  },
  "message": "获取成功"
}
```

**错误：**
- `401` - 未认证

---

### 6. 删除声音档案

**定义：** 删除指定的声音档案（同时删除相关的任务记录）

```http
DELETE /api/v1/voice-clone/:voiceProfileId
Authorization: Bearer {token}
```

**响应（200）：**
```json
{
  "success": true,
  "data": null,
  "message": "删除成功"
}
```

**错误：**
- `401` - 未认证
- `404` - 档案不存在
- `403` - 权限不足（不是档案所有者）

---

## 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# 火山引擎声音克隆API
VOICE_CLONE_API_TOKEN=your_api_token_here
VOICE_CLONE_APP_ID=your_app_id_here
```

获取方式：
1. 访问火山引擎控制台：https://console.volcengine.com/
2. 在 MegaTTS 服务中创建应用
3. 获取 API Token 和 AppID

---

## 数据库更新

运行以下命令更新数据库 Schema：

```bash
# 生成迁移文件
npx prisma migrate dev --name add_voice_clone

# 或直接推送到数据库
npx prisma db push
```

主要变更：
- VoiceProfile 表添加 `is_active` 字段（布尔类型，默认为true）
- 添加唯一约束：`(user_id, is_active)` - 确保每个用户最多一个活跃档案

---

## 完整使用流程示例

```typescript
// 1. 用户上传音频
const uploadRes = await fetch('/api/v1/voice-clone/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: formData // 包含 audio 文件、profileName、audioFormat
});
const { data: { voiceProfileId } } = await uploadRes.json();

// 2. 确认合规
const complianceRes = await fetch(
  `/api/v1/voice-clone/${voiceProfileId}/compliance-confirm`,
  {
    method: 'POST',
    headers: { 'Authorization': 'Bearer token' },
    body: JSON.stringify({ confirmed: true })
  }
);

// 3. 轮询查询训练状态
let status = 'training';
while (status === 'training') {
  const statusRes = await fetch(
    `/api/v1/voice-clone/${voiceProfileId}/status`,
    { headers: { 'Authorization': 'Bearer token' } }
  );
  const { data } = await statusRes.json();
  status = data.status;
  if (status === 'training') {
    await new Promise(r => setTimeout(r, 5000)); // 等待5秒后继续轮询
  }
}

// 4. 训练完成后，合成语音
if (status === 'completed') {
  const synthesizeRes = await fetch('/api/v1/voice-clone/synthesize', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer token' },
    body: JSON.stringify({
      voiceProfileId,
      text: '使用我的自定义音色合成这段话',
      complianceConfirmed: true
    })
  });
  const { data: { audioUrl } } = await synthesizeRes.json();
  // 使用 audioUrl 播放或下载音频
}
```

---

## 错误处理

所有 API 端点都遵循统一的错误响应格式：

```json
{
  "success": false,
  "data": null,
  "message": "具体错误描述"
}
```

常见错误码和处理建议：

| HTTP 状态码 | 错误信息 | 处理建议 |
|-----------|---------|--------|
| 400 | 用户已有活跃的声音档案 | 删除或等待前一个档案处理完成 |
| 400 | 合规未确认 | 先调用合规确认 API |
| 400 | 声音档案还未完成训练 | 继续轮询查询训练状态 |
| 401 | 未认证 | 确保带有有效的 JWT Token |
| 404 | 声音档案不存在 | 检查 ID 是否正确 |
| 500 | 火山引擎API请求失败 | 检查网络连接和 API Token 配置 |

---

## 业务规则

### 档案管理
- ✅ 每个用户最多同时有一个 **活跃的**（未完成训练的）声音档案
- ✅ 用户可以有多个已完成训练的档案
- ✅ 上传新音频时自动删除之前未完成的档案

### 合规检查
- ✅ 用户必须先确认"本人声音/合法使用"（调用合规确认API）
- ✅ 之后才能调用合成语音API
- ✅ 记录有 IP 地址和 User-Agent 用于审计

### 训练流程
1. 用户上传音频（训练开始，状态：training）
2. 火山引擎处理（通常需要几分钟到几小时）
3. 检查训练状态（定期轮询）
4. 训练完成后可以进行语音合成

---

## 文件结构

```
src/
├── services/
│   └── voice-clone.service.ts      # 核心服务类
├── controllers/
│   └── voice-clone.controller.ts   # API 控制器
├── routes/
│   └── voice-clone.routes.ts       # 路由定义
├── schemas/
│   └── voice-clone.schema.ts       # 请求验证 Schema
└── index.ts                        # 主文件（已注册路由）
```

---

## 常见问题

### Q: 为什么上传失败说"用户已有活跃档案"？
A: 系统不允许用户同时有多个正在训练的档案。请先删除或等待前一个训练完成。

### Q: 如何获取 Fire-Engine API Token？
A: 登录火山引擎控制台 → 应用管理 → 获取 API Key 和 Secret。

### Q: 合成的音频质量不好怎么办？
A: 上传更清晰、更长的样本音频（建议30秒以上）可以改善质量。

### Q: 训练需要多长时间？
A: 通常需要2-24小时，取决于服务器负载和音频长度。

### Q: 支持多语言吗？
A: 支持自动语言检测和多种语言。在上传或合成时可以指定语言参数。

---

## 更新日志

### v1.0.0 (2024-03-08)
- 初始版本发布
- 实现基本的上传、查询、合成功能
- 添加合规确认流程
- 添加档案管理功能

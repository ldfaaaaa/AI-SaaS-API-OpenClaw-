# 声音克隆服务 - 实现总结

## 📋 项目概述

已成功为AI SaaS平台创建了完整的**火山引擎声音克隆服务 (VoiceCloneService)**，集成了MegaTTS API用于用户个性化音色训练和语音合成。

## ✨ 创建的文件清单

### 核心服务层
| 文件 | 说明 |
|------|------|
| `src/services/voice-clone.service.ts` | 声音克隆核心服务类（600+行）|
| `src/schemas/voice-clone.schema.ts` | 请求参数验证Schema（Zod） |
| `src/controllers/voice-clone.controller.ts` | API路由处理控制器 |
| `src/routes/voice-clone.routes.ts` | 路由定义和Schema |

### 文档
| 文件 | 说明 |
|------|------|
| `VOICE_CLONE_README.md` | 完整的API文档和使用指南 |
| `IMPLEMENTATION_SUMMARY.md` | 本文件 |

### 已修改的文件
| 文件 | 修改内容 |
|------|---------|
| `prisma/schema.prisma` | 添加`is_active`字段和唯一约束 |
| `src/index.ts` | 导入并注册VoiceClone路由 |
| `BACKEND_README.md` | 添加声音克隆功能说明 |

---

## 🎯 实现的功能

### 1. **上传训练音频** ✅
**方法：** `uploadTrainAudio(userId, audioBuffer, format, profileName)`

- 验证音频格式（wav/mp3/pcm/aac/flac）
- 自动删除旧的活跃档案（确保每用户只有一个）
- 将音频转为Base64发送到火山引擎API
- 自动创建VoiceProfile记录
- 返回speakerId用于后续合成

**API端点：**
```
POST /api/v1/voice-clone/upload
Content-Type: multipart/form-data
```

---

### 2. **查询训练状态** ✅
**方法：** `getTrainingStatus(voiceProfileId)`

- 调用火山引擎API查询当前状态
- 自动映射状态码到可读的状态字符串：
  - `0` → pending
  - `1` → training
  - `2` → completed ✓
  - `3` → failed ✗
- 同步更新数据库中的训练状态

**API端点：**
```
GET /api/v1/voice-clone/:voiceProfileId/status
```

---

### 3. **语音合成** ✅
**方法：** `synthesizeSpeech(userId, voiceProfileId, text, complianceConfirmed)`

- 验证合规确认（用户必须先确认"本人声音/合法使用"）
- 验证档案所有权
- 检查训练是否完成（status = "completed"）
- 验证文本长度（最大500字）
- 调用火山引擎API合成语音
- 返回audioUrl或audioBase64

**API端点：**
```
POST /api/v1/voice-clone/synthesize
{
  "voiceProfileId": "...",
  "text": "...",
  "complianceConfirmed": true
}
```

---

### 4. **合规确认** ✅
**方法：** `recordComplianceConfirmation(userId, voiceProfileId, ipAddress, userAgent)`

- 用户必须确认"本人声音/合法使用"才能使用合成功能
- 记录确认的IP地址和User-Agent用于审计
- 确保法律合规性

**API端点：**
```
POST /api/v1/voice-clone/:voiceProfileId/compliance-confirm
{
  "confirmed": true
}
```

---

### 5. **档案管理** ✅
**方法：**
- `getUserVoiceProfiles(userId)` - 获取用户的所有档案
- `deleteVoiceProfile(userId, voiceProfileId)` - 删除档案

**API端点：**
```
GET /api/v1/voice-clone/profiles
DELETE /api/v1/voice-clone/:voiceProfileId
```

---

## 🔐 关键业务规则

### 1. **每用户仅一个活跃档案**
```typescript
// Prisma唯一约束
@@unique([user_id, is_active])
```
- 每个用户同时只能有一个`is_active=true`的档案
- 上传新音频时自动删除之前的活跃档案
- 允许多个已完成的档案并存

### 2. **合规确认强制要求**
```typescript
if (!complianceConfirmed) {
  throw new BadRequestError('使用声音克隆功能需要先确认"本人声音/合法使用"');
}
```
- 必须先调用 `/compliance-confirm` 端点确认
- 记录确认时间、IP地址、User-Agent
- 二次校验确保合法性

### 3. **训练状态约束**
- 上传音频后自动进入"training"状态
- 只有状态为"completed"的档案才能用于合成
- 允许重新上传音频以改进训练效果

### 4. **权限检查**
- 所有操作执行用户所有权验证
- 防止用户访问他人的档案

---

## 🛠️ 技术细节

### API基础设置
```typescript
const BASE_URL = 'https://openspeech.bytedance.com/api/v1/mega_tts';

// 请求头
Authorization: Bearer {VOICE_CLONE_API_TOKEN}
Resource-Id: volc.megatts.voiceclone
Content-Type: application/json
```

### 支持的音频格式
```typescript
enum AudioFormat {
  WAV = 'wav',
  MP3 = 'mp3',
  PCM = 'pcm',
  AAC = 'aac',
  FLAC = 'flac'
}
```

### 重试机制
- 最多重试3次（`MAX_RETRY_ATTEMPTS = 3`）
- 重试延迟1000ms
- 客户端错误(4xx)不重试
- 服务器错误(5xx)自动重试

### 错误处理
```typescript
// 统一的错误类
- BadRequestError (400) - 参数或业务逻辑错误
- UnauthorizedError (401) - 未认证
- ForbiddenError (403) - 权限不足
- NotFoundError (404) - 资源不存在
- ConflictError (409) - 冲突（如已有活跃档案）
- InternalServerError (500) - 火山引擎API错误
```

---

## 🔄 典型使用流程

```
┌─────────────────────────────────────────┐
│  1. 用户上传音频训练样本                     │
│     POST /voice-clone/upload             │
│     ↓                                     │
│  生成voiceProfileId和speakerId           │
│  状态 → training                         │
└──────┬──────────────────────────────────┘
       ├─ [1-24小时] 后台训练中
       │
       ├─────────────────────────────────┐
       │  2. (可选)查询训练状态            │
       │     GET /voice-clone/status      │
       │     ↓                             │
       │  返回当前状态(轮询检查)            │
       └──────┬──────────────────────────┘
              │
              ├─ 状态 = training → 继续轮询
              ├─ 状态 = failed → 重新上传
              ├─ 状态 = completed ✓ → 继续
              │
       ┌──────┴──────────────────────────┐
       │  3. 用户确认合规                  │
       │     POST /compliance-confirm     │
       │     { confirmed: true }          │
       │     ↓                             │
       │  记录合规确认信息                  │
       │  (IP、User-Agent、时间戳)         │
       └──────┬──────────────────────────┘
              │
       ┌──────┴──────────────────────────┐
       │  4. 用户进行语音合成               │
       │     POST /voice-clone/synthesize │
       │     {                             │
       │       voiceProfileId: "...",     │
       │       text: "合成文本",           │
       │       complianceConfirmed: true  │
       │     }                             │
       │     ↓                             │
       │  返回合成的音频URL或Base64       │
       └──────────────────────────────────┘
```

---

## 📊 数据库Schema更变

### VoiceProfile表（更新）

```prisma
model VoiceProfile {
  id                  String    @id @default(cuid())
  user_id             String    // 关联的用户ID
  profile_name        String    // 档案名称
  voice_id            String?   // 火山引擎返回的speaker_id
  sample_audio_url    String    // 训练样本音频URL
  voice_description   String?
  is_trained          Boolean   @default(false)     // 是否已完成训练
  is_active           Boolean   @default(true)      // ✨ NEW: 是否为活跃档案
  training_status     String    @default("pending") // pending|training|completed|failed
  error_message       String?
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  user                User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  generation_tasks    GenerationTask[]

  @@index([user_id])
  @@index([voice_id])
  @@unique([user_id, is_active]) // ✨ NEW: 每用户最多一个活跃档案
  @@map("voice_profiles")
}
```

---

## 🚀 使用前的准备

### 1. 环境变量配置
```env
# .env
VOICE_CLONE_API_TOKEN=your_token_here
VOICE_CLONE_APP_ID=your_app_id_here
```

### 2. 数据库迁移
```bash
# 生成迁移
npx prisma migrate dev --name add_voice_clone_is_active

# 或直接推送（开发环境）
npx prisma db push
```

### 3. 启动服务
```bash
npm run dev
```

### 4. 验证路由已注册
```bash
# 在启动日志中应该看到：
# 🚀 Server is running!
# 📡 Listening on: http://0.0.0.0:3000
```

---

## 📚 文档位置

| 文档 | 位置 | 内容 |
|------|------|------|
| **完整API文档** | [VOICE_CLONE_README.md](./VOICE_CLONE_README.md) | 所有6个API端点的详细说明、参数、示例、错误处理 |
| **后端项目说明** | [BACKEND_README.md](./BACKEND_README.md) | 项目结构更新、新功能简介 |
| **主项目说明** | [copilot-instructions.md](./copilot-instructions.md) | 项目整体上下文 |

---

## 🧪 测试建议

### 使用cURL测试
```bash
# 1. 获取用户token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 2. 上传音频
curl -X POST http://localhost:3000/api/v1/voice-clone/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "profileName=MyVoice" \
  -F "audioFormat=wav" \
  -F "file=@your-audio.wav"

# 3. 获取档案列表
curl -X GET http://localhost:3000/api/v1/voice-clone/profiles \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. 确认合规
curl -X POST http://localhost:3000/api/v1/voice-clone/PROFILE_ID/compliance-confirm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmed":true}'

# 5. 合成语音
curl -X POST http://localhost:3000/api/v1/voice-clone/synthesize \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "voiceProfileId":"PROFILE_ID",
    "text":"你好，世界",
    "complianceConfirmed":true
  }'
```

---

## ⚠️ 已知限制和注意事项

### 当前实现
1. ✅ 完整的API和服务层实现
2. ✅ 数据库Schema更新
3. ✅ 参数验证和错误处理
4. ✅ 权限检查和业务规则
5. ✅ 合规确认流程

### 可选的未来增强
1. **WebSocket实时更新** - 使用通知网关实时推送训练状态更新
2. **Redis缓存** - 缓存合规确认状态（可选，当前直接存储）
3. **任务队列** - 使用BullMQ异步处理语音合成（当前是同步）
4. **日志审计** - 记录所有关键操作到审计表
5. **限流控制** - 添加速率限制以防止API滥用
6. **CDN集成** - 将合成的音频上传到OSS/CDN加速分发

---

## 🔗 相关资源

- **火山引擎官方文档**: https://www.volcengine.com/docs/6561
- **MegaTTS API文档**: https://www.volcengine.com/docs/6561/63305
- **Fastify文档**: https://www.fastify.io/
- **Prisma文档**: https://www.prisma.io/docs/

---

## 📝 更新日志

### v1.0.0 (2024-03-08)
- ✅ 初始版本完成
- ✅ 实现上传、查询、合成功能
- ✅ 添加合规确认流程
- ✅ 档案管理功能
- ✅ 唯一约束确保每用户仅一个活跃档案
- ✅ 详细的API文档

---

## 📞 常见问题

**Q: 如何修改允许的音频格式？**
A: 编辑 `src/schemas/voice-clone.schema.ts` 中的 `audioFormat` enum

**Q: 为什么上传的音文件后收到"用户已有活跃档案"错误？**
A: 由于業務規則限制，每個用户同时只能有一个未完成的档案。请先删除或等待。

**Q: 火山引擎API需要多少钱？**
A: 请查阅火山引擎官方定价页面，通常训练和合成都是按调用次数计费。

**Q: 如何处理训练失败的情况？**
A: 检查 `error_message` 字段获取失败原因，然后重新上传更清晰的音频。

---

**完成状态**：✅ 所有需求功能已实现和文档完善

#!/bin/bash

# OpenClaw 内容助手模块 - 快速安装脚本

echo "🚀 开始安装 OpenClaw 内容助手模块..."
echo ""

# 1. 安装依赖
echo "📦 安装npm依赖..."
npm install adm-zip
npm install --save-dev @types/adm-zip

# 2. 生成Prisma客户端
echo "🗄️  生成Prisma客户端..."
npm run prisma:generate

# 3. 推送数据库schema
echo "💾 更新数据库schema..."
npm run prisma:push

# 4. 检查环境变量
echo "🔍 检查环境变量配置..."
if [ ! -f .env ]; then
    echo "❌ 错误: 未找到.env文件"
    echo "请创建.env文件并配置必要的环境变量:"
    echo "  - DOUBAO_API_KEY"
    echo "  - DOUBAO_CHAT_MODEL" 
    echo "  - DATABASE_URL"
    echo "  - REDIS_HOST"
    echo "  - OSS_ACCESS_KEY_ID"
    echo "  - OSS_ACCESS_KEY_SECRET"
    echo "  - OSS_BUCKET"
    exit 1
fi

# 检查关键环境变量
source .env
if [ -z "$DOUBAO_API_KEY" ]; then
    echo "⚠️  警告: DOUBAO_API_KEY 未配置"
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误: DATABASE_URL 未配置"
    exit 1
fi

echo ""
echo "✅ 安装完成！"
echo ""
echo "📚 下一步:"
echo "  1. 检查并完善 .env 配置"
echo "  2. 运行 'npm run dev' 启动开发服务器"
echo "  3. 访问 http://localhost:3000/health 测试服务"
echo ""
echo "📖 详细文档请查看:"
echo "  - CONTENT_ASSISTANT_README.md - 使用文档"
echo "  - DEPLOYMENT_CONTENT_ASSISTANT.md - 部署指南"
echo ""

#!/bin/bash

# TempMail Startup Script for 512MB VPS
echo "🚀 Starting TempMail on 512MB VPS..."

# Set Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=400 --expose-gc"

# Check if port is available
PORT=${PORT:-3000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port $PORT is already in use"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Start the server with PM2 for better process management
if command -v pm2 &> /dev/null; then
    echo "📦 Using PM2 for process management..."
    pm2 start server.js --name "tempmail" --max-memory-restart 450M
    pm2 logs tempmail
else
    echo "📦 Starting with Node.js directly..."
    echo "💡 Install PM2 for better process management: npm install -g pm2"
    node --expose-gc server.js
fi
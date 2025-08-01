#!/usr/bin/env node

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function checkHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    
    const timestamp = new Date().toLocaleTimeString();
    const memoryMB = data.memory.rss;
    const sessions = data.activeSessions;
    const maxSessions = data.maxSessions;
    const status = data.status;
    
    // Color coding for terminal output
    const colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m'
    };
    
    const statusColor = status === 'healthy' ? colors.green : colors.yellow;
    const memoryColor = memoryMB > 400 ? colors.red : memoryMB > 300 ? colors.yellow : colors.green;
    const sessionColor = sessions > maxSessions * 0.8 ? colors.yellow : colors.green;
    
    console.log(`${colors.blue}[${timestamp}]${colors.reset} Server Status: ${statusColor}${status}${colors.reset}`);
    console.log(`  📊 Memory: ${memoryColor}${memoryMB}MB${colors.reset} (Threshold: ${data.threshold}MB)`);
    console.log(`  👥 Sessions: ${sessionColor}${sessions}/${maxSessions}${colors.reset}`);
    console.log(`  ⏱️  Uptime: ${Math.floor(data.uptime / 60)} minutes`);
    console.log(`  ${data.isHigh ? '⚠️  HIGH MEMORY USAGE' : '✅ Normal operation'}`);
    console.log('');
    
  } catch (error) {
    console.error(`❌ Error checking health: ${error.message}`);
  }
}

async function checkMemory() {
  try {
    const response = await fetch(`${BASE_URL}/api/memory`);
    const data = await response.json();
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Memory Details:`);
    console.log(`  RSS: ${data.memory.rss}MB`);
    console.log(`  Heap Used: ${data.memory.heapUsed}MB`);
    console.log(`  Heap Total: ${data.memory.heapTotal}MB`);
    console.log(`  External: ${data.memory.external}MB`);
    console.log(`  Active Sessions: ${data.activeSessions}/${data.maxSessions}`);
    console.log(`  Memory High: ${data.isHigh ? '⚠️  YES' : '✅ No'}`);
    console.log('');
    
  } catch (error) {
    console.error(`❌ Error checking memory: ${error.message}`);
  }
}

// Main monitoring loop
async function monitor() {
  console.log(`🔍 Starting TempMail monitoring for ${BASE_URL}`);
  console.log(`📊 Checking every 30 seconds...\n`);
  
  // Initial check
  await checkHealth();
  
  // Set up periodic monitoring
  setInterval(async () => {
    await checkHealth();
  }, 30000); // Check every 30 seconds
  
  // Detailed memory check every 5 minutes
  setInterval(async () => {
    await checkMemory();
  }, 300000); // Check every 5 minutes
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Monitoring stopped');
  process.exit(0);
});

// Start monitoring
monitor().catch(console.error);
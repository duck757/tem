module.exports = {
  apps: [{
    name: 'tempmail',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    node_args: '--max-old-space-size=400',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      MAX_SESSIONS: 100,
      SESSION_TIMEOUT: 7200000 // 2 hours
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
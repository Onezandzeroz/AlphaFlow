// PM2 Ecosystem Configuration for AlphaAi Accounting
// Usage: bun run start:pm2   (or: pm2 start ecosystem.config.js)
//
// PREREQUISITES:
//   1. bun run build
//   2. bun run db:push
//
// After config changes: pm2 delete alphaai && pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'alphaai',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      // Set cwd to YOUR project root on the server
      // e.g. '/var/www/alphaai' or '/home/user/AlphaAi-Bogforingsapp'
      cwd: process.cwd(),
      env: {
        NODE_ENV: 'production',
        // Optional: override database location
        // DATABASE_URL: 'file:/var/www/alphaai/prisma/db/custom.db',
      },
      // Restart settings
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};

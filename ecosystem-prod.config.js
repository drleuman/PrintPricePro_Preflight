module.exports = {
  apps: [
    {
      name: 'preflight-app',
      script: 'app/server.js',
      cwd: '/var/www/vhosts/printprice.pro/preflight.printprice.pro',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PPOS_REGION_ID: 'eu-west-1'
      }
    }
  ]
};

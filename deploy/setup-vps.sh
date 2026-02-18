#!/bin/bash

# Ramadan Tracker VPS Setup Script
# For Ubuntu 22.04+ on DigitalOcean

set -e

echo "🌙 Ramadan Tracker VPS Setup"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release build-essential

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
print_status "Node.js installed: $node_version"

# Install PM2 (Process Manager)
print_status "Installing PM2..."
npm install -g pm2

# Install MongoDB
print_status "Installing MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org

# Start and enable MongoDB
print_status "Starting MongoDB service..."
systemctl start mongod
systemctl enable mongod

# Verify MongoDB is running
if systemctl is-active --quiet mongod; then
    print_status "MongoDB is running successfully"
else
    print_error "MongoDB failed to start"
    exit 1
fi

# Install Nginx
print_status "Installing Nginx..."
apt install -y nginx

# Start and enable Nginx
print_status "Starting Nginx service..."
systemctl start nginx
systemctl enable nginx

# Install Certbot for SSL
print_status "Installing Certbot for SSL certificates..."
apt install -y certbot python3-certbot-nginx

# Create application directory
print_status "Creating application directory..."
mkdir -p /var/www/ramadan-tracker
cd /var/www/ramadan-tracker

# Clone the repository
print_status "Cloning Ramadan Tracker repository..."
git clone https://github.com/mmahmoudai/ramadan-sch.git .

# Install dependencies
print_status "Installing backend dependencies..."
cd backend
npm install --production

print_status "Installing frontend dependencies..."
cd ../frontend
npm install

print_status "Installing shared types..."
cd ../shared
npm install

# Create environment files
print_status "Setting up environment variables..."

# Backend environment
cd /var/www/ramadan-tracker/backend
cat > .env << EOF
PORT=4000
FRONTEND_URL=https://ramadantracker.app
NODE_ENV=production
JWT_SECRET=$(openssl rand -base64 32)
MONGO_URI=mongodb://localhost:27017/ramadan_tracker
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@ramadantracker.app
EOF

# Frontend environment
cd /var/www/ramadan-tracker/frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://api.ramadantracker.app
EOF

# Build frontend
print_status "Building frontend..."
npm run build

# Setup PM2 ecosystem
print_status "Setting up PM2 ecosystem..."
cd /var/www/ramadan-tracker
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'ramadan-tracker-api',
      script: './backend/src/index.ts',
      cwd: '/var/www/ramadan-tracker',
      interpreter: '/usr/bin/node',
      interpreter_args: '--loader ts-node/esm',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/ramadan-tracker/api-error.log',
      out_file: '/var/log/ramadan-tracker/api-out.log',
      log_file: '/var/log/ramadan-tracker/api-combined.log',
      time: true
    }
  ]
};
EOF

# Create log directory
mkdir -p /var/log/ramadan-tracker

# Setup Nginx configuration
print_status "Configuring Nginx..."
cat > /etc/nginx/sites-available/ramadan-tracker << EOF
# Frontend (Next.js)
server {
    listen 80;
    server_name ramadantracker.app www.ramadantracker.app;
    root /var/www/ramadan-tracker/frontend/.next;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    location /_next/static/ {
        alias /var/www/ramadan-tracker/frontend/.next/static/;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# API Backend
server {
    listen 80;
    server_name api.ramadantracker.app;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/ramadan-tracker /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx

# Setup SSL certificate (will need to run after DNS is pointed)
print_warning "SSL certificates will be set after after DNS is configured"
print_status "To setup SSL later, run: certbot --nginx -d ramadantracker.app -d api.ramadantracker.app"

# Setup database indexes and seed data
print_status "Setting up database..."
cd /var/www/ramadan-tracker/backend
npm run migrate
npm run seed

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup firewall
print_status "Configuring firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Setup log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/ramadan-tracker << EOF
/var/log/ramadan-tracker/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Create a deployment script for future updates
print_status "Creating deployment script..."
cat > /var/www/ramadan-tracker/deploy.sh << EOF
#!/bin/bash
# Deployment script for Ramadan Tracker

cd /var/www/ramadan-tracker

# Pull latest changes
git pull origin master

# Install dependencies
cd backend && npm install --production
cd ../frontend && npm install
cd ../shared && npm install

# Build frontend
cd ../frontend && npm run build

# Restart application
pm2 restart ramadan-tracker-api

echo "Deployment completed at \$(date)"
EOF

chmod +x /var/www/ramdan-tracker/deploy.sh

# Print completion message
echo ""
print_status "✅ VPS Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Point your domain DNS to this server's IP address:"
echo "   - ramadantracker.app → $(curl -s ifconfig.me)"
echo "   - api.ramadantracker.app → $(curl -s ifconfig.me)"
echo ""
echo "2. After DNS propagates, setup SSL:"
echo "   certbot --nginx -d ramadantracker.app -d api.ramadantracker.app"
echo ""
echo "3. Update email settings in /var/www/ramadan-tracker/backend/.env"
echo ""
echo "4. Check application status:"
echo "   pm2 status"
echo "   pm2 logs ramadan-tracker-api"
echo ""
echo "5. To deploy updates in the future:"
echo "   cd /var/www/ramadan-tracker && ./deploy.sh"
echo ""
print_status "🌙 Ramadan Tracker is ready to go live!"

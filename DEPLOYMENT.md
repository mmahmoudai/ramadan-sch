# 🚀 Deployment Guide - Ramadan Tracker

This guide will help you deploy the Ramadan Tracker application on a fresh Ubuntu DigitalOcean VPS.

## 📋 Prerequisites

- Ubuntu 22.04+ VPS (DigitalOcean recommended)
- Domain name (e.g., ramadantracker.app)
- SSH access to your VPS
- Git repository access

## 🌐 Domain Setup

Before deploying, configure your DNS:

1. **Go to your domain registrar** (GoDaddy, Namecheap, etc.)
2. **Add A records** pointing to your VPS IP:
   ```
   A    ramadantracker.app      YOUR_VPS_IP
   A    api.ramadantracker.app  YOUR_VPS_IP
   A    www.ramadantracker.app  YOUR_VPS_IP
   ```

## 🚀 Quick Deploy (One-Click)

1. **Connect to your VPS via SSH**:
   ```bash
   ssh root@64.225.117.214
   ```

2. **Download and run the setup script**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/mmahmoudai/ramadan-sch/main/deploy/setup-vps.sh -o setup.sh
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Wait for the script to complete** (5-10 minutes)

4. **Setup SSL certificates** (after DNS propagates):
   ```bash
   certbot --nginx -d ramadantracker.app -d api.ramadantracker.app
   ```

## 🔧 Manual Deployment Steps

If you prefer to deploy manually:

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### 2. Install MongoDB

```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 3. Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 4. Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/ramadan-tracker
cd /var/www/ramadan-tracker

# Clone repository
sudo git clone https://github.com/mmahmoudai/ramadan-sch.git .

# Install dependencies
cd backend && sudo npm install --production
cd ../frontend && sudo npm install
cd ../shared && sudo npm install

# Build frontend
cd ../frontend && sudo npm run build
```

### 5. Configure Environment

```bash
# Backend environment
cd /var/www/ramadan-tracker/backend
sudo nano .env
```

Add these values (generate your own JWT_SECRET):
```env
PORT=4000
FRONTEND_URL=https://ramadantracker.app
NODE_ENV=production
JWT_SECRET=your-secure-secret-here
MONGO_URI=mongodb://localhost:27017/ramadan_tracker
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@ramadantracker.app
```

```bash
# Frontend environment
cd /var/www/ramadan-tracker/frontend
sudo nano .env.local
```

Add:
```env
NEXT_PUBLIC_API_URL=https://api.ramadantracker.app
```

### 6. Setup PM2

```bash
# Create PM2 config
cd /var/www/ramadan-tracker
sudo nano ecosystem.config.js
```

Add:
```javascript
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
      max_memory_restart: '1G'
    }
  ]
};
```

```bash
# Start application
sudo pm2 start ecosystem.config.js
sudo pm2 save
sudo pm2 startup
```

### 7. Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/ramadan-tracker
```

Add:
```nginx
# Frontend (Next.js)
server {
    listen 80;
    server_name ramadantracker.app www.ramadantracker.app;
    root /var/www/ramadan-tracker/frontend/.next;
    index index.html;

    location /_next/static/ {
        alias /var/www/ramadan-tracker/frontend/.next/static/;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Backend
server {
    listen 80;
    server_name api.ramadantracker.app;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ramadan-tracker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Setup Database

```bash
# Create indexes and seed data
cd /var/www/ramadan-tracker/backend
sudo npm run migrate
sudo npm run seed
```

### 9. Setup SSL

After DNS propagates (usually 30 minutes to a few hours):

```bash
# Setup SSL certificates
sudo certbot --nginx -d ramadantracker.app -d api.ramadantracker.app
```

### 10. Configure Firewall

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## 🔄 Updating the Application

To deploy updates in the future:

```bash
cd /var/www/ramadan-tracker
sudo ./deploy.sh
```

Or manually:

```bash
cd /var/www/ramadan-tracker
sudo git pull origin master
cd backend && sudo npm install --production
cd ../frontend && sudo npm install && sudo npm run build
sudo pm2 restart ramadan-tracker-api
```

## 📊 Monitoring

### Check Application Status

```bash
# PM2 status
pm2 status

# View logs
pm2 logs ramadan-tracker-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MongoDB status
sudo systemctl status mongod
```

### Useful Commands

```bash
# Restart application
pm2 restart ramadan-tracker-api

# Reload Nginx
sudo systemctl reload nginx

# Check SSL certificate expiry
sudo certbot certificates
```

## 🔧 Troubleshooting

### Common Issues

1. **Application won't start**:
   ```bash
   # Check logs
   pm2 logs ramadan-tracker-api
   
   # Check environment variables
   cat /var/www/ramadan-tracker/backend/.env
   ```

2. **Database connection failed**:
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Check MongoDB logs
   sudo tail -f /var/log/mongodb/mongod.log
   ```

3. **Nginx 502 Bad Gateway**:
   ```bash
   # Check if backend is running
   pm2 status
   
   # Check Nginx error log
   sudo tail -f /var/log/nginx/error.log
   ```

4. **SSL Certificate Issues**:
   ```bash
   # Renew certificates
   sudo certbot renew
   
   # Check certificate status
   sudo certbot certificates
   ```

## 📧 Email Configuration

To enable email reminders:

1. **Create a Gmail App Password**:
   - Go to Google Account settings
   - Enable 2-factor authentication
   - Generate an app password

2. **Update environment variables**:
   ```bash
   sudo nano /var/www/ramadan-tracker/backend/.env
   ```

3. **Update these values**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=noreply@ramadantracker.app
   ```

4. **Restart application**:
   ```bash
   sudo pm2 restart ramadan-tracker-api
   ```

## 🎉 Success!

Your Ramadan Tracker is now live at:
- **Frontend**: https://ramadantracker.app
- **API**: https://api.ramadantracker.app

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review application logs
3. Open an issue on GitHub

---

**Ramadan Kareem! 🌙**

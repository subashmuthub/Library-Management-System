# Production Deployment Checklist

This checklist ensures your Smart Library system is production-ready.

---

## Pre-Deployment Checklist

### Security
- [ ] Change JWT_SECRET to strong random value (min 256-bit)
- [ ] Use strong MySQL password
- [ ] Enable MySQL SSL/TLS connection
- [ ] Set NODE_ENV=production in .env
- [ ] Configure CORS_ORIGIN to specific domain (not *)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Disable verbose error messages in production
- [ ] Review and set secure rate limits
- [ ] Enable MySQL audit logging
- [ ] Set up firewall rules (only allow 80, 443, 3306 from app server)

### Configuration
- [ ] Review all .env values for production
- [ ] Set correct library GPS coordinates
- [ ] Configure actual library Wi-Fi SSID
- [ ] Set appropriate confidence thresholds
- [ ] Choose correct mode (DEMO or PRODUCTION)
- [ ] Configure database connection pool size
- [ ] Set up database backups (daily)
- [ ] Configure log rotation

### Database
- [ ] Run on dedicated MySQL server
- [ ] Enable slow query log
- [ ] Optimize indexes (already done in schema)
- [ ] Set up master-slave replication (optional)
- [ ] Configure automated backups
- [ ] Test restore procedure
- [ ] Monitor disk space
- [ ] Set max_connections appropriately

### Application
- [ ] Use process manager (PM2)
- [ ] Set up auto-restart on crash
- [ ] Configure memory limits
- [ ] Enable clustering (multi-core)
- [ ] Set up health check endpoint monitoring
- [ ] Configure log aggregation
- [ ] Test all endpoints in staging
- [ ] Run load tests

### Infrastructure
- [ ] Use reverse proxy (Nginx/Apache)
- [ ] Configure caching headers
- [ ] Enable gzip compression
- [ ] Set up CDN for static assets (if any)
- [ ] Configure load balancer (if multiple instances)
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure alerting (PagerDuty, OpsGenie)
- [ ] Set up log monitoring (ELK Stack)

---

## Deployment Steps

### 1. Prepare Production Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2
```

### 2. Clone Repository

```bash
cd /var/www
git clone <your-repo-url> library
cd library
```

### 3. Install Dependencies

```bash
npm install --production
```

### 4. Configure Environment

```bash
# Copy and edit .env
cp .env.example .env
nano .env
```

**Production .env:**
```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_USER=library_user
DB_PASSWORD=<strong-password-here>
DB_NAME=smart_library

JWT_SECRET=<generate-with: openssl rand -base64 64>
JWT_EXPIRES_IN=24h

DEMO_MODE=false  # or true, depending on your setup

# ... rest of config
```

### 5. Set Up Database

```bash
# Create database user
mysql -u root -p << EOF
CREATE DATABASE smart_library;
CREATE USER 'library_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON smart_library.* TO 'library_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# Run setup
node database/setup.js
```

### 6. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/library
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name library.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name library.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/library.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/library.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/library /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Get SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d library.yourdomain.com
```

### 8. Start Application with PM2

```bash
# Start app
pm2 start src/app.js --name library-api

# Save PM2 config
pm2 save

# Set up auto-start on reboot
pm2 startup
```

### 9. Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow 22
sudo ufw enable
```

### 10. Test Deployment

```bash
# Health check
curl https://library.yourdomain.com/health

# API test
curl https://library.yourdomain.com/api/v1/books/search?q=Pride \
  -H "Authorization: Bearer <token>"
```

---

## Post-Deployment Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs library-api

# Monitor resources
pm2 monit

# View status
pm2 status
```

### MySQL Monitoring

```bash
# Check connections
mysql -u root -p -e "SHOW PROCESSLIST;"

# Check slow queries
mysql -u root -p -e "SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;"

# Check table sizes
mysql -u root -p -e "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)' FROM information_schema.TABLES WHERE table_schema = 'smart_library';"
```

### Nginx Monitoring

```bash
# Check access logs
sudo tail -f /var/log/nginx/access.log

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Check status
sudo systemctl status nginx
```

---

## Maintenance Tasks

### Daily
- [ ] Check error logs
- [ ] Monitor disk space
- [ ] Review API error rates
- [ ] Check database backup success

### Weekly
- [ ] Review performance metrics
- [ ] Check for slow queries
- [ ] Analyze API usage patterns
- [ ] Review security logs

### Monthly
- [ ] Update dependencies
- [ ] Security patches
- [ ] Database optimization
- [ ] Review and adjust rate limits
- [ ] Capacity planning review

---

## Backup Procedures

### Database Backup (Automated)

Create script: `/home/library/backup-db.sh`
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/library"
mkdir -p $BACKUP_DIR

mysqldump -u library_user -p<password> smart_library > $BACKUP_DIR/library_$TIMESTAMP.sql
gzip $BACKUP_DIR/library_$TIMESTAMP.sql

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

Add to crontab:
```bash
crontab -e
# Add: 0 2 * * * /home/library/backup-db.sh
```

### Application Backup

```bash
# Backup .env and config files
tar -czf /var/backups/library/config_$(date +%Y%m%d).tar.gz /var/www/library/.env
```

---

## Disaster Recovery

### Database Restore

```bash
# Restore from backup
gunzip -c /var/backups/library/library_20260205_020000.sql.gz | mysql -u library_user -p smart_library
```

### Application Restore

```bash
cd /var/www/library
git pull origin main
npm install --production
pm2 restart library-api
```

---

## Scaling Strategies

### Vertical Scaling (Single Server)
1. Increase server resources (CPU, RAM)
2. Optimize database queries
3. Add Redis caching
4. Enable PM2 clustering

### Horizontal Scaling (Multiple Servers)
1. Deploy multiple app instances
2. Set up load balancer (Nginx, HAProxy)
3. Use external MySQL server
4. Implement Redis for session storage
5. Configure sticky sessions (if needed)

---

## Performance Optimization

### Database Optimization

```sql
-- Analyze tables
ANALYZE TABLE books, book_location_history, entry_logs;

-- Check index usage
SHOW INDEX FROM book_location_history;

-- Optimize tables
OPTIMIZE TABLE book_location_history;
```

### Application Optimization

```javascript
// Add to src/config/database.js
const pool = mysql.createPool({
  // ... existing config
  connectionLimit: 20,  // Increase for production
  queueLimit: 0,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});
```

### Nginx Caching

```nginx
# Add to nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api/v1/books {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_pass http://localhost:3000;
}
```

---

## Security Hardening

### Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### Set Up Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```

### MySQL Security

```bash
mysql_secure_installation
```

---

## Troubleshooting

### App Won't Start

```bash
# Check PM2 logs
pm2 logs library-api --lines 100

# Check disk space
df -h

# Check memory
free -m

# Check MySQL
sudo systemctl status mysql
```

### High CPU Usage

```bash
# Check processes
top

# Check MySQL queries
mysql -u root -p -e "SHOW FULL PROCESSLIST;"

# Check slow queries
mysql -u root -p -e "SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;"
```

### Database Connection Issues

```bash
# Check MySQL connections
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"

# Check max connections
mysql -u root -p -e "SHOW VARIABLES LIKE 'max_connections';"

# Increase if needed
mysql -u root -p -e "SET GLOBAL max_connections = 200;"
```

---

## Contact Information

**System Administrator:** _______________________  
**Developer:** _______________________  
**On-Call:** _______________________  

**Emergency Contacts:**
- Database Admin: _______________________
- Network Admin: _______________________
- Security Team: _______________________

---

## Deployment History

| Date | Version | Deployed By | Changes | Rollback Tested |
|------|---------|-------------|---------|-----------------|
| 2026-02-05 | 1.0.0 | Initial | First deployment | ✓ |
|      |       |     |                |   |
|      |       |     |                |   |

---

**Deployment Status: [ ] NOT READY  [ ] READY  [ ] DEPLOYED**

**Production URL:** https://library.yourdomain.com  
**Last Updated:** 2026-02-05  
**Next Review:** _______________________

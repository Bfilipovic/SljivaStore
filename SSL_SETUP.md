# SSL/HTTPS Setup for nft.kodak.press

This guide explains how to set up HTTPS using Let's Encrypt certificates.

## Prerequisites

1. Domain `nft.kodak.press` must point to your server's IP address
2. Ports 80 and 443 must be open in your firewall
3. Certbot must be installed on the host system

## Step 1: Install Certbot

On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install certbot
```

On CentOS/RHEL:
```bash
sudo yum install certbot
```

## Step 2: Create Required Directories

```bash
cd /home/bratislav/Documents/SljivaStore
mkdir -p ssl/nft.kodak.press
mkdir -p certbot/www
```

## Step 3: Obtain SSL Certificate

**Important**: For the initial certificate, you need to temporarily modify nginx.conf to allow HTTP access for the ACME challenge, OR use certbot in standalone mode.

### Option A: Using Certbot Standalone (Recommended for first time)

1. Stop nginx container:
```bash
docker-compose stop nginx
```

2. Run certbot in standalone mode:
```bash
sudo certbot certonly --standalone -d nft.kodak.press --email your-email@example.com --agree-tos --non-interactive
```

3. Copy certificates to the ssl directory:
```bash
sudo cp /etc/letsencrypt/live/nft.kodak.press/fullchain.pem ssl/nft.kodak.press/
sudo cp /etc/letsencrypt/live/nft.kodak.press/privkey.pem ssl/nft.kodak.press/
sudo chown $USER:$USER ssl/nft.kodak.press/*.pem
```

4. Start nginx:
```bash
docker-compose up -d nginx
```

### Option B: Using Certbot with Webroot (Alternative)

If you prefer to keep nginx running during certificate generation:

1. Ensure nginx is running and the `.well-known/acme-challenge/` location is accessible
2. Run:
```bash
sudo certbot certonly --webroot -w ./certbot/www -d nft.kodak.press --email your-email@example.com --agree-tos
```

3. Copy certificates as shown in Option A

## Step 4: Verify Configuration

Check that your certificates are in place:
```bash
ls -la ssl/nft.kodak.press/
```

You should see:
- `fullchain.pem`
- `privkey.pem`

## Step 5: Restart Nginx

```bash
docker-compose restart nginx
```

## Step 6: Test HTTPS

Visit `https://nft.kodak.press` in your browser. You should see a valid SSL certificate.

## Automatic Certificate Renewal

Set up a cron job to automatically renew certificates:

1. Create a renewal script:
```bash
cat > renew-cert.sh << 'EOF'
#!/bin/bash
certbot renew --quiet
docker-compose cp /etc/letsencrypt/live/nft.kodak.press/fullchain.pem nginx:/etc/nginx/ssl/nft.kodak.press/
docker-compose cp /etc/letsencrypt/live/nft.kodak.press/privkey.pem nginx:/etc/nginx/ssl/nft.kodak.press/
docker-compose exec nginx nginx -s reload
EOF
chmod +x renew-cert.sh
```

2. Add to crontab (runs twice daily):
```bash
sudo crontab -e
```

Add:
```
0 0,12 * * * /path/to/renew-cert.sh
```

## Troubleshooting

- **Certificate not found**: Ensure certificates are copied to `ssl/nft.kodak.press/` directory
- **Permission denied**: Check file permissions: `chmod 644 ssl/nft.kodak.press/*.pem`
- **Port 443 not accessible**: Check firewall: `sudo ufw allow 443/tcp`
- **Nginx fails to start**: Check nginx logs: `docker-compose logs nginx`

## Note

The nginx configuration expects certificates at:
- `/etc/nginx/ssl/nft.kodak.press/fullchain.pem` (inside container, mapped from `./ssl/nft.kodak.press/fullchain.pem` on host)
- `/etc/nginx/ssl/nft.kodak.press/privkey.pem` (inside container, mapped from `./ssl/nft.kodak.press/privkey.pem` on host)


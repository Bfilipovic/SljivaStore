# Quick Setup: Explorer Domain `nft.nomin.foundation`

## The Problem

Your explorer is running on `http://161.97.146.46:4175/` but you want it accessible via `nft.nomin.foundation`.

## Solution: Configure Nginx as Reverse Proxy

You need to configure nginx to:
1. Accept requests for `nft.nomin.foundation`
2. Forward them to `localhost:4175` (where your explorer is running)

## Steps

### 1. Verify DNS is Configured

Make sure your DNS record points to your server IP:
```bash
dig nft.nomin.foundation
# Should return: 161.97.146.46
```

If it doesn't resolve, add the DNS record first:
- Type: A
- Name: nft (or @)
- Value: 161.97.146.46

### 2. Create Nginx Configuration

On your server, create/edit the nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/nft.nomin.foundation
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name nft.nomin.foundation;

    # Explorer API routes (must come before / location)
    location /api/explorer {
        proxy_pass http://localhost:4175;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:4175/health;
        proxy_set_header Host $host;
    }

    # Static files and SPA routes
    location / {
        proxy_pass http://localhost:4175;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Enable the Configuration

```bash
# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/nft.nomin.foundation /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

### 4. Verify Explorer is Running

```bash
# Check if explorer is accessible locally
curl http://localhost:4175/health

# Should return: {"status":"ok","service":"explorer-api"}
```

### 5. Test the Domain

```bash
# Test from server
curl http://nft.nomin.foundation/health

# Or open in browser
# http://nft.nomin.foundation
```

## Troubleshooting

### Domain doesn't work

1. **Check DNS:**
   ```bash
   dig nft.nomin.foundation
   nslookup nft.nomin.foundation
   ```

2. **Check nginx is running:**
   ```bash
   sudo systemctl status nginx
   ```

3. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

4. **Check explorer is running:**
   ```bash
   curl http://localhost:4175/health
   ps aux | grep explorer
   ```

### 502 Bad Gateway

- Explorer might not be running on port 4175
- Check: `curl http://localhost:4175/health`
- Check firewall: `sudo ufw status`

### Connection Refused

- Verify explorer is listening on `0.0.0.0:4175` (not just `127.0.0.1`)
- Check explorer logs for errors

## Optional: Add HTTPS (Recommended)

After HTTP works, add HTTPS using Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d nft.nomin.foundation
```

This will:
- Get SSL certificate
- Configure HTTPS
- Set up automatic renewal

**Important:** HTTPS is required for `crypto.subtle` to work in the verification feature!

## Multiple Domains on Same Server

If you have both the store and explorer on the same server, nginx can handle both:

```nginx
# Store domain
server {
    listen 80;
    server_name kodak.beogradfilm.com;
    # ... store config
}

# Explorer domain  
server {
    listen 80;
    server_name nft.nomin.foundation;
    # ... explorer config (from above)
}
```

## Need Help?

1. Check explorer logs
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify explorer is running: `curl http://localhost:4175/health`
4. Test DNS: `dig nft.nomin.foundation`


# Quick Setup: Explorer Domain `nft.nomin.foundation`

## The Problem

Your explorer is running on `http://161.97.146.46:4175/` but you want it accessible via `nft.nomin.foundation`.

## Solution: Configure Nginx as Reverse Proxy

You need to configure nginx to:
1. Accept requests for `nft.nomin.foundation`
2. Forward them to `localhost:4175` (where your explorer is running)

## File Location Options

**The nginx config file can stay in your project** (`explorer-nginx.conf`). You have two options:

1. **Copy to nginx directory** (recommended) - Copy it to `/etc/nginx/sites-available/` during deployment
2. **Use include directive** - Point nginx to the project file using an include

Both options work - see details below.

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

### 2. Set Up Nginx Configuration

#### Option A: Copy from Project (Recommended)

If you have the project on your server:

```bash
# From your project directory
sudo cp explorer-nginx.conf /etc/nginx/sites-available/nft.nomin.foundation

# Or use the automated setup script
sudo ./scripts/setup-explorer-nginx.sh
```

#### Option B: Use Include Directive

You can also keep it in the project and include it in nginx's main config:

1. Edit nginx main config:
   ```bash
   sudo nano /etc/nginx/nginx.conf
   ```

2. Add inside the `http` block:
   ```nginx
   http {
       # ... other config ...
       
       # Include explorer config from project directory
       include /path/to/SljivaStore/explorer-nginx.conf;
   }
   ```

   Note: Make sure nginx has read permissions for the file.

#### Option C: Create Manually

If you prefer to create it manually:

```bash
sudo nano /etc/nginx/sites-available/nft.nomin.foundation
```

Then copy the content from `explorer-nginx.conf` in the project.

### 3. Enable the Configuration

If using Option A or C:

```bash
# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/nft.nomin.foundation /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

If using Option B (include), just reload nginx after editing the main config.

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

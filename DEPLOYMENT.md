# StepCharge AI — Production Deployment Guide

This guide covers deploying the StepCharge AI platform in a production cloud environment with SSL/TLS, reverse proxies, and MongoDB Atlas.

---

## 1. MongoDB Atlas Configuration

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Create an **M0 Free** or **M10 Dedicated** Cluster in your preferred cloud region.
3. In **Database Access**, create a user with `readWrite` privileges for the `stepcharge` database.
4. In **Network Access**, whitelist your production server's static IP or NAT Gateway IP.
5. Copy the connection string format:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/stepcharge?retryWrites=true&w=majority
   ```

---

## 2. Google Cloud OAuth 2.0 Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select your project and navigate to **APIs & Services → Credentials**.
3. Create an **OAuth 2.0 Client ID** of type **Web application**.
4. Configure **Authorized JavaScript origins**:
   - `https://stepcharge.yourdomain.com`
5. Configure **Authorized redirect URIs**:
   - `https://api.stepcharge.yourdomain.com/api/auth/google/callback`
6. Save the `Client ID` and `Client Secret` to your backend production environment variables.

---

## 3. Reverse Proxy Configuration (Nginx)

Below is a production Nginx server configuration providing SSL termination, WebSocket proxying, and path routing:

```nginx
# Upstream Servers
upstream backend_nodes {
    server 127.0.0.1:5000;
    keepalive 32;
}

# Frontend Dashboard
server {
    listen 443 ssl http2;
    server_name stepcharge.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/stepcharge.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stepcharge.yourdomain.com/privkey.pem;

    root /var/www/stepcharge/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API & Socket.IO
server {
    listen 443 ssl http2;
    server_name api.stepcharge.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.stepcharge.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.stepcharge.yourdomain.com/privkey.pem;

    # REST Endpoints
    location /api/ {
        proxy_pass http://backend_nodes;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Socket.IO Real-time WebSockets
    location /socket.io/ {
        proxy_pass http://backend_nodes;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 4. Process Management (PM2)

Use PM2 to run both the Node.js backend and the Python ML microservice:

```bash
# Start backend cluster
cd /var/www/stepcharge/backend
npm run build
pm2 start dist/server.js --name "stepcharge-backend" -i max

# Start Python ML service
cd /var/www/stepcharge/ml-service
pm2 start "uvicorn app:app --host 127.0.0.1 --port 8000" --name "stepcharge-ml"

# Persist processes across reboot
pm2 save
pm2 startup
```

---

## 5. Containerized Production Deployment (Docker & Docker Compose)

StepCharge AI provides a production-grade multi-container topology orchestrating all 4 stack services:

```bash
# 1. Clone repository
git clone https://github.com/your-org/stepcharge-ai.git
cd stepcharge-ai

# 2. Configure environment variables
cp .env.example .env.local
cp backend/.env.example backend/.env
# Edit backend/.env with your Google OAuth and MongoDB Atlas credentials

# 3. Start all services in detached mode
docker compose up -d --build

# 4. Verify running containers
docker compose ps

# 5. Check service health
curl http://localhost:5000/api/system/health
curl http://localhost:5000/api/system/monitor?deviceId=ESP32-01
curl http://localhost:8000/health
```

### Services Deployed:
- `stepcharge-frontend`: Nginx serving the compiled SPA on port 80 with API reverse-proxy and WebSocket upgrades.
- `stepcharge-backend`: Node.js 20 Express TypeScript API on port 5000 with MongoDB Mongoose and Socket.IO.
- `stepcharge-ml-service`: Python 3.11 FastAPI microservice on port 8000 with Scikit-Learn models.
- `stepcharge-mongodb`: Persistent local MongoDB 7.0 container (or connect to MongoDB Atlas).

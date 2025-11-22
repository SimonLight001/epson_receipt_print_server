# Portainer Setup Instructions

## Quick Start for Portainer

### Step 1: Load the Docker Image

Before deploying the stack, you need to load the pre-built Docker image.

**Option A: Via Portainer UI**
1. In Portainer, go to **Images** (left sidebar)
2. Click **"Import image from file"** or **"Upload"**
3. Upload `epson-printer-handler.tar.gz`
4. Wait for the import to complete

**Option B: Via Command Line (on the server)**
```bash
docker load < epson-printer-handler.tar.gz
```

Verify the image is loaded:
```bash
docker images | grep epson-printer-handler
```

### Step 2: Deploy the Stack in Portainer

1. In Portainer, go to **Stacks** (left sidebar)
2. Click **"Add stack"**
3. Give it a name (e.g., `epson-printer-handler`)
4. **Method 1: Web editor**
   - Paste the contents of `docker-compose.yml`
   - Portainer will automatically detect `stack.env` if you upload it in the same directory
   
5. **Method 2: Upload files**
   - Upload `docker-compose.yml`
   - Upload `stack.env` (Portainer will use it automatically if named `stack.env`)

6. Click **"Deploy the stack"**

### Step 3: Verify It's Running

1. Go to **Containers** in Portainer
2. You should see `epson-printer-handler` running
3. Check the logs if needed: Click on the container → **Logs**

### Step 4: Access the Web Interface

- Open `http://your-server-ip:3100` in your browser
- Or if on the server: `http://localhost:3100`

## Important Notes

- The `docker-compose.yml` is configured to use the pre-built image (`epson-printer-handler:latest`)
- Make sure the image is loaded before deploying, otherwise the stack will fail to start
- The stack uses `stack.env` for environment variables (PORT=3100)
- USB device access requires privileged mode (already configured)

## Troubleshooting

**Stack fails to start:**
- Check if the image exists: `docker images | grep epson-printer-handler`
- If not, load it first (see Step 1)
- Check container logs in Portainer

**Can't access web interface:**
- Verify the port is correct (default: 3100)
- Check firewall settings on your server
- Verify the container is running in Portainer

**USB printer not detected:**
- The container needs privileged mode (already set in docker-compose.yml)
- Make sure the printer is connected to the server
- Use the web interface to scan for USB devices


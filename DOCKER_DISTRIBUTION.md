# Docker Image Distribution Guide

This guide explains how to build, save, and distribute the Docker image for the Epson Printer Handler.

## Building the Image

Build the image locally:
```bash
docker build -t epson-printer-handler .
```

## Saving the Image for Distribution

After building, save the image to a compressed file:

### Option 1: Using the provided script
```bash
chmod +x save-image.sh
./save-image.sh
```

This will create `epson-printer-handler.tar.gz` in the current directory.

### Option 2: Manual save
```bash
docker save epson-printer-handler:latest | gzip > epson-printer-handler.tar.gz
```

## Loading the Image on Another Machine

### On Linux/macOS Server:

1. **Transfer the file** to your server (using scp, rsync, or any file transfer method):
   ```bash
   scp epson-printer-handler.tar.gz user@server:/path/to/destination/
   ```

2. **Load the image** on the server:
   ```bash
   docker load < epson-printer-handler.tar.gz
   ```

3. **Verify the image is loaded**:
   ```bash
   docker images | grep epson-printer-handler
   ```

### Using Portainer:

1. **Upload the image file** to your server
2. In Portainer, go to **Images**
3. Click **"Import image from file"** or **"Upload"**
4. Select `epson-printer-handler.tar.gz`
5. Wait for the upload and import to complete
6. The image `epson-printer-handler:latest` will be available

## Using the Pre-built Image

Once the image is loaded on your server, you can use it with docker-compose:

1. **Update docker-compose.yml** to use the image instead of building:
   ```yaml
   services:
     epson-printer-handler:
       image: epson-printer-handler:latest  # Use pre-built image
       # Remove or comment out: build: .
   ```

2. **Deploy with docker-compose**:
   ```bash
   docker-compose up -d
   ```

## File Size Considerations

The compressed image file (`epson-printer-handler.tar.gz`) will be approximately 200-400 MB depending on the base image and dependencies. 

**Note:** The `.gitignore` file excludes `*.tar.gz` files, so you'll need to:
- Upload the image file separately (not via git)
- Use a file sharing service, cloud storage, or direct transfer to your server
- Or host it on a Docker registry (see below)

## Alternative: Using a Docker Registry

For easier distribution, you can push the image to a Docker registry:

### Docker Hub:
```bash
# Tag the image
docker tag epson-printer-handler:latest yourusername/epson-printer-handler:latest

# Login to Docker Hub
docker login

# Push the image
docker push yourusername/epson-printer-handler:latest
```

Then in `docker-compose.yml`:
```yaml
services:
  epson-printer-handler:
    image: yourusername/epson-printer-handler:latest
```

### Private Registry:
```bash
# Tag for your registry
docker tag epson-printer-handler:latest registry.example.com/epson-printer-handler:latest

# Push
docker push registry.example.com/epson-printer-handler:latest
```

## Quick Start for End Users

If you're distributing this to others:

1. **Provide the image file** (`epson-printer-handler.tar.gz`)
2. **Provide the docker-compose.yml** (configured to use the image)
3. **Provide the stack.env** file
4. **Instructions:**
   ```bash
   # Load the image
   docker load < epson-printer-handler.tar.gz
   
   # Start the service
   docker-compose up -d
   ```


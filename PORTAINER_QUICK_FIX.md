# Quick Fix: "pull access denied" Error in Portainer

## The Problem
Portainer is trying to pull the image from Docker Hub, but the image only exists locally. You need to load it first.

## Solution: Load the Image Before Deploying

### Step 1: Load the Image in Portainer

**Option A: Via Portainer UI (Recommended)**
1. In Portainer, go to **Images** (left sidebar)
2. Look for an **"Import image"** or **"Upload"** button
   - If you see **"Import image"**, click it
   - If you see **"Pull image"**, look for a tab or option for "Import from file"
3. Upload the `epson-printer-handler.tar.gz` file
4. Wait for the import to complete (this may take a few minutes)
5. Verify the image appears in the Images list as `epson-printer-handler:latest`

**Option B: Via SSH/Command Line (if you have server access)**
```bash
# Transfer the tar.gz file to your server first, then:
docker load < epson-printer-handler.tar.gz

# Verify it loaded:
docker images | grep epson-printer-handler
```

### Step 2: Deploy the Stack Again

1. Go back to **Stacks** in Portainer
2. Edit your stack or create a new one
3. Paste the `docker-compose.yml` content
4. Make sure `stack.env` is uploaded/configured
5. Click **Deploy**

The stack should now work because the image exists locally!

## Alternative: Build from Source Instead

If you can't load the image file, you can build it from source:

1. In `docker-compose.yml`, change:
   ```yaml
   # Comment out these lines:
   # image: epson-printer-handler:latest
   # pull_policy: never
   
   # Uncomment this line:
   build: .
   ```

2. Make sure all source files are in the Portainer stack directory (from GitHub repo)

3. Deploy - Portainer will build the image automatically

## Verify Image is Loaded

Before deploying, check in Portainer:
- Go to **Images**
- Look for `epson-printer-handler` in the list
- If it's not there, you need to load it first (Step 1)


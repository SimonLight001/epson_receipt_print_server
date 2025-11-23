# Epson TM-T900F Printer Handler

A web server with REST API support for printing to your Epson TM-T900F receipt printer via USB.

## Features

- 🌐 Web interface for easy printing
- 🔌 REST API endpoints for programmatic access
- 🖨️ Direct USB printer support
- ✅ Printer status checking
- 🧪 Test print functionality

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Epson TM-T900F printer connected via USB
- macOS/Linux (for USB printing via system commands)

## Setting Up Your Printer

You have two options to connect your Epson TM-T900F printer:

### Option 1: Add Printer to macOS (Recommended for beginners)

1. Connect your Epson printer via USB
2. Open **System Settings** (or **System Preferences** on older macOS)
3. Go to **Printers & Scanners**
4. Click the **"+"** button to add a printer
5. Your Epson printer should appear in the list - select it
6. If it doesn't appear, click **"Add Other Printer or Scanner"** and look for it
7. For driver, you can try:
   - **Generic Text/Plain Text Printer** (works for receipt printers)
   - Or download the Epson driver from [Epson's website](https://support.epson.com)
8. Once added, note the printer name

The server will automatically detect and use this printer.

### Option 2: Direct USB Communication (Advanced)

If your printer doesn't appear in macOS printer settings, you can use direct USB communication:

1. Make sure your printer is connected via USB
2. Start the server: `npm start`
3. Open the web interface: `http://localhost:3100`
4. Click **"Scan USB"** to find USB devices
5. If your printer appears in the list, click **"Use This Device"** next to it
6. The server will now communicate directly with the USB device

**Note:** Direct USB communication requires the printer to appear as a serial device (usually `/dev/cu.*` or `/dev/tty.*` on macOS).

## Installation

### Option 1: Docker (Recommended for Server Deployment)

This is the easiest way to deploy on a Linux server where the printer is connected.

1. **Build the Docker image:**
```bash
docker build -t epson-printer-handler .
```

2. **Run with Docker Compose (Recommended):**
```bash
docker-compose up -d
```

3. **Or run directly with Docker:**
```bash
docker run -d \
  --name epson-printer-handler \
  --privileged \
  -p 3100:3100 \
  --device=/dev/bus/usb:/dev/bus/usb \
  -v /dev:/dev \
  epson-printer-handler:latest
```

**Important:** The `--device=/dev/bus/usb:/dev/bus/usb` flag is **required** for USB printer access!

**Important Notes for Docker:**
- The container needs `--privileged` mode or specific device access to communicate with USB printers
- USB devices are mounted from the host at `/dev/bus/usb` and `/dev`
- The container includes CUPS for system printing support
- Access the web interface at `http://localhost:3100` (or your server's IP address)

**Finding your printer in Docker:**
1. Connect your printer via USB to the server
2. Access the web interface at `http://your-server-ip:3100`
3. Click "Scan USB" to find available USB devices
4. Click "Use This Device" next to your printer's device path

### Option 2: Local Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure your Epson printer is connected via USB and recognized by your system.

3. On macOS, you may need to add the printer to your system:
   - Go to System Preferences > Printers & Scanners
   - Click the "+" button to add a printer
   - Select your Epson TM-T900F printer
   - Note the printer name (you may need it for configuration)

## Usage

### Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3100`

### Web Interface

Open your browser and navigate to:
```
http://localhost:3100
```

You can:
- Enter text in the text field and click "Print Text"
- Click "Test Print" to send a test print job
- Click "Refresh Status" to check printer availability

### REST API Endpoints

All endpoints are prefixed with `/api`

#### Health Check
```bash
GET /api/health
```

#### Get Printer Status
```bash
GET /api/printer/status
```

Response:
```json
{
  "success": true,
  "systemPrinters": ["printer_name"],
  "usbDevices": ["/dev/cu.usbserial-xxx"],
  "currentUsbDevice": "/dev/cu.usbserial-xxx",
  "message": "Printers/devices found"
}
```

#### Scan USB Devices
```bash
GET /api/printer/scan-usb
```

Scans for available USB serial devices that might be your printer.

Response:
```json
{
  "success": true,
  "devices": ["/dev/cu.usbserial-xxx", "/dev/tty.usbmodem-xxx"],
  "message": "Found 2 USB device(s)"
}
```

#### Set USB Device
```bash
POST /api/printer/set-usb-device
Content-Type: application/json

{
  "devicePath": "/dev/cu.usbserial-xxx"
}
```

Sets a USB device path for direct communication with the printer.

#### Print Text
```bash
POST /api/print
Content-Type: application/json

{
  "text": "Your text to print"
}
```

Response:
```json
{
  "success": true,
  "message": "Print job sent successfully"
}
```

#### Test Print
```bash
POST /api/print/test
```

Sends a formatted test print to verify printer functionality.

#### Print Receipt (Formatted)
```bash
POST /api/print/receipt
Content-Type: application/json

{
  "title": "Receipt Title",
  "text": "Additional text",
  "items": ["Item 1", "Item 2", "Item 3"]
}
```

#### Print Tasks (Structured Task List)
```bash
POST /api/print/tasks
Content-Type: application/json

{
  "heading": "Task Heading",
  "tasks": ["Task 1", "Task 2", "Task 3"]
}
```

This endpoint prints a structured task list with:
- **Heading**: Center-aligned at the top
- **Date/Time**: Right-aligned (format: "23 Nov 15:13")
- **Tasks**: Left-aligned with checkboxes `[ ]`

Example output format:
```
    Task Heading

        23 Nov 15:13

  [ ] Task 1
  [ ] Task 2
  [ ] Task 3
```

#### API Documentation (Swagger/OpenAPI)
```bash
GET /api/docs
GET /swagger.json
```

Returns OpenAPI 3.0 specification in JSON format. This endpoint is designed for AI agents to discover and understand the API.

### Example API Usage

#### Using curl:
```bash
# Print text
curl -X POST http://localhost:3100/api/print \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from the API!"}'

# Test print
curl -X POST http://localhost:3100/api/print/test

# Check status
curl http://localhost:3100/api/printer/status
```

#### Using JavaScript (fetch):
```javascript
// Print text
fetch('http://localhost:3100/api/print', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Hello from JavaScript!'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

## How It Works

The server uses two methods to communicate with the printer:

1. **USB Printing (Primary)**: Uses system commands (`lp` on macOS/Linux) to send print jobs directly to USB-connected printers. This is the most reliable method for USB printers.

2. **Thermal Printer Library (Fallback)**: Uses the `node-thermal-printer` library with ESC/POS commands. This is useful for network printers or when direct USB access isn't available.

## Troubleshooting

### Printer Not Detected

1. **Check USB connection:**
   - Make sure the printer is connected via USB
   - Verify the printer is powered on
   - Try unplugging and replugging the USB cable

2. **Try adding to macOS:**
   - Go to System Settings > Printers & Scanners
   - Click "+" to add a printer
   - Look for your Epson printer in the list
   - If not found, try "Add Other Printer or Scanner"
   - Use "Generic Text/Plain Text Printer" as the driver

3. **Try direct USB communication:**
   - Click "Scan USB" in the web interface
   - If devices appear, try setting one as the USB device
   - Common device paths: `/dev/cu.usbserial*` or `/dev/tty.usbserial*`

4. **Check system printers:**
   - Run `lpstat -p -d` in terminal to see available printers
   - Run `ls -la /dev/cu.* /dev/tty.*` to see USB serial devices

### Print Jobs Not Printing

1. Check printer status: `GET /api/printer/status`
2. Verify printer is online and has paper
3. Check system print queue: `lpq` (macOS/Linux)
4. Try a test print from the web interface

### Permission Issues

On Linux, you may need to add your user to the `lp` group:
```bash
sudo usermod -a -G lp $USER
```

Then log out and log back in.

## Configuration

You can set the port using an environment variable:
```bash
PORT=8080 npm start
```

For Docker, you can set the port in `docker-compose.yml` or via environment variable:
```bash
docker run -e PORT=8080 -p 8080:8080 ...
```

## Docker Deployment on Server

When deploying to a Linux server where the printer is physically connected:

1. **SSH into your server** and clone/navigate to this repository

2. **Build the image:**
```bash
docker build -t epson-printer-handler .
```

3. **Start the container:**
```bash
docker-compose up -d
```

4. **Check logs:**
```bash
docker-compose logs -f
```

5. **Access the web interface:**
   - If on the same network: `http://server-ip:3100`
   - If on the server: `http://localhost:3100`

6. **Configure the printer:**
   - Open the web interface
   - Click "Scan USB" to find your printer
   - Click "Use This Device" to configure it

**Troubleshooting Docker:**
- If USB devices aren't detected, ensure the container has proper permissions:
  - Check that `--privileged` is set or devices are properly mounted
  - Verify USB devices exist on host: `ls -la /dev/tty* /dev/cu*`
- If printing fails, check container logs: `docker-compose logs`
- You may need to add the printer to CUPS inside the container:
  ```bash
  docker exec -it epson-printer-handler lpadmin -p epson -E -v usb://Epson/TM-T900F
  ```

## License

MIT


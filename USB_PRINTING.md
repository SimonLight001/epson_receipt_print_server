# USB Printing with Vendor/Product IDs

This server now supports direct USB printing using vendor and product IDs, which is the most reliable method for USB-connected Epson printers.

## How It Works

The server uses Python's `python-escpos` library (which you've confirmed works) to communicate directly with USB printers using their vendor and product IDs.

## Auto-Detection

The server automatically detects Epson USB devices on startup. If an Epson printer is found, it will be configured automatically. You can verify this in the web interface's printer status section.

## Configuration

### Method 1: Via Web Interface (Recommended)

1. Open the web interface at `http://your-server:3100`
2. The server will automatically detect Epson USB devices on startup
3. If auto-detection didn't work:
   - Click **"Scan USB"** to see all USB devices
   - Epson devices will be highlighted in green
   - Click on an Epson device to auto-configure it
   - Or click any device to use it
   - Or use the manual entry option at the bottom of the scan list
4. In the "Printer Status" section, you can also manually enter USB IDs:
   - **Vendor ID**: `0x04b8` (or `1208` in decimal)
   - **Product ID**: `0x0e02` (or `3586` in decimal)
   - Click **"Set USB IDs"**
5. The IDs will be saved and used for all future print jobs

### Method 2: Via API

```bash
curl -X POST http://your-server:3100/api/printer/set-usb-ids \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "0x04b8",
    "product_id": "0x0202"
  }'
```

### Method 3: Environment Variables

Set in `stack.env` or docker-compose environment:
```env
USB_VENDOR_ID=0x04b8
USB_PRODUCT_ID=0x0202
```

## Finding Your USB IDs

On Linux, use `lsusb`:
```bash
lsusb
```

Look for your Epson printer, e.g.:
```
Bus 001 Device 003: ID 04b8:0202 Seiko Epson Corp. TM-T900F
```

The format is `VENDOR:PRODUCT` where:
- `04b8` = Vendor ID (0x04b8 in hex, 1208 in decimal)
- `0202` = Product ID (0x0202 in hex, 514 in decimal)

## Print Priority

The server tries printing methods in this order:

1. **USB Vendor/Product IDs** (if configured) - Most reliable for USB
2. USB device path (if set via `/api/printer/set-usb-device`)
3. System printer (via `lp` command)
4. Thermal printer library fallback

## API Endpoints

### Set USB IDs
```bash
POST /api/printer/set-usb-ids
Content-Type: application/json

{
  "vendor_id": "0x04b8",
  "product_id": "0x0202"
}
```

### Get USB IDs
```bash
GET /api/printer/usb-ids
```

Response:
```json
{
  "success": true,
  "vendor_id": "0x04b8",
  "product_id": "0x0202",
  "configured": true
}
```

## Troubleshooting

**Printer not printing:**
1. Verify USB IDs are correct using `lsusb`
2. Check that the printer is connected and powered on
3. Ensure the container has USB access (privileged mode or proper device mounting)
4. Check container logs: `docker logs epson-printer-handler`

**Permission errors:**
- The container needs privileged mode or proper USB device access
- On Linux, you may need to add udev rules for USB access

**Python script errors:**
- Verify `python-escpos` is installed: `docker exec epson-printer-handler pip3 list | grep escpos`
- Check Python script is executable: `docker exec epson-printer-handler ls -la /app/print_usb.py`

## Technical Details

- Uses Python's `python-escpos` library via subprocess
- Supports both hex (`0x04b8`) and decimal (`1208`) format for IDs
- Automatically cuts paper after printing
- Handles special characters and multi-line text correctly


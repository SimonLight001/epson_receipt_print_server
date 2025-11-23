# USB Printing Troubleshooting

## Error: "No such device" or "Device not found"

This error means the Docker container cannot access the USB printer. Here are the solutions:

### 1. Verify USB Device is Connected

On the host machine, run:
```bash
lsusb
```

You should see your Epson printer listed, e.g.:
```
Bus 001 Device 003: ID 04b8:0e02 Seiko Epson Corp. TM-T88V
```

### 2. Check Docker Container USB Access

The container needs privileged mode and USB device access. Verify your `docker-compose.yml` has:

```yaml
privileged: true
devices:
  - /dev/bus/usb:/dev/bus/usb
volumes:
  - /dev:/dev
```

### 3. Verify Container Can See USB Devices

Inside the container, check if USB devices are visible:
```bash
docker exec -it epson-printer-handler lsusb
```

If this shows no devices or doesn't work, the container doesn't have USB access.

### 4. Check USB Permissions

On the host, check USB device permissions:
```bash
ls -la /dev/bus/usb/
```

The container user needs access to these devices. Privileged mode should handle this.

### 5. Restart Container After Connecting Printer

If you connect the printer after starting the container:
1. Disconnect and reconnect the USB cable
2. Restart the container: `docker-compose restart`

### 6. Alternative: Run Container with Specific USB Device

If the above doesn't work, you can try mounting the specific USB device:

```yaml
devices:
  - /dev/bus/usb/001/003:/dev/bus/usb/001/003  # Replace with your device path
```

Find the device path using:
```bash
ls -la /dev/bus/usb/*/
```

### 7. Check Python-escpos Library

Verify the library is installed in the container:
```bash
docker exec -it epson-printer-handler pip3 list | grep escpos
```

Should show: `python-escpos`

### 8. Test USB Access from Container

Try running the Python script directly from the container:
```bash
docker exec -it epson-printer-handler python3 -c "
from escpos.printer import Usb
p = Usb(0x04b8, 0x0e02)
p.text('Test\n')
p.cut()
"
```

If this fails, the container doesn't have USB access.

## Common Solutions

### Solution 1: Ensure Privileged Mode
```yaml
privileged: true
```

### Solution 2: Mount USB Devices (REQUIRED)
```yaml
devices:
  - /dev/bus/usb:/dev/bus/usb  # This is REQUIRED for USB access!
volumes:
  - /dev:/dev
```

**Note:** The `--device=/dev/bus/usb:/dev/bus/usb` flag is critical. Without it, the container cannot access USB devices even with privileged mode.

### Solution 3: Add udev Rules (Linux Host)

Create `/etc/udev/rules.d/99-usb-printer.rules`:
```
SUBSYSTEM=="usb", ATTR{idVendor}=="04b8", MODE="0666"
```

Then reload:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Solution 4: Run Container as Root User

In docker-compose.yml:
```yaml
user: "0:0"  # Run as root
```

## Verification Steps

1. **Host can see device**: `lsusb | grep Epson`
2. **Container can see device**: `docker exec epson-printer-handler lsusb | grep Epson`
3. **Python can access device**: Run test script above
4. **Web interface shows device**: Click "Scan USB" in web interface

If all steps pass, USB printing should work!


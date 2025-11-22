const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');

const app = express();
const PORT = process.env.PORT || 3100;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize printer
let printer = null;
let usbDevicePath = null;
// USB vendor/product IDs for direct USB printing (using python-escpos)
let usbVendorId = process.env.USB_VENDOR_ID || null; // e.g., '0x04b8' or 1208
let usbProductId = process.env.USB_PRODUCT_ID || null; // e.g., '0x0202' or 514

// Scan for USB devices that might be the Epson printer
async function scanUSBDevices() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const fs = require('fs');
  
  const devices = [];
  
  try {
    // Check common USB serial device paths on macOS
    const possiblePaths = [
      '/dev/cu.usbserial*',
      '/dev/cu.usbmodem*',
      '/dev/tty.usbserial*',
      '/dev/tty.usbmodem*',
      '/dev/cu.*',
    ];
    
    // List all serial devices
    try {
      const { stdout } = await execAsync('ls -1 /dev/cu.* /dev/tty.* 2>/dev/null | head -20');
      const deviceList = stdout.trim().split('\n').filter(d => d.trim());
      
      for (const device of deviceList) {
        if (fs.existsSync(device)) {
          devices.push(device);
        }
      }
    } catch (e) {
      // Ignore if no devices found
    }
    
    // Also check ioreg for Epson devices
    try {
      const { stdout } = await execAsync('ioreg -p IOUSB -l -w 0 | grep -i "Epson\\|TM-T900" -A 10 -B 5');
      if (stdout.trim()) {
        console.log('Found potential Epson device in ioreg:', stdout.substring(0, 200));
      }
    } catch (e) {
      // Ignore
    }
    
  } catch (error) {
    console.error('Error scanning USB devices:', error);
  }
  
  return devices;
}

function initializePrinter(devicePath = null) {
  try {
    // Try USB interface if device path is provided
    if (devicePath) {
      printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: devicePath, // Direct USB device path
        characterSet: CharacterSet.PC852_LATIN2,
        removeSpecialCharacters: false,
        lineCharacter: '-',
        breakLine: BreakLine.WORD,
        options: {
          timeout: 5000,
        }
      });
      usbDevicePath = devicePath;
      return true;
    }
    
    // Fallback to TCP (for network printers)
    printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'tcp://localhost:9100',
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: '-',
      breakLine: BreakLine.WORD,
      options: {
        timeout: 3000,
      }
    });
    return true;
  } catch (error) {
    console.error('Error initializing printer:', error);
    return false;
  }
}

// Direct USB printing using Python escpos library (most reliable for USB)
async function printViaUSBIds(text, cut = true) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const path = require('path');
  
  if (!usbVendorId || !usbProductId) {
    return { success: false, error: 'USB vendor/product IDs not configured' };
  }
  
  try {
    // First, check if USB device is accessible
    try {
      const { stdout: lsusbOutput } = await execAsync('lsusb 2>/dev/null || echo ""');
      const deviceFound = lsusbOutput.includes(usbVendorId.replace('0x', '')) && 
                          lsusbOutput.includes(usbProductId.replace('0x', ''));
      
      if (!deviceFound) {
        console.warn(`USB device ${usbVendorId}:${usbProductId} not found in lsusb output`);
        console.warn('lsusb output:', lsusbOutput);
      }
    } catch (e) {
      console.warn('Could not run lsusb to verify device:', e.message);
    }
    
    const scriptPath = path.join(__dirname, 'print_usb.py');
    const input = JSON.stringify({
      vendor_id: usbVendorId,
      product_id: usbProductId,
      text: text,
      cut: cut
    });
    
    console.log(`Attempting to print via USB IDs: ${usbVendorId}:${usbProductId}`);
    
    // Use spawn for better security and handling of special characters
    const { spawn } = require('child_process');
    const pythonProcess = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Write input to stdin
    pythonProcess.stdin.write(input);
    pythonProcess.stdin.end();
    
    // Wait for process to complete
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0 && !stdout) {
          reject(new Error(stderr || `Process exited with code ${code}`));
        } else {
          resolve();
        }
      });
      pythonProcess.on('error', reject);
    });
    
    try {
      const result = JSON.parse(stdout.trim());
      if (!result.success) {
        console.error('Python script error:', result.error);
        // Provide more helpful error message
        if (result.error.includes('No such device') || result.error.includes('disconnected')) {
          result.error = `USB device not found. Make sure the printer is connected and the container has USB access. Error: ${result.error}`;
        }
      }
      return result;
    } catch (e) {
      // If output is not JSON, treat as error
      const errorMsg = stdout || stderr || 'Unknown error';
      console.error('Failed to parse Python output:', errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('USB ID print error:', error);
    let errorMessage = error.message || 'Failed to print via USB IDs';
    
    // Provide more helpful error messages
    if (errorMessage.includes('No such device') || errorMessage.includes('disconnected')) {
      errorMessage = `USB device not accessible. Ensure: 1) Printer is connected, 2) Container has USB access (privileged mode), 3) USB devices are mounted. Original error: ${errorMessage}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

// Alternative: Direct USB printing using system commands
// This works better for USB-connected printers on macOS/Linux
async function printViaUSB(text) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  try {
    // Create a temporary file to avoid shell escaping issues
    const tempFile = path.join(os.tmpdir(), `print_${Date.now()}.txt`);
    fs.writeFileSync(tempFile, text, 'utf8');

    try {
      // First, try to find Epson printer specifically
      const { stdout: allPrinters } = await execAsync('lpstat -a 2>/dev/null || echo ""');
      const printerLines = allPrinters.split('\n').filter(line => line.trim());
      
      let printerName = null;
      
      // Look for Epson or T900 in printer names
      for (const line of printerLines) {
        const match = line.match(/^(\S+)/);
        if (match) {
          const name = match[1].toLowerCase();
          if (name.includes('epson') || name.includes('t900') || name.includes('tm-t900')) {
            printerName = match[1];
            break;
          }
        }
      }
      
      // If no Epson found, try to get default printer
      if (!printerName) {
        try {
          const { stdout: defaultPrinter } = await execAsync('lpstat -d 2>/dev/null || echo ""');
          const defaultMatch = defaultPrinter.match(/system default destination: (\S+)/);
          if (defaultMatch) {
            printerName = defaultMatch[1];
          }
        } catch (e) {
          // Ignore error
        }
      }
      
      // If still no printer, try to get any available printer
      if (!printerName && printerLines.length > 0) {
        const firstMatch = printerLines[0].match(/^(\S+)/);
        if (firstMatch) {
          printerName = firstMatch[1];
        }
      }
      
      // Print using lp command
      if (printerName) {
        await execAsync(`lp -d "${printerName}" "${tempFile}"`);
        fs.unlinkSync(tempFile); // Clean up temp file
        return { success: true, message: `Printed to ${printerName}` };
      } else {
        // Last resort: try default printer without specifying name
        await execAsync(`lp "${tempFile}"`);
        fs.unlinkSync(tempFile);
        return { success: true, message: 'Printed to default printer' };
      }
    } catch (printError) {
      fs.unlinkSync(tempFile); // Clean up on error
      throw printError;
    }
  } catch (error) {
    console.error('USB print error:', error);
    return { success: false, error: error.message };
  }
}

// REST API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Get printer status
app.get('/api/printer/status', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get system printers
    const { stdout: systemPrinters } = await execAsync('lpstat -p -d 2>/dev/null || echo "No printers found"');
    const printers = systemPrinters.split('\n').filter(line => line.trim());
    
    // Scan for USB devices
    const usbDevices = await scanUSBDevices();
    
    res.json({
      success: true,
      systemPrinters: printers,
      usbDevices: usbDevices,
      currentUsbDevice: usbDevicePath,
      usbVendorId: usbVendorId,
      usbProductId: usbProductId,
      message: printers.length > 0 || usbDevices.length > 0 || (usbVendorId && usbProductId)
        ? 'Printers/devices found' 
        : 'No printers or USB devices detected. Make sure your Epson printer is connected via USB. You can also configure USB vendor/product IDs via /api/printer/set-usb-ids'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Scan for USB devices (legacy - device paths)
app.get('/api/printer/scan-usb', async (req, res) => {
  try {
    const devices = await scanUSBDevices();
    res.json({
      success: true,
      devices: devices,
      message: `Found ${devices.length} USB device(s)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Scan for USB devices using lsusb (shows vendor/product IDs and device names)
app.get('/api/printer/scan-usb-lsusb', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Run lsusb to get USB device information
    const { stdout } = await execAsync('lsusb 2>/dev/null || echo ""');
    
    const devices = [];
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    
    // Parse lsusb output format: Bus 001 Device 003: ID 04b8:0202 Seiko Epson Corp. TM-T88V
    for (const line of lines) {
      const match = line.match(/ID\s+([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\s+(.+)$/);
      if (match) {
        const vendorId = match[1];
        const productId = match[2];
        const deviceName = match[3].trim();
        
        devices.push({
          vendor_id: `0x${vendorId}`,
          product_id: `0x${productId}`,
          vendor_id_decimal: parseInt(vendorId, 16),
          product_id_decimal: parseInt(productId, 16),
          name: deviceName,
          display_name: deviceName,
          // Extract just the model name if available (e.g., "TM-T88V" from "Seiko Epson Corp. TM-T88V")
          model: deviceName.match(/\b(TM-[A-Z0-9]+)\b/i)?.[1] || deviceName
        });
      }
    }
    
    res.json({
      success: true,
      devices: devices,
      message: `Found ${devices.length} USB device(s)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Set USB device path
app.post('/api/printer/set-usb-device', async (req, res) => {
  try {
    const { devicePath } = req.body;
    
    if (!devicePath) {
      return res.status(400).json({
        success: false,
        error: 'Device path is required'
      });
    }
    
    const fs = require('fs');
    if (!fs.existsSync(devicePath)) {
      return res.status(400).json({
        success: false,
        error: `Device path does not exist: ${devicePath}`
      });
    }
    
    // Try to initialize printer with this device
    if (initializePrinter(devicePath)) {
      res.json({
        success: true,
        message: `USB device set to: ${devicePath}`,
        devicePath: devicePath
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to initialize printer with the specified device'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Set USB vendor/product IDs (for direct USB printing)
app.post('/api/printer/set-usb-ids', async (req, res) => {
  try {
    const { vendor_id, product_id } = req.body;
    
    if (!vendor_id || !product_id) {
      return res.status(400).json({
        success: false,
        error: 'Both vendor_id and product_id are required'
      });
    }
    
    // Convert to string format if needed
    usbVendorId = vendor_id.toString();
    usbProductId = product_id.toString();
    
    res.json({
      success: true,
      message: `USB IDs set: Vendor=${usbVendorId}, Product=${usbProductId}`,
      vendor_id: usbVendorId,
      product_id: usbProductId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get USB vendor/product IDs
app.get('/api/printer/usb-ids', (req, res) => {
  res.json({
    success: true,
    vendor_id: usbVendorId,
    product_id: usbProductId,
    configured: !!(usbVendorId && usbProductId)
  });
});

// Check USB device accessibility
app.get('/api/printer/check-usb-access', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const diagnostics = {
      lsusb_available: false,
      lsusb_output: '',
      usb_devices: [],
      configured_ids: {
        vendor_id: usbVendorId,
        product_id: usbProductId
      },
      device_found: false,
      usb_bus_accessible: false
    };
    
    // Check if lsusb is available
    try {
      const { stdout } = await execAsync('which lsusb 2>/dev/null || echo ""');
      if (stdout.trim()) {
        diagnostics.lsusb_available = true;
        
        // Run lsusb
        try {
          const { stdout: lsusbOutput } = await execAsync('lsusb 2>/dev/null || echo ""');
          diagnostics.lsusb_output = lsusbOutput;
          
          // Parse devices
          const lines = lsusbOutput.trim().split('\n').filter(line => line.trim());
          diagnostics.usb_devices = lines.map(line => {
            const match = line.match(/Bus\s+(\d+)\s+Device\s+(\d+):\s+ID\s+([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\s+(.+)$/);
            if (match) {
              return {
                bus: match[1],
                device: match[2],
                vendor_id: `0x${match[3]}`,
                product_id: `0x${match[4]}`,
                name: match[5].trim()
              };
            }
            return null;
          }).filter(d => d !== null);
          
          // Check if configured device is found
          if (usbVendorId && usbProductId) {
            const vendorHex = usbVendorId.replace('0x', '').toLowerCase();
            const productHex = usbProductId.replace('0x', '').toLowerCase();
            diagnostics.device_found = diagnostics.usb_devices.some(d => 
              d.vendor_id.replace('0x', '').toLowerCase() === vendorHex &&
              d.product_id.replace('0x', '').toLowerCase() === productHex
            );
          }
        } catch (e) {
          diagnostics.lsusb_error = e.message;
        }
      }
    } catch (e) {
      diagnostics.lsusb_error = e.message;
    }
    
    // Check if /dev/bus/usb is accessible
    const fs = require('fs');
    try {
      const usbBusExists = fs.existsSync('/dev/bus/usb');
      diagnostics.usb_bus_accessible = usbBusExists;
      
      if (usbBusExists) {
        try {
          const busDirs = fs.readdirSync('/dev/bus/usb');
          diagnostics.usb_bus_dirs = busDirs;
        } catch (e) {
          diagnostics.usb_bus_read_error = e.message;
        }
      }
    } catch (e) {
      diagnostics.usb_bus_error = e.message;
    }
    
    res.json({
      success: true,
      diagnostics: diagnostics,
      recommendations: getUSBRecommendations(diagnostics)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getUSBRecommendations(diagnostics) {
  const recommendations = [];
  
  if (!diagnostics.lsusb_available) {
    recommendations.push('lsusb command not available. Install usbutils package.');
  }
  
  if (!diagnostics.usb_bus_accessible) {
    recommendations.push('/dev/bus/usb is not accessible. Ensure privileged mode and USB device mounting in docker-compose.yml');
  }
  
  if (diagnostics.configured_ids.vendor_id && diagnostics.configured_ids.product_id) {
    if (!diagnostics.device_found) {
      recommendations.push(`Configured USB device (${diagnostics.configured_ids.vendor_id}:${diagnostics.configured_ids.product_id}) not found. Check: 1) Printer is connected, 2) Container has USB access, 3) Device IDs are correct`);
    }
  } else {
    recommendations.push('USB vendor/product IDs not configured. Use the web interface to set them.');
  }
  
  if (diagnostics.usb_devices.length === 0 && diagnostics.lsusb_available) {
    recommendations.push('No USB devices detected. Ensure printer is connected and container has USB access.');
  }
  
  return recommendations;
}

// Print text
app.post('/api/print', async (req, res) => {
  try {
    const { text, printerName } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text field is required'
      });
    }
    
    // Try USB vendor/product ID printing first (most reliable for USB)
    if (usbVendorId && usbProductId) {
      const result = await printViaUSBIds(text, true);
      if (result.success) {
        return res.json({
          success: true,
          message: result.message || 'Printed via USB IDs'
        });
      }
      // If USB ID printing fails, fall through to other methods
      console.error('USB ID print failed, trying alternatives:', result.error);
    }
    
    // Try direct USB printing with thermal printer library (if device is set)
    if (printer && usbDevicePath) {
      try {
        printer.clear();
        printer.alignLeft();
        printer.println(text);
        printer.cut();
        await printer.execute();
        
        res.json({
          success: true,
          message: `Printed via USB device: ${usbDevicePath}`
        });
        return;
      } catch (usbError) {
        console.error('Direct USB print error:', usbError);
        // Fall through to try system printer
      }
    }
    
    // Try system printer (lp command)
    const result = await printViaUSB(text);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Print job sent successfully'
      });
    } else {
      // Last resort: try thermal printer library with default settings
      if (!printer) {
        initializePrinter();
      }
      
      if (printer && !usbDevicePath) {
        try {
          printer.clear();
          printer.alignLeft();
          printer.println(text);
          printer.cut();
          await printer.execute();
          
          res.json({
            success: true,
            message: 'Print job sent successfully'
          });
        } catch (thermalError) {
          res.status(500).json({
            success: false,
            error: `Failed to print. System printer error: ${result.error}. Thermal printer error: ${thermalError.message}. Please add your printer to macOS System Preferences or set a USB device path.`
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: `Failed to print. ${result.error || 'No printer configured'}. Please add your printer to macOS System Preferences (System Settings > Printers & Scanners) or use the /api/printer/scan-usb endpoint to find and set a USB device.`
        });
      }
    }
  } catch (error) {
    console.error('Print error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Print with formatting (receipt-style)
app.post('/api/print/receipt', async (req, res) => {
  try {
    const { text, title, items } = req.body;
    
    // Build receipt text
    let receiptText = '';
    if (title) receiptText += `\n${title}\n${'='.repeat(32)}\n`;
    if (text) receiptText += `${text}\n`;
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        receiptText += `${item}\n`;
      });
    }
    receiptText += '\n';
    
    // Try USB IDs first (most reliable)
    if (usbVendorId && usbProductId) {
      const result = await printViaUSBIds(receiptText, true);
      if (result.success) {
        return res.json({
          success: true,
          message: 'Receipt printed successfully via USB'
        });
      }
    }
    
    if (!printer) {
      initializePrinter();
    }
    
    if (!printer) {
      // Fallback to simple USB printing
      const result = await printViaUSB(receiptText);
      return res.json({
        success: result.success,
        message: result.message || 'Receipt printed'
      });
    }
    
    // Use thermal printer library for formatted printing
    printer.clear();
    if (title) {
      printer.alignCenter();
      printer.setTextSize(1, 1);
      printer.println(title);
      printer.drawLine();
    }
    
    printer.alignLeft();
    printer.setTextNormal();
    if (text) {
      printer.println(text);
    }
    
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        printer.println(item);
      });
    }
    
    printer.drawLine();
    printer.cut();
    await printer.execute();
    
    res.json({
      success: true,
      message: 'Receipt printed successfully'
    });
  } catch (error) {
    console.error('Receipt print error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test print
app.post('/api/print/test', async (req, res) => {
  try {
    const testText = `
================================
    EPSON PRINTER TEST
================================

This is a test print from the
Epson TM-T900F printer handler.

Date: ${new Date().toLocaleString()}

If you can read this, the printer
is working correctly!

================================
`;
    
    // Try USB IDs first
    let result;
    if (usbVendorId && usbProductId) {
      result = await printViaUSBIds(testText, true);
    } else {
      result = await printViaUSB(testText);
    }
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test print sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send test print'
      });
    }
  } catch (error) {
    console.error('Test print error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`Web interface available at http://localhost:${PORT}`);
  
  // Try to initialize printer on startup
  initializePrinter();
});


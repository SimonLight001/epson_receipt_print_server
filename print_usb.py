#!/usr/bin/env python3
"""
USB Printer script using python-escpos
Accepts text via stdin or command line arguments
"""
import sys
import json
from escpos.printer import Usb

def print_text(vendor_id, product_id, text, cut=True, interface=0):
    """
    Print text to USB printer using vendor/product IDs
    
    Args:
        vendor_id: USB vendor ID (hex, e.g., 0x04b8)
        product_id: USB product ID (hex, e.g., 0x0202)
        text: Text to print
        cut: Whether to cut paper after printing
        interface: USB interface number (default 0)
    """
    try:
        # Convert hex strings to integers if needed
        if isinstance(vendor_id, str):
            vendor_id = int(vendor_id, 16) if vendor_id.startswith('0x') else int(vendor_id)
        if isinstance(product_id, str):
            product_id = int(product_id, 16) if product_id.startswith('0x') else int(product_id)
        
        # Initialize printer - try with interface parameter
        # Usb(vid, pid, interface, in_ep, out_ep)
        try:
            p = Usb(vendor_id, product_id, interface)
        except Exception as e1:
            # If that fails, try without interface (some printers don't need it)
            try:
                p = Usb(vendor_id, product_id)
            except Exception as e2:
                # Try with explicit endpoints (common for Epson printers)
                # Most Epson printers use interface 0, in_ep=0x82, out_ep=0x01
                try:
                    p = Usb(vendor_id, product_id, interface, 0x82, 0x01)
                except Exception as e3:
                    raise Exception(f"Failed to initialize printer. Tried: with interface ({e1}), without interface ({e2}), with endpoints ({e3})")
        
        # Print text
        p.text(text)
        
        # Cut paper if requested
        if cut:
            p.cut()
        
        return {"success": True, "message": "Print successful"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    # Read input from stdin (JSON format)
    try:
        input_data = json.loads(sys.stdin.read())
        vendor_id = input_data.get('vendor_id')
        product_id = input_data.get('product_id')
        text = input_data.get('text', '')
        cut = input_data.get('cut', True)
        interface = input_data.get('interface', 0)
        
        if not vendor_id or not product_id:
            result = {"success": False, "error": "vendor_id and product_id are required"}
        else:
            result = print_text(vendor_id, product_id, text, cut, interface)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except json.JSONDecodeError:
        # Fallback: try command line arguments
        if len(sys.argv) >= 4:
            vendor_id = sys.argv[1]
            product_id = sys.argv[2]
            text = sys.argv[3]
            cut = sys.argv[4].lower() == 'true' if len(sys.argv) > 4 else True
            result = print_text(vendor_id, product_id, text, cut)
            print(json.dumps(result))
        else:
            print(json.dumps({"success": False, "error": "Invalid input format"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()


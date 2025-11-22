# Use Node.js LTS version on Debian-based image for better USB/printing support
FROM node:18-slim

# Install CUPS and printing utilities, plus USB tools, Python and pip
RUN apt-get update && apt-get install -y \
    cups \
    cups-client \
    cups-bsd \
    printer-driver-all \
    usbutils \
    udev \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Python dependencies for USB printing
# Using --break-system-packages is safe in Docker containers
RUN pip3 install --break-system-packages python-escpos pyusb

# Copy application files
COPY server.js ./
COPY public/ ./public/
COPY print_usb.py ./

# Make Python script executable
RUN chmod +x print_usb.py

# Expose the port
EXPOSE 3100

# Set environment variable for port
ENV PORT=3100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server.js"]


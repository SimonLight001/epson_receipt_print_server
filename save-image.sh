#!/bin/bash
# Script to save the Docker image for distribution

IMAGE_NAME="epson-printer-handler"
IMAGE_TAG="latest"
OUTPUT_FILE="epson-printer-handler.tar.gz"

echo "Saving Docker image ${IMAGE_NAME}:${IMAGE_TAG}..."
docker save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > ${OUTPUT_FILE}

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h ${OUTPUT_FILE} | cut -f1)
    echo "✅ Image saved successfully to ${OUTPUT_FILE} (${FILE_SIZE})"
    echo ""
    echo "To load this image on another machine:"
    echo "  docker load < ${OUTPUT_FILE}"
    echo ""
    echo "Or in Portainer:"
    echo "  1. Go to Images"
    echo "  2. Click 'Import image from file'"
    echo "  3. Upload ${OUTPUT_FILE}"
else
    echo "❌ Failed to save image"
    exit 1
fi


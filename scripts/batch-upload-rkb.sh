#!/bin/bash
#
# Batch upload files to RKB with predefined metadata
#
# Usage:
#   1. Place your files in: /Users/BD/PulseEngine/uploads/rkb-batch/
#   2. Run: bash scripts/batch-upload-rkb.sh
#
# Default metadata for trend reports:
#   - Type: Industry Data
#   - Source: Selected Reports
#   - Confidentiality: Public
#   - Quality: Good
#   - Notes: Published industry data
#
# Features:
#   - Uploads files sequentially with database verification
#   - Checks for duplicates before uploading
#   - Adds delay between uploads to prevent database overload

set -e

# Configuration
INGESTION_URL="https://ingestion-production-c716.up.railway.app"
API_URL="https://api-production-768d.up.railway.app"
OWNER_ID="087d78e9-4bbe-49f6-8981-1588ce4934a2"
UPLOAD_DIR="$(dirname "$0")/../uploads/rkb-batch"
ARCHIVE_DIR="$(dirname "$0")/../uploads/rkb-batch-processed"
DELAY_SECONDS=2  # Delay between uploads to avoid overwhelming database

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
uploaded=0
failed=0
skipped=0

# Helper function to check if file already exists in database
check_duplicate() {
    local filename="$1"
    curl -s "$API_URL/admin/assets" 2>/dev/null | python3 -c "
import sys, json
filename = '$filename'
try:
    data = json.load(sys.stdin)
    assets = data.get('assets', [])
    exists = any(a['name'] == filename for a in assets)
    sys.exit(0 if exists else 1)
except:
    sys.exit(1)
"
    return $?
}

# Helper function to verify file is in database
verify_in_database() {
    local asset_id="$1"
    local max_retries=3
    local retry=0

    while [ $retry -lt $max_retries ]; do
        result=$(curl -s "$API_URL/admin/assets" 2>/dev/null | python3 -c "
import sys, json
asset_id = '$asset_id'
try:
    data = json.load(sys.stdin)
    assets = data.get('assets', [])
    found = any(a['id'] == asset_id for a in assets)
    print('true' if found else 'false')
except:
    print('false')
" 2>/dev/null)

        if [ "$result" = "true" ]; then
            return 0
        fi

        retry=$((retry + 1))
        sleep 1
    done

    return 1
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RKB Batch Upload Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Upload directory: $UPLOAD_DIR"
echo ""
echo "Default metadata:"
echo "  Type: Industry Data"
echo "  Source: Selected Reports"
echo "  Confidentiality: Public"
echo "  Quality: Good"
echo "  Notes: Published industry data"
echo ""

# Create directories if they don't exist
mkdir -p "$UPLOAD_DIR"
mkdir -p "$ARCHIVE_DIR"

# Count files (excluding hidden files and README)
file_count=$(find "$UPLOAD_DIR" -maxdepth 1 -type f ! -name ".*" ! -name "README.md" | wc -l | tr -d ' ')

if [ "$file_count" -eq 0 ]; then
    echo -e "${YELLOW}⚠ No files found in $UPLOAD_DIR${NC}"
    echo ""
    echo "Place your trend report files in this directory and run again."
    exit 0
fi

echo "Found $file_count file(s) to upload"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Process each file sequentially
find "$UPLOAD_DIR" -maxdepth 1 -type f ! -name ".*" ! -name "README.md" | while read -r filepath; do
    filename=$(basename "$filepath")

    # Check if file already exists in database
    if check_duplicate "$filename"; then
        echo -e "${YELLOW}⊘ Skipped${NC}: $filename (already exists in database)"

        # Move to archive to prevent re-processing
        timestamp=$(date +"%Y-%m-%dT%H-%M-%S")
        archive_path="$ARCHIVE_DIR/${timestamp}_${filename}"
        mv "$filepath" "$archive_path"

        skipped=$((skipped + 1))
        continue
    fi

    echo "Uploading: $filename"

    # Upload file
    response=$(curl -s -w "\n%{http_code}" -X POST "$INGESTION_URL/ingest/upload" \
        -F "files=@$filepath" \
        -F "ownerId=$OWNER_ID" \
        2>/dev/null)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 201 ]; then
        # Extract asset ID from response
        asset_id=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['id'] if data and len(data) > 0 else '')" 2>/dev/null || echo "")

        if [ -z "$asset_id" ]; then
            echo -e "${RED}✗ Failed to extract asset ID${NC}"
            failed=$((failed + 1))
            continue
        fi

        # Verify file is in database before archiving
        if verify_in_database "$asset_id"; then
            echo -e "${GREEN}✓ Uploaded and verified${NC} (ID: $asset_id)"
            echo "  Metadata: Industry Data | Good"

            # Archive the file with timestamp
            timestamp=$(date +"%Y-%m-%dT%H-%M-%S")
            archive_path="$ARCHIVE_DIR/${timestamp}_${filename}"
            mv "$filepath" "$archive_path"
            echo "  Archived to: uploads/rkb-batch-processed/$(basename "$archive_path")"

            uploaded=$((uploaded + 1))
        else
            echo -e "${YELLOW}⚠ Upload succeeded but not found in database${NC}"
            echo "  Asset ID: $asset_id"
            echo "  File kept in upload directory for retry"
            failed=$((failed + 1))
        fi

        echo ""

        # Add delay between uploads to avoid overwhelming database
        sleep $DELAY_SECONDS

    else
        echo -e "${RED}✗ Upload failed${NC} (HTTP $http_code)"
        echo "  Response: $body"
        echo ""
        failed=$((failed + 1))
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Batch upload complete!"
echo "  Uploaded & Verified: $uploaded"
echo "  Skipped (duplicates): $skipped"
echo "  Failed: $failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $failed -gt 0 ]; then
    echo -e "${YELLOW}Note: Failed files remain in upload directory for retry${NC}"
    echo ""
fi

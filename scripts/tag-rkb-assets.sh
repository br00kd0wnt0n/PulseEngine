#!/bin/bash
#
# Tag all RKB assets with specified tags
#
# Usage: bash scripts/tag-rkb-assets.sh trends 2024
#

set -e

API_URL="https://api-production-768d.up.railway.app"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <tag1> [tag2] [tag3] ..."
    echo "Example: $0 trends 2024"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RKB Asset Tagging Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get all assets
echo "Fetching assets..."
response=$(curl -s "${API_URL}/admin/assets?limit=1000")
assets=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data.get('assets', [])))")
total=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', 0))")

echo "Found $total assets"
echo ""

# Iterate through each tag argument
for tag in "$@"; do
    echo "Adding tag: '$tag'"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    updated=0
    skipped=0

    # Process each asset
    echo "$assets" | python3 << EOF
import json, sys, urllib.request, urllib.parse

assets = json.loads(sys.stdin.read())
tag = '$tag'
api_url = '$API_URL'

for asset in assets:
    asset_id = asset['id']
    current_tags = asset.get('tags', {})

    # Check if tag already exists
    if tag in current_tags.values():
        print(f"⊘ Skipped: {asset['name']} (already has '{tag}')")
        continue

    # Add tag to existing tags
    updated_tags = {**current_tags, f"tag_{len(current_tags)}": tag}

    # Update asset via API
    try:
        data = json.dumps({'tags': updated_tags}).encode('utf-8')
        req = urllib.request.Request(
            f"{api_url}/assets/{asset_id}",
            data=data,
            headers={'Content-Type': 'application/json'},
            method='PATCH'
        )
        with urllib.request.urlopen(req) as response:
            if response.status in [200, 204]:
                print(f"✓ Tagged: {asset['name']}")
            else:
                print(f"✗ Failed: {asset['name']} (HTTP {response.status})")
    except Exception as e:
        print(f"✗ Error: {asset['name']} - {e}")
EOF

    echo ""
    echo "Completed tagging with '$tag'"
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "All tags applied!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

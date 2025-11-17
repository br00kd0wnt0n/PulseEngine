# RKB Batch Upload Directory

Place your trend report files here for batch upload to the Ralph Knowledge Base.

## Quick Start

1. **Copy your files here:**
   ```
   /Users/BD/PulseEngine/uploads/rkb-batch/
   ```

2. **Run the batch upload script:**
   ```bash
   cd /Users/BD/PulseEngine
   bash scripts/batch-upload-rkb.sh
   ```

3. **Check results:**
   - Uploaded files will be moved to `uploads/rkb-batch-processed/` with timestamps
   - View uploaded assets in the admin dashboard or via API: `GET /admin/assets`

## Default Metadata

All files uploaded via this batch script will have the following metadata:

- **Type:** Industry Data
- **Source:** Selected Reports
- **Confidentiality:** Public
- **Quality:** Good
- **Notes:** Published industry data
- **Title:** Filename (without extension)

## Supported File Types

- PDF documents (.pdf)
- Word documents (.doc, .docx)
- Text files (.txt, .md)
- Images (.jpg, .png, etc.)

## What Happens

1. Script reads all files from this directory
2. Uploads each file to the ingestion service (`https://ingestion-production-c716.up.railway.app/ingest/upload`)
3. Files are processed:
   - Text extraction
   - AI analysis & insights
   - Embedding generation
   - Encrypted storage to R2/S3
4. Metadata saved to PostgreSQL database
5. Successfully uploaded files moved to `rkb-batch-processed/` directory

## Troubleshooting

**No files found?**
- Make sure files are directly in this directory (not in subdirectories)
- Check that files don't start with `.` (hidden files)

**Upload failed?**
- Check network connection
- Verify ingestion service is running: `curl https://ingestion-production-c716.up.railway.app/health`
- Check file size (very large files may timeout)

**Want to customize metadata?**
- Edit `/Users/BD/PulseEngine/scripts/batch-upload-rkb.sh`
- Modify the metadata values in the script header comments

## Example

```bash
# Copy your trend reports
cp ~/Downloads/TikTok_Trends_2024.pdf /Users/BD/PulseEngine/uploads/rkb-batch/
cp ~/Downloads/Instagram_Report_Q1_2025.pdf /Users/BD/PulseEngine/uploads/rkb-batch/
cp ~/Downloads/Social_Media_Trends_2024.pdf /Users/BD/PulseEngine/uploads/rkb-batch/

# Run batch upload
cd /Users/BD/PulseEngine
bash scripts/batch-upload-rkb.sh

# Output:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   RKB Batch Upload Tool
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Upload directory: /Users/BD/PulseEngine/uploads/rkb-batch
#
# Default metadata:
#   Type: Industry Data
#   Source: Selected Reports
#   Confidentiality: Public
#   Quality: Good
#   Notes: Published industry data
#
# Found 3 file(s) to upload
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Uploading: TikTok_Trends_2024.pdf
# ✓ Uploaded successfully (ID: abc-123-def)
#   Metadata: Industry Data | Good
#   Archived to: ../uploads/rkb-batch-processed/2025-01-14_TikTok_Trends_2024.pdf
# ...
```

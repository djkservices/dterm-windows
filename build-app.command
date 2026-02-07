#!/bin/bash

# dTerm Windows Build Script
# Builds Windows via GitHub Actions, uploads update files to server

cd "$(dirname "$0")"
set -e

CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "================================"
echo "  dTerm Windows Build & Deploy"
echo "================================"
echo ""
echo "Current version: $CURRENT_VERSION"
echo ""
read -p "Version to build [$CURRENT_VERSION]: " INPUT_VERSION
VERSION="${INPUT_VERSION:-$CURRENT_VERSION}"

# Update package.json if version changed
if [ "$VERSION" != "$CURRENT_VERSION" ]; then
    node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
    echo "Updated package.json to v$VERSION"
fi
echo ""

# --- Step 1: Backup source files ---
echo "[1/5] Backing up source files..."
BACKUP_NAME="dterm-win-backup-v${VERSION}-$(date +%Y%m%d-%H%M%S).tar.gz"
tar czf "/tmp/$BACKUP_NAME" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='releases' \
    --exclude='.git' \
    --exclude='.DS_Store' \
    -C "$(dirname "$(pwd)")" "$(basename "$(pwd)")"

lftp -u tools,4C98c622 173.231.228.93 -e "
    set ssl:verify-certificate no;
    mkdir -pf backups/dterm-windows;
    put /tmp/$BACKUP_NAME -o backups/dterm-windows/$BACKUP_NAME;
    quit
"

if [ $? -eq 0 ]; then
    echo "  Backup uploaded: $BACKUP_NAME"
    rm -f "/tmp/$BACKUP_NAME"
else
    echo "  Backup upload failed. Local copy at /tmp/$BACKUP_NAME"
fi
echo ""

# --- Step 2: Commit and push to GitHub ---
echo "[2/5] Pushing to GitHub..."
if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add .
    git commit -m "Build v$VERSION"
fi

# Handle existing tag
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    git tag -d "v$VERSION"
    git push origin --delete "v$VERSION" 2>/dev/null || true
fi

git tag "v$VERSION"
git push origin main --tags
echo ""

# --- Step 3: Wait for GitHub Actions to start ---
echo "[3/5] Waiting for GitHub Actions to pick up build..."
REPO="djkservices/dterm-windows"
RUN_ID=""
ATTEMPTS=0
MAX_ATTEMPTS=30  # 30 x 10s = 5 minutes max wait for run to appear

while [ -z "$RUN_ID" ] && [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    sleep 10
    ATTEMPTS=$((ATTEMPTS + 1))
    RUN_ID=$(gh run list --repo "$REPO" --limit 1 --json databaseId,status,headBranch --jq '.[0] | select(.status != "completed") | .databaseId' 2>/dev/null)
done

if [ -z "$RUN_ID" ]; then
    # Maybe it completed super fast, grab the latest
    RUN_ID=$(gh run list --repo "$REPO" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
fi

if [ -z "$RUN_ID" ]; then
    echo "  Could not find GitHub Actions run."
    echo "  Check manually: https://github.com/$REPO/actions"
    echo ""
    echo "Press any key to close..."
    read -n 1
    exit 1
fi

echo "  Build started (run #$RUN_ID)"
echo ""

# --- Step 4: Monitor build progress ---
echo "[4/5] Building Windows app on GitHub Actions..."
echo ""

PREV_STATUS=""
while true; do
    RUN_JSON=$(gh run view "$RUN_ID" --repo "$REPO" --json status,conclusion,jobs 2>/dev/null)
    STATUS=$(echo "$RUN_JSON" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).status" 2>/dev/null)
    CONCLUSION=$(echo "$RUN_JSON" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).conclusion" 2>/dev/null)

    # Get current step name from the active job
    CURRENT_STEP=$(echo "$RUN_JSON" | node -p "
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const job = (d.jobs || []).find(j => j.status === 'in_progress') || (d.jobs || []).find(j => j.status === 'completed');
        if (!job) process.exit(0);
        const step = (job.steps || []).find(s => s.status === 'in_progress');
        if (step) console.log(step.name);
        else { const last = [...(job.steps || [])].reverse().find(s => s.status === 'completed'); if (last) console.log(last.name); }
        " 2>/dev/null || true)

    if [ "$CURRENT_STEP" != "$PREV_STATUS" ] && [ -n "$CURRENT_STEP" ]; then
        echo "  → $CURRENT_STEP"
        PREV_STATUS="$CURRENT_STEP"
    fi

    if [ "$STATUS" = "completed" ]; then
        break
    fi

    sleep 15
done

echo ""

if [ "$CONCLUSION" = "success" ]; then
    echo "[5/5] Build complete!"
    echo ""
    echo "================================"
    echo "  v$VERSION Windows Deploy Complete!"
    echo "================================"
    echo ""
    echo "  Windows installer: LIVE on mynetworktools.com"
    echo "  GitHub release: https://github.com/$REPO/releases/tag/v$VERSION"
    echo ""
else
    echo "[5/5] Build FAILED!"
    echo ""
    echo "================================"
    echo "  v$VERSION Build Failed"
    echo "================================"
    echo ""
    echo "  Conclusion: $CONCLUSION"
    echo "  Check logs: https://github.com/$REPO/actions/runs/$RUN_ID"
    echo ""
fi

echo "Press any key to close..."
read -n 1

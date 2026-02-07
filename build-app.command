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
echo "[1/3] Backing up source files..."
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
echo "[2/3] Pushing to GitHub..."
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

# --- Step 3: Done ---
echo "[3/3] Windows build triggered via GitHub Actions"
echo ""
echo "================================"
echo "  v$VERSION Deploy Started!"
echo "================================"
echo ""
echo "  GitHub Actions will:"
echo "    1. Build the Windows installer (.exe + .zip)"
echo "    2. Upload update files to mynetworktools.com/dterm/api/updates/win/"
echo "    3. Create a GitHub release"
echo ""
echo "  Monitor at:"
echo "    https://github.com/djkservices/dterm-windows/actions"
echo ""
echo "Press any key to close..."
read -n 1

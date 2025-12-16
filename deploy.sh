#!/bin/bash

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build backend
echo "Building backend..."
cd backend
npm install
npm run build
cd ..

# Copy frontend build to backend dist
echo "Copying frontend files..."
mkdir -p backend/dist/frontend
cp -r frontend/dist/* backend/dist/frontend/

echo "Deployment files ready!"
echo "Upload the following to Azure Web App:"
echo "- backend/dist/ folder"
echo "- web.config"
echo "- backend/package.json"
echo "- backend/node_modules/ (or run npm install on Azure)"

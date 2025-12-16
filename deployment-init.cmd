@echo off
echo Building frontend...
cd frontend
call npm install
call npm run build
cd ..

echo Building backend...
cd backend
call npm install
call npm run build
cd ..

echo Deployment files ready for Azure Web App!
echo Upload these files to Azure:
echo - backend/dist/
echo - web.config
echo - backend/package.json
echo - backend/node_modules/ (or install on Azure)

pause

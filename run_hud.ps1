# Startup script for JARVIS HUD

Write-Host "Starting JARVIS Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\python.exe api/server.py"

Write-Host "Initializing Frontend..." -ForegroundColor Cyan
Set-Location ui
npm install
# Start Vite dev server in the background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
# Run Electron in the foreground
npm run electron

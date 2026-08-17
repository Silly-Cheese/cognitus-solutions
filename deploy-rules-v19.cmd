@echo off
setlocal
node scripts\build-firestore-v19.mjs
if errorlevel 1 exit /b 1
npx --yes firebase-tools@latest deploy --only firestore:rules --config firebase.v19.json

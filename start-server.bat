#!/bin/bash
# SafeRide Guardian - Start Script for Windows

@echo off
cls
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                                                               ║
echo ║        SafeRide Guardian - Start Development Server           ║
echo ║                                                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Check if Node is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found

REM Kill any existing processes
echo Cleaning up existing processes...
taskkill /F /IM node.exe /T 2>nul

REM Start Backend
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║ Starting Backend Server on Port 5000                          ║
echo ╚═══════════════════════════════════════════════════════════════╝
cd /d "%~dp0server"
echo Current directory: %cd%
echo Installing dependencies...
call npm install --legacy-peer-deps >nul 2>&1
echo Starting server...
echo.
echo To start the Frontend:
echo  1. Open a NEW Command Prompt
echo  2. Navigate to: %~dp0client
echo  3. Run: npm start
echo.
npm start

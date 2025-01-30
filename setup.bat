@echo off
echo Setting up your development environment...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed. Please install Python 3.8 or higher
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed. Please install Node.js 14.0 or higher
    exit /b 1
)

REM Create and activate virtual environment
echo Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate

REM Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Check if .env file exists
if not exist .env (
    echo Creating .env file...
    echo ANTHROPIC_API_KEY=your-api-key-here > .env
    echo Please update the .env file with your actual API key
)

REM Install frontend dependencies
echo Installing frontend dependencies...
cd frontend
call npm install

REM Start both servers
echo Starting servers...
start cmd /c "cd backend && set FLASK_APP=app.py && set FLASK_ENV=development && flask run"
start cmd /c "cd frontend && npm start"

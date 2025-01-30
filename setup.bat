:: filepath: /Users/vatsalsodha/pdfExtract/BankBuddy/setup.bat
@echo off

:: Create and activate conda environment
conda create --name bankbuddy python=3.8 -y
conda activate bankbuddy

:: Install Python dependencies
pip install -r requirements.txt

:: Navigate to the frontend directory and install Node.js dependencies
cd bankbuddyui
npm install

:: Navigate back to the root directory
cd ..

:: Export the Anthropic API key
set ANTHROPIC_API_KEY=your-api-key-here

:: Start the Flask server and React application
start cmd /k "conda activate bankbuddy && set FLASK_APP=app.py && set FLASK_ENV=development && flask run"
start cmd /k "cd bankbuddyui && npm start"
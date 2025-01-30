#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up your development environment...${NC}"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python3 is not installed. Please install Python 3.8 or higher"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 14.0 or higher"
    exit 1
fi

# Create and activate virtual environment
echo -e "${GREEN}Creating Python virtual environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo -e "${GREEN}Installing Python dependencies...${NC}"
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
    echo "Please update the .env file with your actual API key"
fi

# Install frontend dependencies
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd frontend
npm install

# Start both servers
echo -e "${GREEN}Starting servers...${NC}"
# Start Flask server in background
cd ../backend
export FLASK_APP=app.py
export FLASK_ENV=development
flask run &

# Start React application
cd ../frontend
npm start

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

# Create and activate conda environment
echo -e "${GREEN}Creating conda environment...${NC}"
conda create --name bankbuddy python=3.8 -y
conda activate bankbuddy

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
cd bankbuddyui
npm install

# Export the Anthropic API key
export ANTHROPIC_API_KEY='your-api-key-here'

# Start both servers
echo -e "${GREEN}Starting servers...${NC}"
# Start Flask server in background
gnome-terminal -- bash -c "conda activate bankbuddy && export FLASK_APP=app.py && export FLASK_ENV=development && flask run"
# Start React application
gnome-terminal -- bash -c "cd frontend && npm start"

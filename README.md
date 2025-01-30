# BankBuddy

BankBuddy is a privacy-focused personal finance analyzer that processes your bank statements locally, helping you track spending without connecting to any external services.

## Key Features

### 🔒 Privacy & Security
- Local SQL database storage only - your data never leaves your system
- No bank account linking or third-party integrations
- Automatic masking of sensitive information
- Daily automatic database backups for data safety

### 📊 Financial Management
- Upload and analyze statements from multiple bank accounts
- Automatic transaction categorization
- Track account balances in one place
- Generate detailed financial summaries
- View spending patterns and transactions by category

### 💰 How It Works
1. Upload your bank statements
2. BankBuddy extracts and masks sensitive data
3. View all your transactions and balances in one dashboard
4. Analyze spending across categories

## Prerequisites

- Anaconda or Miniconda
- Node.js 14.0 or higher
- npm (usually comes with Node.js)
- Git (for cloning the repository)

## Quick Start

1. Clone this repository:
```bash
git clone https://github.com/vatsal-sodha/BankBuddy
cd BankBuddy
```

2. Create a `.env` file in the root directory and add your Anthropic API key:
```bash
ANTHROPIC_API_KEY=your-api-key-here
```

3. Run the setup script:
```bash
# On Unix-based systems (Linux/MacOS):
chmod +x setup.sh
./setup.sh

# On Windows:
setup.bat
```

The setup script will automatically:
- Create a conda environment
- Install Python dependencies
- Install Node.js dependencies
- Start both the Flask server and React application

## Manual Setup (if the setup script doesn't work)

### Backend Setup

1. Create and activate a conda environment:
```bash
conda create --name bankbuddy python=3.8
conda activate bankbuddy
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Start the Flask server:
```bash
# Unix (Linux/MacOS)
export FLASK_APP=app.py
export FLASK_ENV=development
flask run

# Windows
set FLASK_APP=app.py
set FLASK_ENV=development
flask run
```

### Frontend Setup

1. Navigate to the React application directory:
```bash
cd bankbuddyui
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the React development server:
```bash
npm start
```

## Support

For issues or questions, please [create an issue](https://github.com/vatsal-sodha/BankBuddy/issues) in the repository.
# BankBuddy

BankBuddy is a financial management application designed to help users manage their bank accounts, transactions, and financial summaries. The application provides features for uploading bank statements, categorizing transactions, and generating financial reports.

## Features

- **Account Management**: Add, edit, and delete bank accounts.
- **Transaction Management**: Add, edit, and delete transactions. Upload bank statements in PDF format and extract transactions using AI.
- **Financial Summary**: Generate financial summaries and view transactions by categories.
- **Backup**: Automatic daily backup of the database.

## Prerequisites

- Python 3.8 or higher
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
# On Windows:
setup.bat

# On Unix-based systems (Linux/MacOS):
chmod +x setup.sh
./setup.sh
```

The setup script will automatically:
- Create a Python virtual environment
- Install Python dependencies
- Install Node.js dependencies
- Start both the Flask server and React application

## Manual Setup (if the setup script doesn't work)

### Backend Setup

1. Create and activate a Python virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Unix (Linux/MacOS)
python3 -m venv venv
source venv/bin/activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Start the Flask server:
```bash
# Windows
set FLASK_APP=app.py
set FLASK_ENV=development
flask run

# Unix (Linux/MacOS)
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```
### Frontend Setup

1. Navigate to the React application directory:
```bash
cd frontend
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
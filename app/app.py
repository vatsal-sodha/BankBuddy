from datetime import datetime
from anthropic import Anthropic
from flask import Flask, json, request, jsonify
from flask_cors import CORS
import os
import pdfplumber
from app.app_utils import *
from app.privacy_filter import PrivacyFilter
from dotenv import load_dotenv
from models.account import Account
from models.transaction import Transaction
from models.balance import Balance
from models import db
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

load_dotenv()
app = Flask(__name__)
app.debug = True
CORS(app)
DATABASE_NAME='bankBuddy.db'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + DATABASE_NAME
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def extract_transactions_from_pdf(pdf_path, api_key):
    """
    Extract credit card transactions from a PDF statement using Claude AI.
    
    Args:
        pdf_path (str): Path to the PDF file
        api_key (str): Anthropic API key
    
    Returns:
        list: List of transaction dictionaries
    """
    # Initialize Anthropic client
    client = Anthropic(api_key=api_key)
    privacy_filter = PrivacyFilter()
    
    # Extract text from PDF
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join(page.extract_text() for page in pdf.pages)
            text = privacy_filter.hash_sensitive_data(text)
    except Exception as e:
        raise Exception(f"Error reading PDF: {str(e)}")
    
    # Prepare prompt for Claude
    prompt = f"""RESPOND WITH VALID JSON ONLY - NO OTHER TEXT

    Extract transactions from this credit card statement as JSON:

    {{
        "statement_date": "YYYY-MM-DD or null",
        "account_balance": "numeric value or null",
        "transactions": [
            {{
                "transaction_date": "YYYY-MM-DD", 
                "description": "string",
                "amount": -123.45,  
                "category": "string from allowed list"
            }}
        ]
    }}

    IMPORTANT: 
    - amount must be a NUMBER (not string)
    - Use negative numbers for debits/charges
    - Use positive numbers for credits/payments
    - Do not include currency symbols or commas

    Allowed categories: paycheck, other income, transfer, credit card payment, home, utilities, rent, auto, gas, parking, travel, restaurant, groceries, medical, amazon, walmart, shopping, subscriptions, donations, insurance, investments, other expenses

    Statement text:
    {text}"""
    # Get response from Claude
    try:
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            system="You are a JSON API. You only respond with valid JSON objects. Never include explanatory text, markdown formatting, or anything other than pure JSON.",
            messages=[{"role": "user", "content": prompt}]
        )
        response = message.content[0].text
        
        # Parse JSON response
        data = json.loads(response)
        
        # Basic validation
        if not isinstance(data['transactions'], list):
            raise ValueError("Response is not a JSON array")
                    
        return data
        
    except Exception as e:
        raise Exception(f"Error processing with Claude: {str(e)}")

def process_pdf_upload(account_id, file):
    if not file or file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    if not file.filename.endswith('.pdf'):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    API_KEY = os.getenv('ANTHROPIC_API_KEY')
    if not API_KEY:
        return jsonify({"error": "No Anthropic Key Found"}), 500

    data = extract_transactions_from_pdf(file_path, API_KEY)
    if not isinstance(data, dict) or 'transactions' not in data or 'account_balance' not in data or 'statement_date' not in data:
        os.remove(file_path)
        return jsonify({'error': 'Invalid data format from PDF extraction'}), 500

    transaction_ids = add_trasactions_to_db(data['transactions'], account_id)
    # balance = convert_to_float(data['account_balance'])
    balance = data['account_balance'] if data['account_balance'] is not None else 0.0
    _ = Balance.add_balance(account_id, balance, data['statement_date'])
    Account.update_last_statement_date(account_id)

    os.remove(file_path)
    return jsonify({"message": f"Added {len(transaction_ids)} transactions to database"}), 200

 
# Directory to temporarily store uploaded files
UPLOAD_FOLDER = './uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/api/get-transactions', methods=['GET'])
def get_transactions():
    try:
        from_date_str = request.args.get('fromDate')
        to_date_str = request.args.get('toDate')

        from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
        to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()

        if from_date > to_date:
            return jsonify({"error": "fromDate cannot be after toDate."}), 400
        
        transactions = Transaction.get_transactions_in_date_range(from_date, to_date)
        result = []
        for transaction in transactions:
            account = transaction.account  # Access the account using the relationship
            result.append({
                "transaction_id": transaction.transaction_id,
                "transaction_date": transaction.transaction_date.strftime('%Y-%m-%d'),
                "description": transaction.description,
                "category": transaction.category,
                "amount": transaction.amount,
                "comment": transaction.comment,
                "account_name": account.name,
                "account_institution": account.institution,
                "last_4_digits": account.last_4_digits,
                "account_type": account.type,
                "account_id": account.account_id
            })

        # Return the result as JSON
        return jsonify({"transactions": result})
    except ValueError as ve:
        # Handle invalid date format
        return jsonify({"error": f"Invalid date format. {ve}"}), 400

    except Exception as e:
        # Handle unexpected errors
        return jsonify({"error": "An error occurred.", "details": str(e)}), 500

@app.route('/api/transactions-by-categories', methods=['GET'])
def get_transactions_by_categories():
    try:
        from_date_str = request.args.get('fromDate')
        to_date_str = request.args.get('toDate')

        from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
        to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()

        if from_date > to_date:
            return jsonify({"error": "fromDate cannot be after toDate."}), 400
        
         # Get all transactions in date range
        transactions = Transaction.get_transactions_in_date_range(from_date, to_date)

        transaction_categories = {}

        for transaction in transactions:
            if transaction.category == 'credit card payment' and transaction.account.type != 'checking/savings':
                continue
            amount = transaction.amount
            if transaction.account.type == 'credit/debit':
                amount = -amount
            if transaction.category not in transaction_categories:
                transaction_categories[transaction.category] = amount
            else:

                transaction_categories[transaction.category] += amount
        
        return jsonify({"transactions": transaction_categories})

    except ValueError as ve:
        return jsonify({"error": f"Invalid date format. {ve}"}), 400
    except Exception as e:
        return jsonify({"error": "An error occurred.", "details": str(e)}), 500 

@app.route('/api/financial-summary', methods=['GET'])
def get_financial_summary():
    try:
        from_date_str = request.args.get('fromDate')
        to_date_str = request.args.get('toDate')

        from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
        to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()

        if from_date > to_date:
            return jsonify({"error": "fromDate cannot be after toDate."}), 400

        # Get all transactions in date range
        transactions = Transaction.get_transactions_in_date_range(from_date, to_date)
        
        total_income = 0
        total_expense = 0
        refunds = 0
        credit_card_expense = 0

        for transaction in transactions:
            account = transaction.account
            amount = transaction.amount

            if account.type.lower() == 'checking/savings':
                if amount > 0:
                    total_income += amount
                else:
                    total_expense += abs(amount)
            elif account.type.lower() == 'credit/debit':
                if amount > 0:
                    credit_card_expense += amount
                elif transaction.category != 'credit card payment':
                    refunds += abs(amount)

        summary = {
            "total_income": total_income,
            "total_expense": total_expense,
            "refunds": refunds,
            "credit_card_expense": credit_card_expense,
            "net_position": total_income - total_expense
        }

        return jsonify(summary)

    except ValueError as ve:
        return jsonify({"error": f"Invalid date format. {ve}"}), 400
    except Exception as e:
        return jsonify({"error": "An error occurred.", "details": str(e)}), 500

@app.route('/api/get-all-accounts', methods=['GET'])
def get_all_accounts():
    accounts = get_all_accounts_from_db()
    return jsonify(accounts), 200

@app.route('/api/create-account', methods=['POST'])
def create_account():
    try:
        data = request.json
        # Validate required fields
        required_fields = ['account_name', 'institution', 'account_type', 'last_4_digits']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        existing_account = Account.query.filter(
            (Account.name == data['account_name']) &
            (Account.last_4_digits == data['last_4_digits']) &
            (Account.type == data['account_type'])
        ).first()

        if existing_account:
            raise ValueError("Account with the same name, type, and last 4 digits already exists.")

        account_id = Account.add_account(data['account_name'], data['last_4_digits'], data['account_type'], data['institution'])
        return jsonify({
            'message': 'Account created successfully',
            "account_id": account_id
        }), 201
    except ValueError as e:
        return jsonify({
            'error': 'Account with the same name, type, and last 4 digits already exists.',
            'message': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/api/update-transaction', methods=['PUT'])
def update_transaction():
    try:
        data = request.json
        transaction_id = data.get('transaction_id')
        field = data.get('field')
        value = data.get('value')

        if not all([transaction_id, field]):
            return jsonify({"error": "Missing required fields"}), 400

        if value is None:
            return jsonify({"error": "Missing required fields"}), 400


        # Get the transaction
        transaction = Transaction.query.get(transaction_id)
        if not transaction:
            return jsonify({"error": "Transaction not found"}), 404

        # Update the appropriate field
        if field == 'transaction_date':
            try:
                transaction.transaction_date = datetime.strptime(value, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"error": "Invalid date format"}), 400
        elif field == 'amount':
            try:
                transaction.amount = float(value)
            except ValueError:
                return jsonify({"error": "Invalid amount"}), 400
        elif field == 'description':
            transaction.description = value
        elif field == 'category':
            transaction.category = value
        elif field == 'comment':
            transaction.comment = value
        else:
            return jsonify({"error": "Invalid field"}), 400

        # Save the changes
        db.session.commit()

        return jsonify({"message": "Transaction updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/upload-statement', methods=['POST'])
def upload_pdf():
    account_id = request.form.get('account_id')
    if not account_id:
        return jsonify({'error': 'Account ID is required'}), 400
    file = request.files.get('file')
    return process_pdf_upload(account_id, file)

@app.route('/api/upload-statement-by-name', methods=['POST'])
def upload_pdf_by_name():
    name = request.form.get('name')
    last_4_digits = request.form.get('last_4_digits')
    if not name or not last_4_digits:
        return jsonify({'error': 'Missing name or last_4_digits'}), 400

    account = Account.query.filter_by(name=name, last_4_digits=last_4_digits).first()
    if not account:
        return jsonify({'error': 'Account not found'}), 404

    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided'}), 400
    return process_pdf_upload(account.account_id, file)


@app.route('/api/add-transaction', methods=['POST'])
def add_transaction():
    try:
        # Parse JSON payload
        data = request.json

        # Required fields
        required_fields = ['account_id', 'transaction_date', 'description', 'category', 'amount']

        # Validate that all required fields are present
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Validate date format
        try:
            transaction_date = datetime.strptime(data['transaction_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid transaction_date format. Expected ISO format.'}), 400

        # Validate amount is positive
        if float(data['amount']) < 0:
            return jsonify({'error': 'Amount must be a positive number.'}), 400
        
        Transaction.add_transaction(data['account_id'], 
                                    transaction_date, 
                                    data['description'],
                                    data['category'],
                                    convert_to_float(data['amount']))
        return jsonify({'message': 'Transaction added successfully!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/delete-transaction', methods=['POST'])
def delete_transactions():
    """
    Endpoint to delete multiple transactions by their IDs, sent in the request body.
    
    :return: JSON response with success status and a message.
    """
    try:
        # Get the JSON data from the request
        data = request.get_json()

        # Check if 'transaction_ids' is in the request body
        if 'transaction_ids' not in data:
            return jsonify({
                "success": False,
                "message": "'transaction_ids' is required."
            }), 400

        transaction_ids = data['transaction_ids']
        
        if not isinstance(transaction_ids, list):
            return jsonify({
                "success": False,
                "message": "'transaction_ids' should be a list."
            }), 400

        # Track deleted and not found transactions
        deleted = []
        not_found = []

        # Attempt to delete each transaction
        for transaction_id in transaction_ids:
            if Transaction.delete_transaction(transaction_id):
                deleted.append(transaction_id)
            else:
                not_found.append(transaction_id)
        
        if len(deleted) == len(transaction_ids):
            return jsonify({"message": f"""Deleted transactions:{len(transaction_ids)} from the database"""}), 200
        
        return jsonify({"error": f""""Delted {len(deleted)}/{len(transaction_ids)} transactions"""}), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"An error occurred: {str(e)}"
        }), 500


@app.route('/api/edit-account/<int:account_id>', methods=['PUT'])
def edit_account(account_id):
    try:
        account = Account.query.get_or_404(account_id)
        data = request.json
        
        # Update account fields
        account.name = data.get('account_name', account.name)
        account.institution = data.get('institution', account.institution)
        account.type = data.get('type', account.type)
        account.last_4_digits = data.get('last_4_digits', account.last_4_digits)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Account updated successfully',
            'account': account.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/delete-account/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    try:
        account = Account.query.get_or_404(account_id)
          # Delete all associated transaction records
        Transaction.query.filter_by(account_id=account_id).delete()
        
        # Delete all associated balance records
        Balance.query.filter_by(account_id=account_id).delete()
        
        db.session.delete(account)
        db.session.commit()
        
        return jsonify({'message': 'Account deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@app.route('/api/remove-duplicates', methods=['DELETE'])
def remove_duplicates():
    """
    Remove duplicate transactions by iterating rows and using a dictionary.
    """
    try:
        # Dictionary to store seen keys (e.g., a combination of transaction_date, amount, and description)
        seen = {}

        # Query all transactions ordered by id
        transactions = Transaction.query.order_by(Transaction.transaction_id).all()

        duplicates = []
        for transaction in transactions:
            # Create a unique key for each transaction
            key = transaction.key

            if key in seen:
                # If the key is already seen, mark for deletion
                duplicates.append(transaction.transaction_id)
            else:
                # Otherwise, store it in the dictionary
                seen[key] = transaction.transaction_id

        # Bulk delete duplicate transactions
        if duplicates:
            Transaction.query.filter(Transaction.transaction_id.in_(duplicates)).delete(synchronize_session=False)
            db.session.commit()

        return jsonify({
            "message": f"Removed {len(duplicates)} duplicate transactions."
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": str(e)
        }), 500

def add_trasactions_to_db(transactions, account_id):
    transaction_ids = []
    for transaction in transactions:
        # Extract fields from the transaction dictionary
        transaction_date_str = transaction.get('transaction_date')
        description = transaction.get('description')
        category = transaction.get('category')
        amount = transaction.get('amount')
        comment = transaction.get('comment', None)

        try:
            transaction_date = datetime.strptime(transaction_date_str, '%Y-%m-%d').date()
            temp_transaction = Transaction(
                account_id=account_id,
                transaction_date=transaction_date,
                description=description,
                category=category,
                amount=amount
            )

            # Check if a transaction with the same key exists
            existing_transaction = Transaction.get_transaction_by_key(temp_transaction.key)

            # If exisitng transaction avoid insert into db
            if existing_transaction:
                print(f"Duplicate transaction detected, skipping: {temp_transaction.key}")
                continue

            new_transaction = Transaction.add_transaction(
                account_id=account_id,
                transaction_date=transaction_date,
                description=description,
                category=category,
                amount=amount,
                comment=comment)
            print(f"Added transaction: {new_transaction.transaction_id}")
            transaction_ids.append(new_transaction.transaction_id)
        except ValueError as e:
            print(f"Error parsing date: {e}")
        except Exception as e:
            print(f"Failed to add transaction for {transaction}: {e}")
    return transaction_ids


def get_all_accounts_from_db():
    with app.app_context():
        accounts = Account.query.all()
        return [account.to_dict() for account in accounts]

def backup_database():
    """
    Creates a backup of the SQLite database.
    The backup is saved with a timestamp in the filename.
    """
    try:
        # Define potential paths
        parent_dir = os.getcwd()  # Current working directory
        possible_paths = [
            os.path.join(parent_dir, DATABASE_NAME),
            os.path.join(parent_dir, 'instance', DATABASE_NAME)
        ]

        # Find the first valid database file path
        src = None
        for path in possible_paths:
            if os.path.exists(path):
                src = path
                break

        # If no valid source file is found, raise an error
        if not src:
            raise FileNotFoundError("Database file not found in either the parent or 'instance' folder.")

        # Define the backup directory
        backup_dir = './backups'
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)

        # Add a timestamp to the backup file name
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(backup_dir, f'bankBuddy_backup_{timestamp}.bak')

        # Copy the database file to create a backup
        with open(src, 'rb') as db_file:
            with open(backup_path, 'wb') as backup_file:
                backup_file.write(db_file.read())

        print(f"Backup created successfully at {backup_path}")
    except Exception as e:
        print(f"Error during backup: {str(e)}")

# Schedule the backup job
scheduler = BackgroundScheduler()

# Trigger backup immediately when the app starts or restarts
scheduler.add_job(backup_database, next_run_time=datetime.now())

# Schedule daily backup at 2:00 AM
trigger = CronTrigger(hour=2, minute=0)  # Daily at 2:00 AM
scheduler.add_job(backup_database, trigger=trigger)

scheduler.start()

def initialize_scheduler():
    """
    Ensures the scheduler starts when the application is deployed.
    """
    if not scheduler.running:
        scheduler.start()
# Create tables
with app.app_context():
    parent_dir = os.getcwd()  # Current working directory
    possible_paths = [
        os.path.join(parent_dir, DATABASE_NAME),
        os.path.join(parent_dir, 'instance', DATABASE_NAME)
    ]

    # Find the first valid database file path
    src = None
    for path in possible_paths:
        if os.path.exists(path):
            src = path
            break
    if not src:
        db.create_all()
    initialize_scheduler()

# Ensure app runs only in Flask's debug mode or as a WSGI app
if __name__ == "__main__":
    try:
        app.run(debug=True)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
# if __name__ == '__main__':
#     app.run(host='localhost', port=5000, debug=True)

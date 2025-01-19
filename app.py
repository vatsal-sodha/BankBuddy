from datetime import datetime
from anthropic import Anthropic
from flask import Flask, json, request, jsonify
from flask_cors import CORS
import os
import pdfplumber
from app_utils import *
from flask_sqlalchemy import SQLAlchemy
from privacy_filter import PrivacyFilter
from dotenv import load_dotenv
from models.account import Account
from models.transaction import Transaction
from models import db
load_dotenv()
app = Flask(__name__)
app.debug = True
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bankBuddy.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
# Create tables
with app.app_context():
    db.create_all()

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
    prompt = f"""Below is the text from a credit card statement. 
    Please extract all transactions and return them as a JSON array.
    Each transaction should have these fields if available:
    - transaction_date (in YYYY-MM-DD format)
    - description
    - amount
    - category
    
    Only return the JSON array, no other text.
    Always format dates as YYYY-MM-DD, even if they appear differently in the statement. 
    Also if year is missing infer the year from rest of the texts and return in it YYYY-MM-DD format

    - Can you please also classify the transaction based on the description of the transaction 
    among one of the categories from below:
    - paycheck, other income,
    - transfer, credit card payment
    - home, utilities, rent
    - auto, gas, parking, travel
    - restaurant, groceries, medical
    - amazon, walmart, shopping
    - subscriptions, donations, insurance
    - investments, other expenses
    
    All categories above are comma separated and do return category for each transaction

    Statement text:
    {text}"""
    # Get response from Claude
    try:
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        response = message.content[0].text
        
        # Parse JSON response
        transactions = json.loads(response)
        
        # Basic validation
        if not isinstance(transactions, list):
            raise ValueError("Response is not a JSON array")
                    
        return transactions
        
    except Exception as e:
        raise Exception(f"Error processing with Claude: {str(e)}")
    
 
# Directory to temporarily store uploaded files
UPLOAD_FOLDER = './uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/api/get-transactions', methods=['GET'])
def get_transactions():
    try:
        from_date_str = request.args.get('fromDate')
        to_date_str = request.args.get('toDate')

        from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
        to_date = datetime.strptime(to_date_str, '%Y-%m-%d')

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
                "account_id":account.account_id
            })

        # Return the result as JSON
        return jsonify({"transactions": result})
    except ValueError as ve:
        # Handle invalid date format
        return jsonify({"error": f"Invalid date format. {ve}"}), 400

    except Exception as e:
        # Handle unexpected errors
        return jsonify({"error": "An error occurred.", "details": str(e)}), 500


@app.route('/api/financial-summary', methods=['GET'])
def get_financial_summary():
    try:
        from_date_str = request.args.get('fromDate')
        to_date_str = request.args.get('toDate')

        from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
        to_date = datetime.strptime(to_date_str, '%Y-%m-%d')

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
                transaction.transaction_date = datetime.strptime(value, '%Y-%m-%d')
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
    # Get the account_id from the form data
    account_id = request.form.get('account_id')
    if not account_id:
        return jsonify({'error': 'Account ID is required'}), 400
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith('.pdf'):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    # Save the file temporarily
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    API_KEY = os.getenv('ANTHROPIC_API_KEY')
    if not API_KEY:
        raise ValueError("Please set ANTHROPIC_API_KEY environment variable")
    
    transactions = extract_transactions_from_pdf(file_path, API_KEY)
    transaction_ids = add_trasactions_to_db(transactions, account_id)

    os.remove(file_path)
    return jsonify({"message": f"""Added transactions:{len(transaction_ids)} to database"""})

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
            transaction_date = datetime.strptime(data['transaction_date'], '%Y-%m-%dT%H:%M:%S.%fZ')
        except ValueError:
            return jsonify({'error': 'Invalid transaction_date format. Expected ISO format.'}), 400

        # Validate amount is positive
        if float(data['amount']) <= 0:
            return jsonify({'error': 'Amount must be a positive number.'}), 400
        
        Transaction.add_transaction(data['account_id'], 
                                    transaction_date, 
                                    data['description'],
                                    data['category'],
                                    float(data['amount']))
        return jsonify({'message': 'Transaction added successfully!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
            transaction_date = datetime.strptime(transaction_date_str, '%Y-%m-%d')
            temp_transaction = Transaction(
                account_id=account_id,
                transaction_date=transaction_date,
                description=description,
                category=category,
                amount=amount
            )

            # Check if a transaction with the same key exists
            existing_transaction = Transaction.get_by_key(temp_transaction.key)

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

if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)

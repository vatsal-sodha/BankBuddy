import datetime
from anthropic import Anthropic
from flask import Flask, json, request, jsonify
from flask_cors import CORS
import os
from sqlalchemy import UniqueConstraint
# from docling.document_converter import DocumentConverter
# import pandas as pd
import pdfplumber
from app_utils import *
from flask_sqlalchemy import SQLAlchemy
from privacy_filter import PrivacyFilter
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.debug = True
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bankBuddy.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# Account table schema
class Account(db.Model):
    __tablename__ = 'accounts'

    account_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    institution = db.Column(db.String(100), nullable=True)
    created_date = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)
    last_modified_date = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    last_4_digits = db.Column(db.String(4), nullable=False)
    type = db.Column(db.String(50), nullable=False)

    # Relationship to transactions
    transactions = db.relationship('Transaction', backref='account', lazy=True)
    # Ensure combination of account_name, type, and last_4_digits is unique
    __table_args__ = (
        UniqueConstraint('name', 'last_4_digits', 'type', name='uix_account_unique'),
    )

    def __repr__(self):
        return f"<Account {self.name} - {self.last_4_digits}>"
    
    def to_dict(self):
        return {
            "account_id": self.account_id,
            "name": self.name,
            "institution": self.institution,
            "created_date": self.created_date.isoformat(),
            "last_modified_date": self.last_modified_date.isoformat(),
            "last_4_digits": self.last_4_digits,
            "type": self.type
        }

# Transaction Table Schema
class Transaction(db.Model):
    __tablename__ = 'transactions'

    transaction_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.account_id'), nullable=False)
    transaction_date = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    created_date = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)
    last_modified_date = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    comment = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"<Transaction {self.id} - {self.amount}>"


def add_transaction(account_id, trans_date, description, category, amount, comment=None):
    with app.app_context():
        new_transaction = Transaction(
            account_id=account_id,
            trans_date=trans_date,
            description=description,
            category=category,
            amount=amount,
            comment=comment
        )

        # Add the new transaction to the database session
        db.session.add(new_transaction)
        db.session.commit()

    return new_transaction  # Return the created transaction

def add_account(name, last_4_digits, type, institution=None):
    new_account = Account(name=name, 
                               institution=institution, 
                               last_4_digits=last_4_digits, 
                               type=type)
         # Add the new transaction to the database session
    db.session.add(new_account)
    db.session.commit()
    return new_account.account_id

def get_all_accounts_from_db():
    accounts = Account.query.all()
    return [account.to_dict() for account in accounts]

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
    - date (in YYYY-MM-DD format)
    - description
    - amount
    
    Only return the JSON array, no other text.
    Always format dates as YYYY-MM-DD, even if they appear differently in the statement.

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

        account_id = add_account(data['account_name'], data['last_4_digits'], data['account_type'], data['institution'])
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

        
@app.route('/upload-pdf', methods=['POST'])
def upload_pdf():
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
    print(file.filename)

    API_KEY = os.getenv('ANTHROPIC_API_KEY')
    if not API_KEY:
        raise ValueError("Please set ANTHROPIC_API_KEY environment variable")
    transactions = extract_transactions_from_pdf(file_path, API_KEY)
    os.remove(file_path)
    
    # converter = DocumentConverter()
    # result = converter.convert(file_path)
    # df = list()
    # for _, table in enumerate(result.document.tables):
    #     table_df = table.export_to_dataframe()
    #     if is_valid_transactions_table(table_df):
    #         df.append(table_df)
    # print(df)
    return jsonify({"message": transactions})

    # try:
    #     # Extract text from the PDF
    #     reader = PdfReader(file_path)
    #     text = ""
    #     for page in reader.pages:
    #         text += page.extract_text() + "\n"

    #     # Delete the file after processing
    #     os.remove(file_path)

    #     return jsonify({"message": "PDF processed successfully.", "text": text})
    # except Exception as e:
    #     return jsonify({"error": f"An error occurred while reading the PDF: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)

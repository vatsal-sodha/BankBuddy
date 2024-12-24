import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from docling.document_converter import DocumentConverter
import pandas as pd
from app_utils import *
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.debug = True
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bankBuddy.db'  # Use SQLite for simplicity
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# Account table schema
class Account(db.Model):
    __tablename__ = 'accounts'

    account_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    institution = db.Column(db.String(100), nullable=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_modified_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_4_digit = db.Column(db.String(4), nullable=False)
    type = db.Column(db.String(50), nullable=False)

    # Relationship to transactions
    transactions = db.relationship('Transaction', backref='account', lazy=True)

    def __repr__(self):
        return f"<Account {self.name} - {self.last_4_digit}>"

# Transaction Table Schema
class Transaction(db.Model):
    __tablename__ = 'transactions'

    transaction_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    transaction_date = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    created_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_modified_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
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

def add_account(name, last_4_digit, type, institution=None):
    with app.app_context():
        new_account = Account(name=name, 
                               institution=institution, 
                               last_4_digit=last_4_digit, 
                               type=type)
         # Add the new transaction to the database session
        db.session.add(new_account)
        db.session.commit()
    return new_account


# Create tables
with app.app_context():
    db.create_all()


# Directory to temporarily store uploaded files
UPLOAD_FOLDER = './uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

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
    converter = DocumentConverter()
    result = converter.convert(file_path)
    df = list()
    for _, table in enumerate(result.document.tables):
        table_df = table.export_to_dataframe()
        if is_valid_transactions_table(table_df):
            df.append(table_df)
    print(df)
    os.remove(file_path)
    return jsonify({"message": "file received"})

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

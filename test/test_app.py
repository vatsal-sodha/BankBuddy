import unittest
import os

from app import app
from models import db
from models.account import Account
from models.transaction import Transaction
from datetime import datetime
import json
from unittest.mock import patch
from tempfile import NamedTemporaryFile


class BankBuddyTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app = app.test_client()
        with app.app_context():  # Crucial: Use app context for db operations
            db.create_all()
            test_account = Account(name="Test Account", last_4_digits="1234", type="checking/savings", institution="Test Bank")
            db.session.add(test_account)
            db.session.commit()
            self.test_account_id = test_account.account_id
            test_transaction = Transaction(account_id=self.test_account_id, transaction_date=datetime(2024, 1, 1), description="Test Transaction", category="groceries", amount=50.00)
            db.session.add(test_transaction)
            db.session.commit()

    def tearDown(self):
        with app.app_context(): #Crucial
            db.session.remove()
            db.drop_all()

    def test_get_transactions(self):
        with app.app_context():
            response = self.app.get('/api/get-transactions?fromDate=2023-01-01&toDate=2025-01-01')
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.get_data(as_text=True))
            self.assertIsInstance(data['transactions'], list)
            self.assertEqual(len(data['transactions']), 1)

    def test_add_transaction(self):
        new_transaction = {
            "account_id": self.test_account_id,
            "transaction_date": "2024-12-25T00:00:00.000Z",
            "description": "Christmas Shopping",
            "category": "shopping",
            "amount": 150.00
        }
        with app.app_context(): #Crucial
            response = self.app.post('/api/add-transaction', json=new_transaction)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(Transaction.query.count(), 2)

    def test_financial_summary(self):
        with app.app_context(): #Crucial
            response = self.app.get('/api/financial-summary?fromDate=2023-01-01&toDate=2025-01-01')
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.get_data(as_text=True))
            self.assertIsInstance(data, dict)
            self.assertIn('total_income', data)
            self.assertIn('total_expense', data)
            self.assertEqual(data['total_income'], 50.00)

    def test_create_account(self):
        new_account = {
            "account_name": "Test Account 2",
            "institution": "Test Bank",
            "account_type": "credit/debit",
            "last_4_digits": "5678"
        }
        with app.app_context(): #Crucial
            response = self.app.post('/api/create-account', json=new_account)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(Account.query.count(), 2)
    # def setUp(self):
    #     """Set up the test client and initialize the database."""
    #     self.app = app
    #     self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
    #     self.app.config['TESTING'] = True
    #     self.client = self.app.test_client()
        
    #     with self.app.app_context():
    #         db.create_all()

    # def tearDown(self):
    #     """Clean up after each test."""
    #     with self.app.app_context():
    #         db.session.remove()
    #         db.drop_all()

    # def test_create_account(self):
    #     """Test creating a new account."""
    #     payload = {
    #         "account_name": "Savings Account",
    #         "institution": "Test Bank",
    #         "account_type": "checking/savings",
    #         "last_4_digits": "1234"
    #     }
    #     response = self.client.post('/api/create-account', json=payload)
    #     data = response.get_json()

    #     self.assertEqual(response.status_code, 201)
    #     self.assertIn("message", data)
    #     self.assertEqual(data["message"], "Account created successfully")

    def test_create_duplicate_account(self):
        """Test creating a duplicate account."""
        payload = {
            "account_name": "Savings Account",
            "institution": "Test Bank",
            "account_type": "checking/savings",
            "last_4_digits": "1234"
        }
        # Create the first account
        self.app.post('/api/create-account', json=payload)

        # Attempt to create a duplicate account
        response = self.app.post('/api/create-account', json=payload)
        data = response.get_json()

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", data)
        self.assertIn("already exists", data["error"])

    @patch('app.app.extract_transactions_from_pdf')
    def test_upload_pdf(self, mock_extract_transactions_from_pdf):
        mock_extract_transactions_from_pdf.return_value = [
            {"transaction_date": "2024-01-05", "description": "Test PDF Transaction", "category": "test", "amount": 10.00}
        ]
        with NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
            temp_pdf_path = temp_pdf.name
            temp_pdf.write(b"Test PDF Content")
        try:
            with app.app_context(): #Crucial
                with open(temp_pdf_path, "rb") as fp:
                    data = {"account_id": str(self.test_account_id), "file": (fp, "test.pdf")}
                    response = self.app.post('/api/upload-statement', content_type='multipart/form-data', data=data)
                    print(response)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(Transaction.query.count(), 1)
        finally:
            os.remove(temp_pdf_path)

    # def test_add_transaction(self):
    #     """Test adding a transaction."""
    #     # Create an account first
    #     with self.app.app_context():
    #         account = Account(name="Test Account", institution="Test Bank", type="checking/savings", last_4_digits="5678")
    #         db.session.add(account)
    #         db.session.commit()

    #     payload = {
    #         "account_id": account.account_id,
    #         "transaction_date": "2025-01-01T00:00:00.000Z",
    #         "description": "Test Transaction",
    #         "category": "groceries",
    #         "amount": 50.0
    #     }
    #     response = self.client.post('/api/add-transaction', json=payload)
    #     data = response.get_json()

    #     self.assertEqual(response.status_code, 200)
    #     self.assertIn("message", data)
    #     self.assertEqual(data["message"], "Transaction added successfully!")

    # def test_get_transactions(self):
    #     """Test fetching transactions in a date range."""
    #     # Create an account and a transaction
    #     account = Account(name="Test Account", institution="Test Bank", type="checking/savings", last_4_digits="5678")
    #     transaction = Transaction(
    #         account=account,
    #         transaction_date=datetime(2025, 1, 1),
    #         description="Test Transaction",
    #         category="groceries",
    #         amount=50.0
    #     )
    #     with self.app.app_context():
    #         db.session.add(account)
    #         db.session.add(transaction)
    #         db.session.commit()

    #     response = self.client.get('/api/get-transactions?fromDate=2025-01-01&toDate=2025-01-02')
    #     data = response.get_json()

    #     self.assertEqual(response.status_code, 200)
    #     self.assertIn("transactions", data)
    #     self.assertEqual(len(data["transactions"]), 1)
    #     self.assertEqual(data["transactions"][0]["description"], "Test Transaction")

    # def test_upload_statement_invalid_file(self):
    #     """Test uploading an invalid file."""
    #     response = self.client.post('/api/upload-statement', data={
    #         'account_id': 1,
    #         'file': (None, '')
    #     })
    #     data = response.get_json()

    #     self.assertEqual(response.status_code, 400)
    #     self.assertIn("error", data)
    #     self.assertIn("No file selected", data["error"])

    # def test_delete_transaction(self):
    #     """Test deleting a transaction."""
    #     # Create an account and a transaction
    #     account = Account(name="Test Account", institution="Test Bank", type="checking/savings", last_4_digits="5678")
    #     transaction = Transaction(
    #         account=account,
    #         transaction_date=datetime(2025, 1, 1),
    #         description="Test Transaction",
    #         category="groceries",
    #         amount=50.0
    #     )
    #     with self.app.app_context():
    #         db.session.add(account)
    #         db.session.add(transaction)
    #         db.session.commit()

    #     response = self.client.post('/api/delete-transaction', json={"transaction_ids": [transaction.transaction_id]})
    #     data = response.get_json()

    #     self.assertEqual(response.status_code, 200)
    #     self.assertIn("message", data)
    #     self.assertIn(f"Deleted transactions", data["message"])

    # def test_remove_duplicates(self):
    #     """Test removing duplicate transactions."""
    #     # Create duplicate transactions
    #     account = Account(name="Test Account", institution="Test Bank", type="checking/savings", last_4_digits="5678")
    #     transaction1 = Transaction(
    #         account=account,
    #         transaction_date=datetime(2025, 1, 1),
    #         description="Duplicate Transaction",
    #         category="groceries",
    #         amount=50.0
    #     )
    #     transaction2 = Transaction(
    #         account=account,
    #         transaction_date=datetime(2025, 1, 1),
    #         description="Duplicate Transaction",
    #         category="groceries",
    #         amount=50.0
    #     )
    #     with self.app.app_context():
    #         db.session.add(account)
    #         db.session.add(transaction1)
    #         db.session.add(transaction2)
    #         db.session.commit()

    #     response = self.client.delete('/api/remove-duplicates')
    #     data = response.get_json()

    #     self.assertEqual(response.status_code, 200)
    #     self.assertIn("message", data)
    #     self.assertIn("Removed", data["message"])

if __name__ == '__main__':
    unittest.main()

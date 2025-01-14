import datetime
from . import db

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

    @classmethod
    def add_transaction(cls, account_id, transaction_date, description, category, amount, comment=None):
        new_transaction = cls(
            account_id=account_id,
            transaction_date=transaction_date,
            description=description,
            category=category,
            amount=amount,
            comment=comment
        )

        # Add the new transaction to the database session
        db.session.add(new_transaction)
        db.session.commit()

        return new_transaction  # Return the created transaction
    
    @classmethod
    def get_transactions_in_date_range(cls, from_date, to_date):
        """
        Retrieve all transactions between from_date and to_date
        
        :param from_date: Start date as a datetime object.
        :param to_date: End date as a datetime object.
        :return: List of transactions within the date range.
        """
        query = cls.query.filter(cls.transaction_date >= from_date, cls.transaction_date <= to_date)

        return query.all()

import datetime
from . import db

# Transaction Table Schema
class Transaction(db.Model):
    __tablename__ = 'transactions'

    transaction_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.account_id'), nullable=False)
    transaction_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.now(datetime.UTC), nullable=False)  # Renamed to created_at
    last_modified_time = db.Column(db.DateTime, onupdate=datetime.datetime.now(datetime.UTC), nullable=True)  # Renamed to last_modified_time, only updates on modification
    comment = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"<Transaction {self.transaction_id} - {self.amount}>"

    @property
    def key(self):
        return (
            self.transaction_date, 
            self.amount, 
            self.description, 
            self.category, 
            self.account_id
        )
    
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
    def delete_transaction(cls, transaction_id):
        """
        Deletes a transaction by its ID.
        
        :param transaction_id: ID of the transaction to delete.
        :return: True if the transaction was deleted, False if not found.
        """
        transaction = cls.query.get(transaction_id)
        if transaction:
            db.session.delete(transaction)
            db.session.commit()
            return True
        return False
    
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
    
    @classmethod
    def get_transaction_by_key(cls, key):
        """
        Retrieve a transaction by its unique key.
        """
        return cls.query.filter(
            cls.transaction_date == key[0],
            cls.amount == key[1],
            cls.description == key[2],
            cls.category == key[3],
            cls.account_id == key[4]
        ).first()

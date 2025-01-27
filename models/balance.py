import datetime
from . import db

class Balance(db.Model):
    __tablename__ = 'balance'

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.account_id'), nullable=False)
    balance = db.Column(db.Float, nullable=False)
    statement_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.now(datetime.UTC), nullable=False)

    @classmethod
    def add_balance(cls, account_id, balance, statement_date):
        # Ensure statement_date is a datetime.date object
        if isinstance(statement_date, str):
            try:
                # Convert string to date (expected format: yyyy-mm-dd)
                statement_date = datetime.datetime.strptime(statement_date, '%Y-%m-%d').date()
            except ValueError:
                raise ValueError("Invalid date format. Expected 'yyyy-mm-dd'.")
        elif not isinstance(statement_date, datetime.date):
            raise TypeError("statement_date must be a date object or a string in 'yyyy-mm-dd' format.")
        
        new_balance = cls(
            account_id=account_id,
            balance=balance,
            statement_date=statement_date
        )
            # Add the new balance history to the session
        db.session.add(new_balance)
        db.session.commit()

        return new_balance
    
    @classmethod
    def get_recent_balance(cls, account_id):
        """
        Get the most recent balance for a given account_id.
        
        Args:
            account_id (int): The account ID to query
            
        Returns:
            Balance: The most recent balance record for the account
            None: If no balance record exists for the account
        """
        return cls.query.filter_by(account_id=account_id)\
                  .order_by(cls.statement_date.desc())\
                  .first()



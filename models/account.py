import datetime
from sqlalchemy import UniqueConstraint

from models.balance import Balance
from . import db

# Account table schema
class Account(db.Model):
    __tablename__ = 'accounts'

    account_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    institution = db.Column(db.String(100), nullable=True)
    created_date = db.Column(db.DateTime, default=datetime.datetime.now(datetime.UTC), nullable=False)
    last_modified_date = db.Column(db.DateTime, default=datetime.datetime.now(datetime.UTC), onupdate=datetime.datetime.now(datetime.UTC), nullable=False)
    last_4_digits = db.Column(db.String(4), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    last_statement_date = db.Column(db.Date, nullable=True)

    # Relationship to transactions
    transactions = db.relationship('Transaction', backref='account', lazy=True)
    # Relationship to balance history
    balance_history = db.relationship('Balance', backref='account', lazy=True)

    # Ensure combination of account_name, type, and last_4_digits is unique
    __table_args__ = (
        UniqueConstraint('name', 'last_4_digits', 'type', name='uix_account_unique'),
    )

    def __repr__(self):
        return f"<Account {self.name} - {self.last_4_digits}>"
    
    def to_dict(self):
        recent_balance = Balance.get_recent_balance(self.account_id)
        return {
            "account_id": self.account_id,
            "name": self.name,
            "institution": self.institution,
            "created_date": self.created_date.isoformat(),
            "last_modified_date": self.last_modified_date.isoformat(),
            "last_4_digits": self.last_4_digits,
            "type": self.type,
            "balance": str(recent_balance.balance) if recent_balance else "NA",
            "last_statement_date": self.last_statement_date.strftime('%Y-%m-%d') if self.last_statement_date else "NA",
        }
    
    @classmethod
    def add_account(cls, name, last_4_digits, type, institution=None):
        new_account = cls(name=name, 
                        institution=institution, 
                        last_4_digits=last_4_digits, 
                        type=type)
            # Add the new transaction to the database session
        db.session.add(new_account)
        db.session.commit()
        return new_account.account_id
    
    @classmethod
    def update_last_statement_date(cls, account_id):
        # Get the account by account_id
        account = cls.query.get(account_id)
        
        if account:
            # Get the most recent balance record for this account
            recent_balance = Balance.get_recent_balance(account_id)
            
            if recent_balance:
                # Update the last_statement_date to the statement date of the most recent balance
                account.last_statement_date = recent_balance.statement_date
                db.session.commit()
            else:
                # Optionally handle the case where there is no balance
                account.last_statement_date = None
                db.session.commit()
        else:
            raise ValueError(f"Account with id {account_id} does not exist.")

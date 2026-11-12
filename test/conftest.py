"""
Shared pytest setup.

The Flask app connects to its database when app/app.py is imported, so the
test database and the TESTING switch must be set *before* that import.
Every test gets an empty throwaway SQLite database - never the real one.
"""

import os
import sys
import tempfile
from datetime import date

_TMP_DIR = tempfile.mkdtemp(prefix="bankbuddy-tests-")
os.environ["BANKBUDDY_TESTING"] = "1"
os.environ["BANKBUDDY_DATABASE_URI"] = "sqlite:///" + os.path.join(_TMP_DIR, "test.db")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-used")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib  # noqa: E402

import pytest  # noqa: E402

# app/app.py defines a Flask object also named `app`, so `from app import app`
# can return either; load the module explicitly.
app_module = importlib.import_module("app.app")
from models import db  # noqa: E402
from models.account import Account  # noqa: E402
from models.transaction import Transaction  # noqa: E402

flask_app = app_module.app

# Hard stop if anything ever points the tests at a real database
assert "bankBuddy.db" not in flask_app.config["SQLALCHEMY_DATABASE_URI"]
assert _TMP_DIR in flask_app.config["SQLALCHEMY_DATABASE_URI"]


@pytest.fixture
def app_ctx():
    """Fresh, empty schema for each test."""
    flask_app.config["TESTING"] = True
    with flask_app.app_context():
        db.drop_all()
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app_ctx):
    return app_ctx.test_client()


@pytest.fixture
def accounts(app_ctx):
    """One checking account and one credit card."""
    checking = Account(name="Checking", last_4_digits="1111", type="checking/savings", institution="Bank")
    card = Account(name="Card", last_4_digits="2222", type="credit/debit", institution="Issuer")
    db.session.add_all([checking, card])
    db.session.commit()
    return {"checking": checking.account_id, "card": card.account_id}


def add_tx(account_id, day, amount, category, description="TEST"):
    """Insert a transaction using the stored sign convention:
    checking: + money in / - money out; credit card: + charge / - payment or refund."""
    t = Transaction(
        account_id=account_id,
        transaction_date=day if isinstance(day, date) else date.fromisoformat(day),
        description=description,
        category=category,
        amount=amount,
    )
    db.session.add(t)
    db.session.commit()
    return t

"""Duplicate detection, financial summary rules and the statement upload endpoint (temporary DB)."""

import io
from datetime import UTC, datetime, timedelta

from conftest import add_tx, app_module
from models.balance import Balance
from models.transaction import Transaction


def tx(day, amount, category="groceries", description="SHOP"):
    """A transaction as Claude returns it (before saving)."""
    return {"transaction_date": day, "amount": amount, "category": category, "description": description}


# ---------- duplicate detection ----------

def test_skips_existing_transaction_within_three_days_ignoring_sign_and_text(accounts):
    add_tx(accounts["card"], "2025-03-10", 42.10, "groceries", "GROCERY STORE #1 ANYTOWN")
    added, skipped = app_module.add_trasactions_to_db(
        [tx("2025-03-12", -42.10, "shopping", "Grocery Store")], accounts["card"])
    assert (len(added), skipped) == (0, 1)


def test_adds_same_amount_outside_the_window_or_on_another_account(accounts):
    add_tx(accounts["card"], "2025-03-10", 42.10, "groceries")
    added, skipped = app_module.add_trasactions_to_db([tx("2025-03-14", 42.10)], accounts["card"])
    assert (len(added), skipped) == (1, 0)
    added, skipped = app_module.add_trasactions_to_db([tx("2025-03-10", 42.10)], accounts["checking"])
    assert (len(added), skipped) == (1, 0)


def test_each_stored_transaction_matches_only_once(accounts):
    """Two identical coffees on the same day, one already stored -> exactly one is added."""
    add_tx(accounts["card"], "2025-03-10", 5.00, "restaurant")
    added, skipped = app_module.add_trasactions_to_db(
        [tx("2025-03-10", 5.00, "restaurant"), tx("2025-03-10", 5.00, "restaurant")], accounts["card"])
    assert (len(added), skipped) == (1, 1)
    assert Transaction.query.filter_by(account_id=accounts["card"]).count() == 2


def test_reuploading_the_same_file_adds_nothing(accounts):
    batch = [tx(f"2025-04-{d:02d}", d * 1.5) for d in range(1, 11)]
    assert len(app_module.add_trasactions_to_db(batch, accounts["checking"])[0]) == 10
    assert app_module.add_trasactions_to_db(batch, accounts["checking"]) == ([], 10)


def test_unparseable_rows_are_skipped(accounts):
    added, skipped = app_module.add_trasactions_to_db(
        [tx("not-a-date", 1), {"amount": 3}, tx("2025-01-01", "abc"), tx("2025-01-01", 7)], accounts["checking"])
    assert (len(added), skipped) == (1, 0)


# ---------- financial summary ----------

def _seed_month(accounts):
    c, k = accounts["checking"], accounts["card"]
    add_tx(c, "2025-05-01", 5000, "paycheck")               # income
    add_tx(c, "2025-05-02", 200, "other income")            # income
    add_tx(c, "2025-05-03", -1500, "home mortgage")         # checking spending
    add_tx(c, "2025-05-04", 30, "restaurant")               # refund into checking -> reduces spending
    add_tx(c, "2025-05-05", -800, "credit card payment")    # excluded (card purchases counted on the card)
    add_tx(k, "2025-05-05", -800, "credit card payment")    # payment received on card, excluded
    add_tx(c, "2025-05-06", -1000, "transfer")              # excluded
    add_tx(c, "2025-05-07", -700, "investments")            # separate bucket
    add_tx(c, "2025-05-08", -300, "marcus transfer")        # separate bucket
    add_tx(c, "2025-05-09", 100, "marcus transfer")         # money back from Marcus
    add_tx(k, "2025-05-10", 120, "restaurant")              # card charge
    add_tx(k, "2025-05-11", 80, "groceries")                # card charge
    add_tx(k, "2025-05-12", -20, "groceries")               # card refund


def test_financial_summary_applies_category_rules(client, accounts):
    _seed_month(accounts)
    s = client.get("/api/financial-summary?fromDate=2025-05-01&toDate=2025-05-31").get_json()
    assert s["total_income"] == 5200
    # mortgage 1500 - restaurant refund 30 + card charges 200 - card refund 20
    assert s["total_expense"] == 1650
    assert s["credit_card_expense"] == 200
    assert s["refunds"] == 50
    assert s["net_invested"] == 700
    assert s["marcus_net"] == 200
    assert s["net_position"] == 5200 - 1650


def test_categories_endpoint_matches_summary_totals(client, accounts):
    _seed_month(accounts)
    q = "fromDate=2025-05-01&toDate=2025-05-31"
    s = client.get(f"/api/financial-summary?{q}").get_json()
    cats = client.get(f"/api/transactions-by-categories?{q}").get_json()["transactions"]
    assert "credit card payment" not in cats and "transfer" not in cats
    income = sum(v for k, v in cats.items() if k in app_module.INCOME_CATEGORIES)
    spending = -sum(v for k, v in cats.items()
                    if k not in app_module.INCOME_CATEGORIES and k not in app_module.SEPARATE_CATEGORIES)
    assert income == s["total_income"]
    assert spending == s["total_expense"]
    assert cats["groceries"] == -60 and cats["restaurant"] == -90  # card values are money flows


def test_summary_respects_the_date_range(client, accounts):
    add_tx(accounts["checking"], "2025-04-30", 999, "paycheck")
    add_tx(accounts["checking"], "2025-05-01", 1, "paycheck")
    s = client.get("/api/financial-summary?fromDate=2025-05-01&toDate=2025-05-31").get_json()
    assert s["total_income"] == 1


def test_get_transactions_returns_account_details(client, accounts):
    add_tx(accounts["card"], "2025-05-10", 12.5, "restaurant", "TACO")
    rows = client.get("/api/get-transactions?fromDate=2025-05-01&toDate=2025-05-31").get_json()["transactions"]
    assert len(rows) == 1
    assert rows[0]["account_type"] == "credit/debit" and rows[0]["last_4_digits"] == "2222"


def test_rejects_reversed_date_range(client):
    r = client.get("/api/financial-summary?fromDate=2025-06-01&toDate=2025-05-01")
    assert r.status_code == 400


# ---------- statement upload ----------

def _upload(client, account_id, name, extracted, monkeypatch):
    monkeypatch.setattr(app_module, "extract_transactions", lambda path, key: extracted)
    return client.post("/api/upload-statement",
                       data={"account_id": str(account_id), "file": (io.BytesIO(b"data"), name)},
                       content_type="multipart/form-data")


def test_card_upload_flips_signs_to_card_convention(client, accounts, monkeypatch):
    extracted = {"statement_date": "2025-06-30", "account_balance": None, "transactions": [
        tx("2025-06-05", -42.10, "groceries"),             # purchase  -> stored +42.10
        tx("2025-06-06", 250.00, "credit card payment"),   # payment   -> stored -250
        tx("2025-06-07", 15.99, "amazon"),                 # refund    -> stored -15.99
    ]}
    r = _upload(client, accounts["card"], "Card_Activity.CSV", extracted, monkeypatch)
    assert r.status_code == 200 and r.get_json()["added"] == 3
    stored = {t.category: t.amount for t in Transaction.query.all()}
    assert stored == {"groceries": 42.10, "credit card payment": -250.0, "amazon": -15.99}


def test_checking_upload_keeps_signs(client, accounts, monkeypatch):
    extracted = {"statement_date": "2025-06-30", "account_balance": 1234.5,
                 "transactions": [tx("2025-06-05", -42.10), tx("2025-06-06", 3000, "paycheck")]}
    r = _upload(client, accounts["checking"], "stmt.csv", extracted, monkeypatch)
    assert r.status_code == 200
    assert sorted(t.amount for t in Transaction.query.all()) == [-42.10, 3000]
    # a CSV that states a balance records it
    assert Balance.query.one().balance == 1234.5


def test_csv_without_balance_does_not_record_a_fake_zero_balance(client, accounts, monkeypatch):
    extracted = {"statement_date": "2025-06-30", "account_balance": None, "transactions": [tx("2025-06-05", -1)]}
    _upload(client, accounts["checking"], "export.csv", extracted, monkeypatch)
    assert Balance.query.count() == 0


def test_upload_reports_duplicates_on_second_attempt(client, accounts, monkeypatch):
    extracted = {"statement_date": None, "account_balance": None,
                 "transactions": [tx("2025-06-05", -10), tx("2025-06-09", -20)]}
    _upload(client, accounts["checking"], "a.csv", extracted, monkeypatch)
    body = _upload(client, accounts["checking"], "a.csv", extracted, monkeypatch).get_json()
    assert (body["added"], body["skipped_duplicates"]) == (0, 2)


def test_upload_rejects_unsupported_files(client, accounts, monkeypatch):
    r = _upload(client, accounts["checking"], "notes.txt", {}, monkeypatch)
    assert r.status_code == 400 and "PDF and CSV" in r.get_json()["error"]


def test_upload_returns_extraction_errors_and_cleans_up(client, accounts, monkeypatch, tmp_path):
    monkeypatch.setattr(app_module, "UPLOAD_FOLDER", str(tmp_path))

    def boom(path, key):
        raise Exception("Claude declined to process this statement")

    monkeypatch.setattr(app_module, "extract_transactions", boom)
    r = client.post("/api/upload-statement",
                    data={"account_id": str(accounts["checking"]), "file": (io.BytesIO(b"x"), "s.csv")},
                    content_type="multipart/form-data")
    assert r.status_code == 500 and "declined" in r.get_json()["error"]
    assert list(tmp_path.iterdir()) == []  # temp upload removed


def test_update_transaction_sets_last_modified_time(client, accounts):
    t = add_tx(accounts["checking"], "2025-06-01", -5, "groceries")
    r = client.put("/api/update-transaction", json={"transaction_id": t.transaction_id, "field": "category", "value": "restaurant"})
    assert r.status_code == 200
    updated = Transaction.query.get(t.transaction_id)
    assert updated.category == "restaurant"
    # set at edit time (it used to be frozen at server start)
    now = datetime.now(UTC).replace(tzinfo=None)
    assert updated.last_modified_time is not None
    assert now - timedelta(minutes=5) <= updated.last_modified_time <= now + timedelta(seconds=5)

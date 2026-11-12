"""
Extract transactions from bank/credit card statements (PDF or CSV) using Claude.

All statement text is masked with PrivacyFilter before it is sent to Claude.
Large CSV exports are split into chunks so each Claude response stays well
under the output token limit, and chunks are processed in parallel.
"""

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

import pdfplumber
from anthropic import Anthropic

from app.privacy_filter import PrivacyFilter

MODEL = "claude-sonnet-5-5"
# Extraction is simple pattern work, so keep thinking short
EFFORT = "low"
MAX_TOKENS = 16000
CSV_ROWS_PER_CHUNK = 100
CSV_MAX_PREAMBLE_LINES = 15
MAX_PARALLEL_REQUESTS = 4

ALLOWED_CATEGORIES = """paycheck, other income, transfer, credit card payment, marcus transfer, \
home mortgage, home, utilities, rent, auto, gas, parking, travel, restaurant, groceries, medical, amazon, \
walmart, shopping, subscriptions, donations, insurance, investments, taxes, personal care, \
entertainment, family & gifts, fees, other expenses

Category rules:
- paycheck: salary / payroll direct deposits.
- other income: other money received (tax refunds, people paying you back, deposits).
- credit card payment: paying a credit card bill, or a payment received on a credit card.
- home mortgage: mortgage payments to the loan servicer.
- marcus transfer: any transfer to or from the Marcus savings account.
- investments: money moved to or from brokerage, crypto or international
  money-transfer accounts.
- transfer: only money moved between the account holder's own bank accounts.
- taxes: tax payments and tax filing (IRS, state tax, tax software), government fees and licenses.
- personal care: haircuts, salons, nails, spa.
- entertainment: movies, games, events, parties, attractions.
- family & gifts: money sent to family members, and gifts.
- fees: card annual fees, bank fees, wire fees, interest and late fees.
- restaurant also covers snacks and vending machines.
- Payments to other people (Zelle, Venmo, etc.) are spending, never "transfer":
  use the category that fits the memo (parking, restaurant, home, travel, ...)
  or "other expenses"."""

# Optional account-specific hints (e.g. how your mortgage servicer or savings
# bank shows up on statements). Kept out of git so personal details stay local.
HINTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "category_hints.local.txt")


def category_rules():
    """Allowed categories and rules, plus local hints when the file exists."""
    try:
        with open(HINTS_FILE, encoding="utf-8") as f:
            hints = f.read().strip()
    except FileNotFoundError:
        hints = ""
    if not hints:
        return ALLOWED_CATEGORIES
    return ALLOWED_CATEGORIES + "\n\nAccount-specific hints:\n" + hints


OUTPUT_FORMAT = """{
    "statement_date": "YYYY-MM-DD or null",
    "account_balance": "numeric value or null",
    "transactions": [
        {
            "transaction_date": "YYYY-MM-DD",
            "description": "string",
            "amount": -123.45,
            "category": "string from allowed list"
        }
    ]
}"""

PDF_PROMPT = """RESPOND WITH VALID JSON ONLY - NO OTHER TEXT

Extract transactions from this credit card statement as JSON:

{output_format}

IMPORTANT:
- amount must be a NUMBER (not string), with no currency symbols or commas
- Sign convention: negative = money leaving the account (purchases, charges, fees,
  withdrawals, outgoing transfers and payments); positive = money coming in
  (deposits, refunds, credits, payments received on a credit card)

Allowed categories: {categories}

Statement text:
{text}"""

CSV_PROMPT = """RESPOND WITH VALID JSON ONLY - NO OTHER TEXT

Below is part of a transaction export (CSV) from a bank or credit card account.
The first lines are the file's header/summary for context; extract transactions
only from the rows under "TRANSACTION ROWS". Return JSON in this format:

{output_format}

IMPORTANT:
- Return exactly one transaction per transaction row. Do not merge, drop or invent rows.
- Skip rows that are not transactions (column headers, beginning/ending balance lines, totals).
- transaction_date: use the transaction date (not the posted date) when both are present.
- amount must be a NUMBER (not string), with no currency symbols or commas.
- Sign convention: negative = money leaving the account (purchases, charges, fees,
  withdrawals, outgoing transfers and payments); positive = money coming in
  (deposits, refunds, credits, payments received on a credit card).
  CSV exports use different conventions (separate Debit/Credit columns, or a signed
  Amount column) - convert them to this convention.
- description: keep the merchant/description text as it appears in the row.
- statement_date: the latest transaction date in these rows.
- account_balance: the ending balance only if the header explicitly states one, otherwise null.

Allowed categories: {categories}

HEADER / SUMMARY LINES:
{preamble}

TRANSACTION ROWS:
{rows}"""

DATE_AT_START = re.compile(r'^\s*"?(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})')


def is_supported_file(filename):
    return filename.lower().endswith((".pdf", ".csv"))


def extract_transactions(file_path, api_key):
    """
    Extract transactions from a PDF or CSV statement.

    Returns:
        dict with "statement_date", "account_balance" and "transactions".
    """
    client = Anthropic(api_key=api_key)
    privacy_filter = PrivacyFilter()

    if file_path.lower().endswith(".csv"):
        return _extract_from_csv(client, privacy_filter, file_path)
    return _extract_from_pdf(client, privacy_filter, file_path)


def _extract_from_pdf(client, privacy_filter, pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        raise Exception(f"Error reading PDF: {str(e)}")

    text = privacy_filter.hash_sensitive_data(text)
    prompt = PDF_PROMPT.format(
        output_format=OUTPUT_FORMAT, categories=category_rules(), text=text
    )
    return _ask_claude(client, prompt)


def _read_text(path):
    with open(path, "rb") as f:
        raw = f.read()
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise Exception("Could not decode CSV file")


def split_csv(text, rows_per_chunk=CSV_ROWS_PER_CHUNK):
    """
    Split a CSV export into (preamble, [row_chunks]).

    The preamble is everything before the first line that starts with a date
    (column headers, and summary blocks such as beginning/ending balance).
    It is repeated with every chunk so Claude knows what each column means.
    """
    lines = [line for line in text.splitlines() if line.strip()]
    first_row = next(
        (i for i, line in enumerate(lines) if DATE_AT_START.match(line)), None
    )
    if first_row is None:
        raise Exception("No transaction rows found in CSV")

    preamble = lines[:first_row][-CSV_MAX_PREAMBLE_LINES:]

    # Group lines into records: a record starts with a date, and lines that
    # don't (e.g. multi-line address fields in Amex exports) belong to the
    # previous record. Chunks are cut on record boundaries only.
    records = []
    for line in lines[first_row:]:
        if DATE_AT_START.match(line) or not records:
            records.append(line)
        else:
            records[-1] += "\n" + line
    chunks = [
        records[i : i + rows_per_chunk] for i in range(0, len(records), rows_per_chunk)
    ]
    return "\n".join(preamble), ["\n".join(chunk) for chunk in chunks]


def _extract_from_csv(client, privacy_filter, csv_path):
    text = privacy_filter.hash_sensitive_data(_read_text(csv_path))
    preamble, chunks = split_csv(text, CSV_ROWS_PER_CHUNK)

    rules = category_rules()
    prompts = [
        CSV_PROMPT.format(
            output_format=OUTPUT_FORMAT,
            categories=rules,
            preamble=preamble or "(none)",
            rows=chunk,
        )
        for chunk in chunks
    ]
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_REQUESTS) as pool:
        results = list(pool.map(lambda p: _ask_claude(client, p), prompts))

    transactions = [t for result in results for t in result["transactions"]]
    statement_dates = [r.get("statement_date") for r in results if r.get("statement_date")]
    balances = [r.get("account_balance") for r in results if r.get("account_balance") is not None]
    return {
        "statement_date": max(statement_dates) if statement_dates else None,
        "account_balance": balances[0] if balances else None,
        "transactions": transactions,
    }


def _ask_claude(client, prompt):
    try:
        # The pinned anthropic SDK (0.45.x) predates output_config and
        # fallbacks, so they are sent as raw request fields.
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
            extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"},
            extra_body={"output_config": {"effort": EFFORT}, "fallbacks": "default"},
        )
    except Exception as e:
        raise Exception(f"Error processing with Claude: {str(e)}")

    if message.stop_reason == "refusal":
        raise Exception("Claude declined to process this statement")
    if message.stop_reason == "max_tokens":
        raise Exception(
            "Claude's response was cut off (too many transactions in one request)"
        )

    response = "".join(b.text for b in message.content if b.type == "text").strip()
    # Remove markdown code fences if present
    if response.startswith("```json"):
        response = response[7:]
    elif response.startswith("```"):
        response = response[3:]
    if response.endswith("```"):
        response = response[:-3]

    try:
        data = json.loads(response.strip())
    except json.JSONDecodeError as e:
        raise Exception(f"Claude returned invalid JSON: {str(e)}")

    if not isinstance(data, dict) or not isinstance(data.get("transactions"), list):
        raise Exception("Claude response is missing the transactions list")
    return data

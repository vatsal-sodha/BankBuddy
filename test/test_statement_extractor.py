"""CSV chunking and Claude-response handling. No real API calls: Claude is replaced by a fake client."""

from types import SimpleNamespace

import pytest

from app import statement_extractor as se


# ---------- file types ----------

@pytest.mark.parametrize("name,ok", [
    ("statement.pdf", True), ("export.CSV", True), ("Chase_Activity.csv", True),
    ("notes.txt", False), ("statement.pdf.exe", False), ("csv", False),
])
def test_is_supported_file(name, ok):
    assert se.is_supported_file(name) is ok


# ---------- CSV splitting ----------

def test_split_csv_keeps_header_as_preamble_and_chunks_by_row():
    rows = [f"01/{d:02d}/2025,SHOP {d},-{d}.00" for d in range(1, 26)]
    preamble, chunks = se.split_csv("Date,Description,Amount\n" + "\n".join(rows), rows_per_chunk=10)
    assert preamble == "Date,Description,Amount"
    assert [c.count("\n") + 1 for c in chunks] == [10, 10, 5]
    assert chunks[0].startswith("01/01/2025") and chunks[-1].endswith("SHOP 25,-25.00")


def test_split_csv_keeps_summary_block_before_first_row():
    text = (
        'Description,,Summary Amt.\n'
        'Beginning balance as of 05/01/2025,,"1,000.00"\n'
        'Ending balance as of 12/31/2025,,"2,000.00"\n'
        '\n'
        'Date,Description,Amount,Running Bal.\n'
        '05/02/2025,"DEPOSIT","100.00","1,100.00"\n'
    )
    preamble, chunks = se.split_csv(text)
    assert "Ending balance" in preamble and "Date,Description" in preamble
    assert chunks == ['05/02/2025,"DEPOSIT","100.00","1,100.00"']


def test_split_csv_never_cuts_a_multiline_record():
    """Amex exports put addresses on several lines inside one quoted field."""
    records = [
        f'12/{d:02d}/2025,MERCHANT {d},{d}.00,"DETAILS\nLINE TWO\nLINE THREE",ADDR\nCITY,TX'
        for d in range(1, 8)
    ]
    _, chunks = se.split_csv("Date,Description,Amount,Extended Details,Address\n" + "\n".join(records), rows_per_chunk=3)
    assert len(chunks) == 3
    for chunk in chunks:
        assert se.DATE_AT_START.match(chunk.splitlines()[0])  # every chunk starts on a record
    joined = "\n".join(chunks)
    assert all(f"MERCHANT {d}," in joined for d in range(1, 8))
    assert joined.count("LINE THREE") == 7


def test_split_csv_without_rows_raises():
    with pytest.raises(Exception, match="No transaction rows"):
        se.split_csv("Date,Description,Amount\n")


# ---------- Claude response handling ----------

class FakeClient:
    """Stands in for anthropic.Anthropic; records requests and returns canned replies."""

    def __init__(self, text='{"transactions": []}', stop_reason="end_turn"):
        self.calls = []
        self._text, self._stop = text, stop_reason
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        text = self._text(kwargs) if callable(self._text) else self._text
        return SimpleNamespace(
            stop_reason=self._stop,
            content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)],
        )


def test_ask_claude_parses_json_inside_code_fences():
    client = FakeClient('```json\n{"statement_date": "2025-12-31", "account_balance": null, "transactions": [{"amount": -1}]}\n```')
    data = se._ask_claude(client, "prompt")
    assert data["transactions"] == [{"amount": -1}]
    req = client.calls[0]
    assert req["model"] == se.MODEL == "claude-sonnet-5-5"
    assert req["extra_body"]["output_config"]["effort"] == se.EFFORT


@pytest.mark.parametrize("stop,msg", [("max_tokens", "cut off"), ("refusal", "declined")])
def test_ask_claude_raises_on_truncated_or_refused_reply(stop, msg):
    with pytest.raises(Exception, match=msg):
        se._ask_claude(FakeClient(stop_reason=stop), "prompt")


@pytest.mark.parametrize("text", ["not json", '{"no_transactions": 1}', "[]"])
def test_ask_claude_rejects_bad_payloads(text):
    with pytest.raises(Exception):
        se._ask_claude(FakeClient(text), "prompt")


def test_csv_extraction_masks_data_merges_chunks_and_picks_latest_date(tmp_path, monkeypatch):
    monkeypatch.setattr(se, "CSV_ROWS_PER_CHUNK", 2)
    csv = tmp_path / "bank.csv"
    csv.write_text(
        "Date,Description,Amount\n"
        '01/02/2025,"CARD ISSUER DES:EPAY ID:1234500001 INDN:JANE DOE CO ID:9876500002 WEB",-10.00\n'
        "01/05/2025,GROCERY,-20.00\n"
        "02/01/2025,PAYROLL,100.00\n"
    )

    def reply(kwargs):
        prompt = kwargs["messages"][0]["content"]
        assert "JANE" not in prompt and "1234500001" not in prompt  # masked before sending
        day = "2025-02-01" if "PAYROLL" in prompt else "2025-01-05"
        return '{"statement_date": "%s", "account_balance": null, "transactions": [{"x": "%s"}]}' % (day, day)

    client = FakeClient(reply)
    monkeypatch.setattr(se, "Anthropic", lambda api_key: client)
    data = se.extract_transactions(str(csv), "key")

    assert len(client.calls) == 2  # 3 rows, 2 per chunk
    assert len(data["transactions"]) == 2
    assert data["statement_date"] == "2025-02-01"
    assert data["account_balance"] is None


# ---------- local category hints ----------

def test_category_rules_without_local_hints(tmp_path, monkeypatch):
    monkeypatch.setattr(se, "HINTS_FILE", str(tmp_path / "missing.local.txt"))
    assert se.category_rules() == se.ALLOWED_CATEGORIES


def test_category_rules_appends_local_hints(tmp_path, monkeypatch):
    hints = tmp_path / "category_hints.local.txt"
    hints.write_text("- home mortgage: payments to EXAMPLE SERVICER.\n")
    monkeypatch.setattr(se, "HINTS_FILE", str(hints))
    rules = se.category_rules()
    assert rules.startswith(se.ALLOWED_CATEGORIES)
    assert "Account-specific hints:" in rules and "EXAMPLE SERVICER" in rules

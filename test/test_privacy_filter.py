"""PrivacyFilter must strip personal data but keep what extraction needs (dates, amounts, merchants)."""

import re

import pytest

from app.privacy_filter import PrivacyFilter


@pytest.fixture
def pf(monkeypatch):
    monkeypatch.setenv("PRIVACY_MASK_TERMS", "Jane,Doe")
    return PrivacyFilter()


def test_masks_ach_account_holder_name(pf):
    line = '05/12/2025,"CARD ISSUER DES:EPAY ID:1234500001 INDN:JANE DOE CO ID:9876500002 WEB","-44.00","1,000.00"'
    out = pf.hash_sensitive_data(line)
    assert "JANE" not in out and "DOE" not in out
    assert "INDN:**** CO ID:****" in out


def test_masks_ach_name_containing_a_comma(pf):
    out = pf.hash_sensitive_data('"STATE TAX DES:REFUND ID:123 INDN:DOE, JANE & JOHN CO ID:99 PPD"')
    assert "JOHN" not in out and "INDN:**** CO ID:" in out


def test_masks_zelle_payees_and_confirmation_codes(pf):
    for line, payee in [
        ('"Zelle payment to JOHN SMITH Conf# abc123"', "JOHN SMITH"),
        ('"Zelle Recurring payment to MARY ROE for "Parking"; Conf# xyz789"', "MARY ROE"),
        ('"Zelle payment from PAT LEE for "dinner"; Conf# q1w2e3"', "PAT LEE"),
    ]:
        out = pf.hash_sensitive_data(line)
        assert payee not in out
        assert "Conf# ****" in out
    # the memo survives - it is what tells Claude the category
    assert '"Parking"' in pf.hash_sensitive_data('"Zelle Recurring payment to MARY ROE for "Parking"; Conf# x"')


def test_masks_extra_terms_case_insensitively(pf):
    out = pf.hash_sensitive_data('Zelle memo "jane doe holiday party fees"')
    assert not re.search("jane|doe", out, re.I)


def test_masks_long_numbers_and_contact_details(pf):
    out = pf.hash_sensitive_data("card 4111 1111 1111 1111 ref 1234567890123456789 mail a.b@example.com call 555-555-0100")
    assert "4111" not in out and "1234567890123456789" not in out
    assert "example.com" not in out and "555" not in out


def test_keeps_dates_amounts_and_merchants(pf):
    line = '12/28/2025,12/29/2025,AMAZON.COM*ABC123XYZ,Shopping,Sale,"-1,234.56",'
    out = pf.hash_sensitive_data(line)
    assert "12/28/2025" in out and "12/29/2025" in out
    assert "-1,234.56" in out and "AMAZON.COM" in out


def test_empty_text_is_returned_unchanged(pf):
    assert pf.hash_sensitive_data("") == ""
    assert pf.hash_sensitive_data(None) is None

import os
import re


class PrivacyFilter:
    """Handles privacy protection for sensitive financial data"""

    def __init__(self):
        # Patterns for sensitive data
        self.patterns = {
            'credit_card': r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
            'account_number': r'\b\d{8,12}\b',  # typical account number lengths
            'long_reference': r'\b\d{13,}\b',  # card/ticket/reference numbers
            'ssn': r'\b\d{3}[-]?\d{2}[-]?\d{4}\b',
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'phone': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        }
        # Bank transaction descriptions that carry names or reference IDs, e.g.
        #   "... ID:1234500001 INDN:JANE DOE CO ID:123 WEB"
        #   "Zelle payment to JOHN SMITH Conf# abc123"
        #   "... PMT INFO:NTE*... JANE DOE"
        self.description_patterns = [
            (re.compile(r'(INDN:)[^"\n]*?(?=\s+CO ID:|"|$)', re.MULTILINE), r'\1****'),
            (re.compile(r'(PMT INFO:)[^"\n]*', re.MULTILINE), r'\1****'),
            (re.compile(r'(\bID:)[^\s,"]+'), r'\1****'),
            (re.compile(r'(Zelle (?:Recurring )?(?:payment|transfer) (?:to|from) ).*?(?=\s+Conf#|\s+for\b|"|$)',
                        re.IGNORECASE | re.MULTILINE), r'\1****'),
            (re.compile(r'(Conf#\s*)\S+'), r'\1****'),
        ]
        # Extra comma-separated terms to mask (e.g. your name), from .env
        terms = os.getenv("PRIVACY_MASK_TERMS", "")
        self.extra_terms = [t.strip() for t in terms.split(",") if t.strip()]

    def hash_sensitive_data(self, text):
        """Mask sensitive data before it leaves the machine"""
        if not text:
            return text

        redacted = text
        for pattern, replacement in self.description_patterns:
            redacted = pattern.sub(replacement, redacted)
        for term in self.extra_terms:
            redacted = re.sub(re.escape(term), "****", redacted, flags=re.IGNORECASE)
        for _, pattern in self.patterns.items():
            redacted = re.sub(pattern, "****", redacted)
        return redacted

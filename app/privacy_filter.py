import re


class PrivacyFilter:
    """Handles privacy protection for sensitive financial data"""
    
    def __init__(self):
        # Patterns for sensitive data
        self.patterns = {
            'credit_card': r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
            'account_number': r'\b\d{8,12}\b',  # typical account number lengths
            'ssn': r'\b\d{3}[-]?\d{2}[-]?\d{4}\b',
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'phone': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        }
        
    def hash_sensitive_data(self, text):
        """Hash sensitive data while optionally preserving last 4 digits"""
        if not text:
            return text
                
        redacted = text
        for _, pattern in self.patterns.items():
            redacted = re.sub(pattern, "****", redacted)
        return redacted
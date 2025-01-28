import re

def convert_to_float(amount_str):
    # Remove any characters that are not digits, decimal points, or minus signs
    cleaned_str = re.sub(r'[^\d.-]', '', amount_str)
    try:
        return float(cleaned_str)
    except ValueError:
        raise ValueError(f"Invalid amount string: {amount_str}")


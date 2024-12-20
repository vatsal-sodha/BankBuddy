transaction_headers = {'Date', 'Description', 'Amount', 
                       'Balance', 'Transaction Type', 
                       'Category', 'Trans Date', 'Post Date'}

def is_transactions_table(headers):
    return any(
        isinstance(header, str) and any(th.lower() in header.lower() for th in transaction_headers)
        for header in headers
    )

def is_valid_transactions_table(table_df):
    if not table_df.empty or table_df.columns.size > 0 :
        headers = table_df.columns  # First row is assumed to be the header
        return is_transactions_table(headers)
    return False



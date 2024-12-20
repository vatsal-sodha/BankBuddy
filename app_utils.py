transaction_headers = {'Date', 'Description', 'Amount', 
                       'Balance', 'Transaction Type', 
                       'Category', 'Trans Date', 'Post Date'}

def is_transactions_table(headers):
    return any(header in headers for header in transaction_headers)

def is_valid_transactions_table(table_df):
    headers = table_df[0]  # First row is assumed to be the header
    return is_transactions_table(headers)



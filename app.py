from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from docling.document_converter import DocumentConverter
import pandas as pd

app = Flask(__name__)
CORS(app)

# Directory to temporarily store uploaded files
UPLOAD_FOLDER = './uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/upload-pdf', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith('.pdf'):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    # Save the file temporarily
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    print(file.filename)
    converter = DocumentConverter()
    result = converter.convert(file.filename)
    df = list()
    for table_ix, table in enumerate(result.document.tables):
        table_df: pd.DataFrame = table.export_to_dataframe()
        df.append(table_df)
    return jsonify({"message": "file received"})

    # try:
    #     # Extract text from the PDF
    #     reader = PdfReader(file_path)
    #     text = ""
    #     for page in reader.pages:
    #         text += page.extract_text() + "\n"

    #     # Delete the file after processing
    #     os.remove(file_path)

    #     return jsonify({"message": "PDF processed successfully.", "text": text})
    # except Exception as e:
    #     return jsonify({"error": f"An error occurred while reading the PDF: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)

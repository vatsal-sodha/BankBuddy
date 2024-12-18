import React, { useState } from 'react';
import axios from 'axios';


const UploadPDF = () => {
    const [file, setFile] = useState(null);
    const [response, setResponse] = useState("");

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) {
            alert("Please select a PDF file to upload.");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('http://127.0.0.1:5000/upload-pdf', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setResponse(res.data.message || "File uploaded and processed successfully.");
        } catch (error) {
            console.error("Error uploading PDF:", error);
            setResponse("An error occurred while uploading the PDF.");
        }
    };

    return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
            <h1>Upload PDF</h1>
            <input type="file" accept="application/pdf" onChange={handleFileChange} />
            <button onClick={handleUpload} style={{ marginLeft: "10px" }}>Upload</button>
            <div style={{ marginTop: "20px" }}>
                <strong>Response:</strong> <p>{response}</p>
            </div>
        </div>
    );
};

export default UploadPDF;

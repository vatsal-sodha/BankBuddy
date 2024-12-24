import React, { useState } from 'react';
import {Button, Typography} from '@mui/material/';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

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
            const response = await fetch('http://127.0.0.1:5000/upload-pdf', {
                method: 'POST',
                body: formData,
            })
            if (response.ok) {
                alert('File uploaded successfully!');
                setFile(null);
              } else {
                throw new Error('Upload failed');
              }
        } catch (error) {
            console.error("Error uploading PDF:", error);
            setResponse("An error occurred while uploading the PDF.");
        }
    };

    return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
            <h1>Upload PDF</h1>
            <Button
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUploadIcon />}
            onchange={handleFileChange}
            >
            <input type="file" accept="application/pdf" onChange={handleFileChange} hidden/> 
            Choose files
            </Button>
            <Typography variant="body2">
            {file && <span>{file.name}</span>}</Typography>
            <br/>
            <Button variant="contained" onClick={handleUpload} style={{ margin: "20px" }}>Upload</Button>
            <div style={{ marginTop: "20px" }}>
                <strong>Response:</strong> <p>{response}</p>
            </div>
        </div>
    );
};

export default UploadPDF;

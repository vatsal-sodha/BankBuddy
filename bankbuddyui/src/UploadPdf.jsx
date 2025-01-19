import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    CircularProgress,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Toast from './Toast';

const UploadPDF = ({ open, onClose }) => {
    const [selectedAccount, setSelectedAccount] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState({
        open: false,
        message: '',
        severity: 'success'
    });
    const handleToastClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast({ ...toast, open: false });
    };
    const handleAccountChange = (event) => {
        setSelectedAccount(event.target.value);
    };

    const [file, setFile] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file || !selectedAccount) {
            setToast({
                open: true,
                message: "Please select both an account and a PDF file",
                severity: 'warning'
            });
            return;
        }

        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('account_id', selectedAccount);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/upload-statement', {
                method: 'POST',
                body: formData,
            });

            const responseData = await response.json();

            if (response.ok) {
                setToast({
                    open: true,
                    message: responseData.message,
                    severity: 'success'
                });
                setFile(null);
                setSelectedAccount('');
                onClose();
            } else {
                throw new Error(responseData.error || 'Upload failed');
            }
        } catch (error) {
            console.error("Error uploading PDF:", error);
            setToast({
                open: true,
                message: "Failed to upload PDF",
                severity: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };
    // Fetch accounts on component mount
    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/get-all-accounts');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch accounts');
                }

                setAccounts(data); // Update state with fetched accounts
            } catch (error) {
                setToast({
                    open: true,
                    message: "Failed to fetch accounts",
                    severity: 'error',
                });
            }
        }; fetchAccounts();
    }, []); // Empty dependency array ensures this runs once on mount


    return (
        <Box>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <form onSubmit={handleSubmit}>
                    <DialogTitle>Upload Bank Statement</DialogTitle>
                    <DialogContent>
                        <FormControl fullWidth required sx={{ mb: 2 }}>
                            <InputLabel>Account</InputLabel>
                            <Select
                                name="account_type"
                                value={selectedAccount}
                                label="Account"
                                onChange={handleAccountChange}
                            >
                                {accounts.map((account) => (
                                    <MenuItem key={account.account_id} value={account.account_id}>{account.name + "-" + account.last_4_digits}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <div>
                            <Button
                                component="label"
                                variant="contained"
                                startIcon={<CloudUploadIcon />}
                                sx={{ mb: 2 }}
                            >
                                Upload PDF
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleFileChange}
                                    hidden
                                />
                            </Button>
                            {file && (
                                <Typography variant="body2" sx={{ ml: 1 }}>
                                    Selected file: {file.name}
                                </Typography>
                            )}
                        </div>

                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={onClose}
                            disabled={isLoading}
                        >Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                            disabled={!file || !selectedAccount || isLoading}>
                            {isLoading ? 'Uploading...' : 'Submit'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
            <Toast
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={handleToastClose}
            />
        </Box>

    );
};

export default UploadPDF;

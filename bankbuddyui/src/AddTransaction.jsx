import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    CircularProgress,
    Autocomplete,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
} from '@mui/material';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Toast from './Toast';

const AddTransaction = ({ open, onClose, categories }) => {
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        account_id: '',
        transaction_date: null,
        description: '',
        category: '',
        amount: ''
    });
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

    const handleDateChange = (date) => {
        setFormData((prevState) => ({
            ...prevState,
            transaction_date: date ? dayjs(date) : null,
        }));
    };


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/add-transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    account_id: formData.account_id,
                    transaction_date: formData.transaction_date ? formData.transaction_date.toISOString() : null,
                    description: formData.description,
                    category: formData.category,
                    amount: formData.amount,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to add transaction');
            }

            setToast({
                open: true,
                message: 'Transaction added successfully!',
                severity: 'success',
            });

            onClose(); // Close the dialog on success
        } catch (error) {
            setToast({
                open: true,
                message: error.message,
                severity: 'error',
            });
        } finally {
            setIsLoading(false);
        }
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
                    <DialogTitle>Add Transaction</DialogTitle>
                    <DialogContent>
                        <FormControl fullWidth required sx={{ mb: 2 }}>
                            <InputLabel>Account</InputLabel>
                            <Select
                                name="account_id"
                                value={formData.account_id}
                                label="Account"
                                onChange={handleChange}
                            >
                                {accounts.map((account) => (
                                    <MenuItem key={account.account_id} value={account.account_id}>{account.name + "-" + account.last_4_digits}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth required sx={{ mb: 2 }}>
                            <Autocomplete
                                options={categories}
                                getOptionLabel={(option) => option}
                                value={formData.category}
                                onChange={(event, newValue) => {
                                    setFormData((prevState) => ({
                                        ...prevState,
                                        category: newValue || '',
                                    }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Category"
                                        variant="outlined"
                                        required
                                    />
                                )}
                            />
                        </FormControl>

                        <TextField
                            autoFocus
                            margin="dense"
                            name="description"
                            label="Description"
                            type="text"
                            fullWidth
                            value={formData.description}
                            onChange={handleChange}
                            required
                            sx={{ mb: 2 }}
                        />

                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                sx={{ mb: 2 }}
                                label="Transaction Date"
                                value={formData.transaction_date}
                                onChange={handleDateChange}
                                renderInput={(params) => (
                                    <TextField {...params} fullWidth required sx={{ mb: 2 }} />
                                )}
                            />
                        </LocalizationProvider>
                        <TextField
                            name="amount"
                            label="Amount"
                            type="number"
                            fullWidth
                            value={formData.amount}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value).toFixed(2);
                                setFormData((prevState) => ({
                                    ...prevState,
                                    amount: value,
                                }));
                            }}
                            required
                            sx={{ mb: 2 }}
                            inputProps={{ step: '0.01', min: '0' }}
                        />

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
                            disabled={isLoading}>
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
    )

}
export default AddTransaction;
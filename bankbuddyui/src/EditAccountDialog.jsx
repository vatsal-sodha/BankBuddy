import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    Select,
    MenuItem,
    InputLabel
} from '@mui/material';

const EditAccountDialog = ({ open, account, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        account_name: '',
        institution: '',
        account_type: '',
        last_4_digits: ''
    });

    useEffect(() => {
        if (account) {
            setFormData({
                account_name: account.name,
                institution: account.institution || '',
                account_type: account.type,
                last_4_digits: account.last_4_digits
            });
        }
    }, [account]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>Edit Account</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="account_name"
                        label="Account Name"
                        type="text"
                        fullWidth
                        value={formData.account_name}
                        onChange={handleChange}
                        required
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        name="institution"
                        label="Institution"
                        type="text"
                        fullWidth
                        value={formData.institution}
                        onChange={handleChange}
                        required
                        sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth required sx={{ mb: 2 }}>
                        <InputLabel>Account Type</InputLabel>
                        <Select
                            name="account_type"
                            value={formData.account_type}
                            label="Account Type"
                            onChange={handleChange}
                        >
                            <MenuItem value="credit/debit">Credit/Debit Card</MenuItem>
                            <MenuItem value="checking/savings">Checking/Savings Account</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        margin="dense"
                        name="last_4_digits"
                        label="Last 4 Digits"
                        type="text"
                        fullWidth
                        value={formData.last_4_digits}
                        onChange={handleChange}
                        required
                        inputProps={{
                            maxLength: 4,
                            pattern: "[0-9]*"
                        }}
                        helperText="Enter the last 4 digits of your account"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained" color="primary">
                        Save Changes
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default EditAccountDialog;
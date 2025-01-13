import { React, useState, useEffect } from 'react';
import { Button, Box, Card, CardContent, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AddAccountDialog from './AddAcountDialog';
import Toast from './Toast';
import Grid from '@mui/material/Grid2';

const AccountsTab = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [toast, setToast] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

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
        };

        fetchAccounts();
    }, []); // Empty dependency array ensures this runs once on mount

    const handleClickOpen = () => {
        setOpenDialog(true);
    };

    const handleClose = () => {
        setOpenDialog(false);
    };

    const handleToastClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast({ ...toast, open: false });
    };

    const handleSubmit = async (formData) => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/create-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create account');
            }

            // Show success toast
            setToast({
                open: true,
                message: data.message || 'Account created successfully!',
                severity: 'success'
            });

            setOpenDialog(false);

            // Update the local accounts state
            const newAccount = {
                account_id: data.account_id, // Ensure the backend returns the new account's ID
                name: formData.account_name,
                institution: formData.institution || 'N/A',
                type: formData.type,
                last_4_digits: formData.last_4_digits,
                created_date: new Date().toISOString(),
                last_modified_date: new Date().toISOString(),
            };

            setAccounts((prevAccounts) => [...prevAccounts, newAccount]); // Add the new account to the list

        } catch (error) {
            // Show error toast
            setToast({
                open: true,
                message: error.message,
                severity: 'error'
            });
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleClickOpen}
                >
                    Add Account
                </Button>
            </Box>
            <Grid container spacing={2}>
                {accounts.map((account) => (
                    <Grid item xs={12} sm={6} md={4} key={account.account_id}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6">{account.name}</Typography>
                                <Typography variant="body2">
                                    Institution: {account.institution || 'N/A'}
                                </Typography>
                                <Typography variant="body2">
                                    Type: {account.type}
                                </Typography>
                                <Typography variant="body2">
                                    Last 4 Digits: {account.last_4_digits}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
            <AddAccountDialog
                open={openDialog}
                onClose={handleClose}
                onSubmit={handleSubmit}
            />
            <Toast
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={handleToastClose}
            />
            {/* Add your accounts list/grid here */}
        </Box>
    );
};

export default AccountsTab;
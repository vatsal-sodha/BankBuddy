import { React, useState, useEffect } from 'react';
import { Button, Box, Card, CardContent, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AddAccountDialog from './AddAcountDialog';
import Toast from './Toast';
import AccountsTable from './AcountsTable';
import EditAccountDialog from './EditAccountDialog';

const AccountsTab = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [editDialog, setEditDialog] = useState({ open: false, account: null });
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

    const showToast = (message, severity = 'success') => {
        setToast({ open: true, message, severity });
    };

    const handleToastClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast({ ...toast, open: false });
    };

    const handleEdit = async (formData) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/edit-account/${editDialog.account.account_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setAccounts(accounts.map(acc =>
                acc.account_id === editDialog.account.account_id ? data.account : acc
            ));
            showToast('Account updated successfully');
            setEditDialog({ open: false, account: null });
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const handleDelete = async (accountId) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/delete-account/${accountId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setAccounts(accounts.filter(acc => acc.account_id !== accountId));
            showToast('Account deleted successfully');
        } catch (error) {
            showToast(error.message, 'error');
        }
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
            <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    {/* <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenAddDialog(true)}
                    >
                        Add Account
                    </Button> */}
                </Box>

                <AccountsTable
                    accounts={accounts}
                    onEdit={(account) => setEditDialog({ open: true, account })}
                    onDelete={handleDelete}
                />

                <EditAccountDialog
                    open={editDialog.open}
                    account={editDialog.account}
                    onClose={() => setEditDialog({ open: false, account: null })}
                    onSubmit={handleEdit}
                />
            </Box>
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
        </Box>
    );
};

export default AccountsTab;
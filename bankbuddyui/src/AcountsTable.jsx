import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const AccountsTable = ({ accounts, onEdit, onDelete }) => {
    const [deleteDialog, setDeleteDialog] = useState({ open: false, accountId: null });

    const handleDeleteClick = (accountId) => {
        setDeleteDialog({ open: true, accountId });
    };

    const handleDeleteConfirm = () => {
        if (deleteDialog.accountId) {
            onDelete(deleteDialog.accountId);
        }
        setDeleteDialog({ open: false, accountId: null });
    };

    const getBalanceColor = (type, balance) => {
        const numBalance = parseFloat(balance);

        if (type?.includes('checking') || type?.includes('savings')) {
            return numBalance >= 0 ? 'success.main' : 'error.main';
        } else if (type?.includes('credit') || type?.includes('debit')) {
            return numBalance <= 0 ? 'success.main' : 'error.main';
        }
        return 'text.primary';
    };

    const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(numAmount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Institution</TableCell>
                            <TableCell>Account Type</TableCell>
                            <TableCell>Balance</TableCell>
                            <TableCell>Recent Statmenet Date</TableCell>
                            {/* <TableCell>Last 4 Digits</TableCell> */}
                            {/* <TableCell align="right">Actions</TableCell> */}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {accounts.map((account) => (
                            <TableRow key={account.account_id}>
                                <TableCell>{account.name} - {account.last_4_digits}</TableCell>
                                <TableCell>{account.institution || 'N/A'}</TableCell>
                                <TableCell>{account.type}</TableCell>
                                <TableCell sx={{ color: getBalanceColor(account.type, account.balance) }}>
                                    {formatCurrency(account.balance)}
                                </TableCell>
                                <TableCell>{formatDate(account.last_statement_date)}</TableCell>
                                <TableCell align="right">
                                    <IconButton
                                        color="primary"
                                        onClick={() => onEdit(account)}
                                        size="small"
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        color="error"
                                        onClick={() => handleDeleteClick(account.account_id)}
                                        size="small"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog
                open={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, accountId: null })}
            >
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    Are you sure you want to delete this account? This action cannot be undone.
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, accountId: null })}>
                        Cancel
                    </Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default AccountsTable;
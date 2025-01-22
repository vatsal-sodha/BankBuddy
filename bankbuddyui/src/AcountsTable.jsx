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

    return (
        <>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Institution</TableCell>
                            <TableCell>Account Type</TableCell>
                            <TableCell>Last 4 Digits</TableCell>
                            {/* <TableCell align="right">Actions</TableCell> */}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {accounts.map((account) => (
                            <TableRow key={account.account_id}>
                                <TableCell>{account.name}</TableCell>
                                <TableCell>{account.institution || 'N/A'}</TableCell>
                                <TableCell>{account.type}</TableCell>
                                <TableCell>{account.last_4_digits}</TableCell>
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
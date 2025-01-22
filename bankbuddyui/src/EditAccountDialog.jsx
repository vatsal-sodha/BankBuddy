import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid
} from '@mui/material';

const EditAccountDialog = ({ open, account, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        institution: '',
        type: '',
        last_4_digits: ''
    });

    useEffect(() => {
        if (account) {
            setFormData({
                name: account.name,
                institution: account.institution || '',
                type: account.type,
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
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                label="Account Name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Institution"
                                name="institution"
                                value={formData.institution}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                label="Account Type"
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                label="Last 4 Digits"
                                name="last_4_digits"
                                value={formData.last_4_digits}
                                onChange={handleChange}
                                inputProps={{
                                    maxLength: 4,
                                    pattern: '[0-9]{4}'
                                }}
                            />
                        </Grid>
                    </Grid>
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
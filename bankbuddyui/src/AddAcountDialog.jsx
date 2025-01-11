import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';

const AddAccountDialog = ({ open, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    account_name: '',
    institution: '',
    account_type: '',
    last_4_digits: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      account_name: '',
      institution: '',
      account_type: '',
      last_4_digits: ''
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Add New Account</DialogTitle>
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
            defaultValue="Chase, Bank of America, etc"
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
          <Button type="submit" variant="contained">Submit</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddAccountDialog;
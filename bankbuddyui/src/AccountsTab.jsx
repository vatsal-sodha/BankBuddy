import React from 'react';
import { Button, Paper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const AccountsTab = () => {
  return (
    // <Paper sx={{ p: 2 }}>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        sx={{ mb: 2 }}
      >
        Add Account
      </Button>
    //   {/* Add your accounts list/grid here */}
    // </Paper>
  );
};

export default AccountsTab;
import {React, useState} from 'react';
import { Button, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AddAccountDialog from './AddAcountDialog';

const AccountsTab = () => {
    const [openDialog, setOpenDialog] = useState(false);

    const handleClickOpen = () => {
      setOpenDialog(true);
    };
  
    const handleClose = () => {
      setOpenDialog(false);
    };

    const handleSubmit = (formData) => {
        console.log('Form submitted:', formData);
        // Here you would typically send the data to your backend
        setOpenDialog(false);
      };
    return (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleClickOpen}
        >
            Add Account
        </Button>
        <AddAccountDialog
            open={openDialog}
            onClose={handleClose}
            onSubmit={handleSubmit}
        />
        {/* Add your accounts list/grid here */}
        </Box>
  );
};

export default AccountsTab;
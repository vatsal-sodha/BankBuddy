
import React, { useState, useEffect } from 'react';
import { Paper, Box, Button } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadPDF from './UploadPdf';

// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-material.css';
const TransactionsTab = () => {
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [toast, setToast] = useState({
          open: false,
          message: '',
          severity: 'success'
        });

    const handleClickOpen = () => {
      setOpenDialog(true);
    };
    const handleClose = () => {
      setOpenDialog(false);
    };
    // Sample data for AG Grid
    const [rowData] = useState([
      { date: '2024-01-09', description: 'Grocery Shopping', amount: -50.00, category: 'Food' },
      { date: '2024-01-08', description: 'Salary', amount: 3000.00, category: 'Income' },
    ]);
  
    // AG Grid column definitions
    const [columnDefs] = useState([
      { field: 'date', filter: true },
      { field: 'description', filter: true },
      { field: 'amount', filter: true },
      { field: 'category', filter: true }
    ]);
  
    return (
      // <Paper sx={{  }}>
      <Box>
        <Box sx={{ display: 'flex'}}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="From Date"
                value={fromDate}
                onChange={setFromDate}
              />
              <DatePicker
                label="To Date"
                value={fromDate}
                minDate={fromDate}
                onChange={setToDate}
              />
          </LocalizationProvider>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleClickOpen}
          >
              Upload Statement
          </Button>
          </Box>
        <UploadPDF
          open={openDialog}
          onClose={handleClose}
        />
        </Box>

        
        // <div className="ag-theme-material" style={{ height: 400, width: '100%' }}>
        //   <AgGridReact
        //     rowData={rowData}
        //     columnDefs={columnDefs}
        //     defaultColDef={{
        //       flex: 1,
        //       minWidth: 100,
        //       filter: true,
        //       sortable: true,
        //     }}
        //   />

        // </div>
      // </Paper>
    );
  };
  
  export default TransactionsTab;
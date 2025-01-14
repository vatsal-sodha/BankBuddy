
import React, { useState, useEffect } from 'react';
import { Paper, Box, Button } from '@mui/material';
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadPDF from './UploadPdf';
ModuleRegistry.registerModules([AllCommunityModule]);


const TransactionsTab = () => {
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
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
        <Paper sx={{}}>
            <Box>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                        label="From Date"
                        value={fromDate}
                        onChange={setFromDate}
                    />
                    <DatePicker
                        sx={{ ml: 2 }}
                        label="To Date"
                        value={fromDate}
                        minDate={fromDate}
                        onChange={setToDate}
                    />
                </LocalizationProvider>
                <Button sx={{ ml: 2 }}
                    variant="contained"
                >
                    Generate Report
                </Button>
                <Button
                    sx={{ float: "right" }}
                    variant="contained"
                    startIcon={<CloudUploadIcon />}
                    onClick={handleClickOpen}
                >
                    Upload Statement
                </Button>
                <UploadPDF
                    open={openDialog}
                    onClose={handleClose}
                />
            </Box>

            <div className="ag-theme-material" style={{ height: 400, width: '100%', marginTop: 5 }}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={{
                        flex: 1,
                        minWidth: 100,
                        filter: true,
                        sortable: true,
                    }}
                />

            </div>
        </Paper>
    );
};

export default TransactionsTab;
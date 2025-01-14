
import React, { useState, useEffect } from 'react';
import { Paper, Box, Button } from '@mui/material';
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadPDF from './UploadPdf';
import Toast from './Toast';
ModuleRegistry.registerModules([AllCommunityModule]);


const TransactionsTab = () => {
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [rowData, setRowData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const handleToastClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast({ ...toast, open: false });
    };
    const [toast, setToast] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!fromDate || !toDate) {
            setToast({
                open: true,
                message: "Please select both fromDate and a toDate",
                severity: 'warning'
            });
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(
                `http://127.0.0.1:5000/api/get-transactions?fromDate=${fromDate.format('YYYY-MM-DD')}&toDate=${toDate.format('YYYY-MM-DD')}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch transactions.');
            }

            const data = await response.json();
            setRowData(data.transactions);

            setToast({
                open: true,
                message: "Transactions retrieved successfully!",
                severity: 'success'
            });
        } catch (error) {
            setToast({
                open: true,
                message: error.message,
                severity: 'error'
            });
        } finally {
            setIsLoading(false);
        }

    }

    const handleClickOpen = () => {
        setOpenDialog(true);
    };
    const handleClose = () => {
        setOpenDialog(false);
    };

    // AG Grid column definitions
    const [columnDefs] = useState([
        { field: 'transaction_date', headerName: 'Date', filter: true },
        { field: 'description', headerName: 'Description', filter: true },
        { field: 'amount', headerName: 'Amount', filter: true },
        { field: 'category', headerName: 'Category', filter: true },
        { field: 'account_name', headerName: 'Account Name', filter: true },
        { field: 'account_institution', headerName: 'Institution', filter: true },
        { field: 'last_4_digits', headerName: 'Last 4 Digits', filter: true },
        { field: 'account_type', headerName: 'Account Type', filter: true },
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
                        value={toDate}
                        minDate={fromDate}
                        onChange={setToDate}
                        defaultValue={fromDate}
                    />
                </LocalizationProvider>
                <Button
                    sx={{ ml: 2 }}
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={isLoading}
                >
                    {isLoading ? "Loading..." : "Generate Report"}
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
            <Toast
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={handleToastClose}
            />
        </Paper>
    );
};

export default TransactionsTab;
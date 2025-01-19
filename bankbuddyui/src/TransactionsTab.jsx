
import React, { useState, useEffect } from 'react';
import { Paper, Box, Button, Typography, Grid2 } from '@mui/material';
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
    const [summary, setSummary] = useState({
        total_income: 0,
        total_expense: 0,
        refunds: 0,
        credit_card_expense: 0,
        net_position: 0
    });
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
    // Categories for dropdown
    const categories = [
        'paycheck', 'other income', 'transfer', 'credit card payment',
        'home', 'utilities', 'rent', 'auto', 'gas', 'parking', 'travel',
        'restaurant', 'groceries', 'medical', 'amazon', 'walmart',
        'shopping', 'subscriptions', 'donations', 'insurance',
        'investments', 'other expenses'
    ];

    const fetchFinancialSummary = async () => {
        if (!fromDate || !toDate) return;

        try {
            const response = await fetch(
                `http://127.0.0.1:5000/api/financial-summary?fromDate=${fromDate.format('YYYY-MM-DD')}&toDate=${toDate.format('YYYY-MM-DD')}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch financial summary');
            }

            const data = await response.json();
            setSummary(data);
        } catch (error) {
            setToast({
                open: true,
                message: error.message,
                severity: 'error'
            });
        }
    };

    const fetchTransactions = async () => {
        if (!fromDate || !toDate) return;
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
        }
    }
    const onCellValueChanged = async (params) => {
        const { data, colDef, newValue } = params;
        const fieldName = colDef.field;

        try {
            const response = await fetch('http://127.0.0.1:5000/api/update-transaction', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transaction_id: data.transaction_id,
                    field: fieldName,
                    value: newValue
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update transaction');
            }

            setToast({
                open: true,
                message: 'Transaction updated successfully!',
                severity: 'success'
            });

        } catch (error) {
            setToast({
                open: true,
                message: error.message,
                severity: 'error'
            });
            // Refresh the grid to revert changes if update failed
            // fetchTransactions();
        }
    };

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
            await Promise.all([
                fetchTransactions(),
                fetchFinancialSummary()
            ]);

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

    const formatCurrency = (amount) => {
        return amount.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
        });
    };


    // AG Grid column definitions
    const [columnDefs] = useState([
        {
            field: 'transaction_date',
            headerName: 'Date',
            filter: true,
            editable: true,
            cellEditor: 'agDateStringCellEditor',
            valueFormatter: params => {
                if (!params.value) return '';
                return new Date(params.value).toISOString().split('T')[0];
            },
            valueSetter: params => {
                const newDate = params.newValue;
                if (!newDate) return false;
                params.data.transaction_date = new Date(newDate).toISOString().split('T')[0];
                return true;
            }
        },
        { field: 'description', headerName: 'Description', filter: true, flex: 2, editable: true },
        {
            field: 'amount', headerName: 'Amount', filter: true, editable: true,
            cellStyle: params => {
                return {
                    color: params.value < 0 ? 'green' : 'black',
                    fontWeight: '300'
                };
            },
            valueFormatter: params => {
                const value = params.value;
                const formattedValue = Math.abs(value).toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD'
                });
                return value < 0 ? `-${formattedValue}` : formattedValue;
            },
            valueSetter: params => {
                const newValue = parseFloat(params.newValue);
                if (isNaN(newValue)) return false;
                params.data.amount = newValue;
                return true;
            }
        },
        {
            field: 'category', headerName: 'Category', filter: true,
            editable: true,
            pivot: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: categories
            }
        },
        { field: 'account_name', headerName: 'Account Name', filter: true },
        { field: 'account_institution', headerName: 'Institution', filter: true },
        { field: 'last_4_digits', headerName: 'Last 4 Digits', filter: true },
        { field: 'account_type', headerName: 'Account Type', filter: true },
        { field: 'comment', headerName: 'Comment', filter: true, editable: true },
    ]);

    return (
        <Paper sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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

            <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Grid2 container spacing={2}>
                    <Grid2 item xs={12}>
                        <Typography variant="h6" gutterBottom>
                            Financial Summary
                        </Typography>
                    </Grid2>
                    <Grid2 item xs={12} md={2}>
                        <Typography variant="subtitle2">Total Income</Typography>
                        <Typography variant="body1" color="success.main">
                            {formatCurrency(summary.total_income)}
                        </Typography>
                    </Grid2>
                    <Grid2 item xs={12} md={2}>
                        <Typography variant="subtitle2">Total Expense</Typography>
                        <Typography variant="body1" color="error.main">
                            {formatCurrency(summary.total_expense)}
                        </Typography>
                    </Grid2>
                    <Grid2 item xs={12} md={2}>
                        <Typography variant="subtitle2">Refunds</Typography>
                        <Typography variant="body1" color="success.main">
                            {formatCurrency(summary.refunds)}
                        </Typography>
                    </Grid2>
                    <Grid2 item xs={12} md={2}>
                        <Typography variant="subtitle2">Credit Card Expense</Typography>
                        <Typography variant="body1" color="error.main">
                            {formatCurrency(summary.credit_card_expense)}
                        </Typography>
                    </Grid2>
                    <Grid2 item xs={12} md={2}>
                        <Typography variant="subtitle2">Net Position</Typography>
                        <Typography
                            variant="body1"
                            color={summary.net_position >= 0 ? "success.main" : "error.main"}
                        >
                            {formatCurrency(summary.net_position)}
                        </Typography>
                    </Grid2>
                </Grid2>
            </Box>

            <Box sx={{ flex: 1, p: 2 }}>
                <div className="ag-theme-material" style={{ height: '100%', width: '100%' }}>
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        pagination={true}
                        // pivotMode={true}
                        // sideBar={"columns"}
                        paginationPageSize={20}
                        paginationPageSizeSelector={[20, 50, 100]}
                        defaultColDef={{
                            flex: 1,
                            minWidth: 100,
                            filter: true,
                            sortable: true,
                        }}
                        onCellValueChanged={onCellValueChanged}
                    />

                </div>
            </Box>
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
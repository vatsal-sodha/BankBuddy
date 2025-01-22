import React, { useState } from 'react';
import { Paper, Box, Button, Typography, Grid2, CircularProgress, Dialog, DialogContent, DialogTitle, DialogActions } from '@mui/material';
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Toast from './Toast';
ModuleRegistry.registerModules([AllCommunityModule]);


const CategoriesTab = () => {
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
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
                `http://127.0.0.1:5000/api/transactions-by-categories?fromDate=${fromDate.format('YYYY-MM-DD')}&toDate=${toDate.format('YYYY-MM-DD')}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch transactions.');
            }

            const data = await response.json();
            const transformedData = Object.entries(data.transactions).map(([category, spent]) => ({
                categories: category, // The key for the category column
                spent: spent          // The key for the spent column
            }));
            setRowData(transformedData);

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

    // AG Grid column definitions
    const [columnDefs] = useState([
        {
            field: 'categories',
            headerName: 'Categories',
            filter: true,
            flex: 1
        },
        {
            field: 'spent',
            headerName: 'Spent',
            filter: true,
            flex: 1,
            cellStyle: params => {
                return {
                    color: params.value < 0 ? 'red' : 'black',
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
            type: 'numericColumn',
            sort: 'desc'
        }
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
            </Box>
            <Box sx={{ flex: 1, p: 2 }}>
                <div className="ag-theme-material" style={{ height: '100%', width: '50%', alignContent: 'center' }}>
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        cellStyle
                        // pagination={true}
                        // paginationPageSize={20}
                        // paginationPageSizeSelector={[20, 50, 100]}
                        // rowSelection={rowSelection}
                        // onSelectionChanged={onSelectionChanged}
                        defaultColDef={{
                            flex: 1,
                            minWidth: 100,
                            filter: true,
                            sortable: true,
                            cellStyle: { textAlign: 'center' }

                        }}
                    // onCellValueChanged={onCellValueChanged}
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
    )


}

export default CategoriesTab;
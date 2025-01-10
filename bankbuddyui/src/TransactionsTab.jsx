
import React, { useState } from 'react';
import { Paper, Box } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-material.css';
const TransactionsTab = () => {
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
  
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
      <Paper sx={{ p: 2 }}>
        {/* <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <DatePicker
              label="From Date"
              value={fromDate}
              onChange={setFromDate}
            />
            <DatePicker
              label="To Date"
              value={toDate}
              onChange={setToDate}
            />
          </Box>
        </LocalizationProvider>
        
        <div className="ag-theme-material" style={{ height: 400, width: '100%' }}>
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
        </div> */}
      </Paper>
    );
  };
  
  export default TransactionsTab;
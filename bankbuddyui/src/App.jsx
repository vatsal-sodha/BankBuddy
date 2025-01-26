// import './App.css';
import {
    AppBar,
    Tabs,
    Tab,
    Typography,
    TabPanel,
    Box,
    Paper,
} from '@mui/material';

import AccountsTab from './AccountsTab';
import TransactionsTab from './TransactionsTab';
import CategoriesTab from './CategoriesTab';
import React, { useState } from 'react';

function App() {
    const [currentTab, setCurrentTab] = useState(0);
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);

    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };
    const TabPanel = ({ children, value, index }) => (
        <div hidden={value !== index} role="tabpanel">
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
    return (
        <div>
            <AppBar position="static">
                <Typography variant="h4" sx={{ p: 2 }}>
                    BankBuddy
                </Typography>
            </AppBar>
            <Box sx={{ width: '100%', }}>
                <Tabs value={currentTab} onChange={handleTabChange} textColor="black" indicatorColor="primary" centered>
                    <Tab label="Accounts" />
                    <Tab label="Transactions" />
                    <Tab label="Categories" />
                </Tabs>
            </Box>

            <TabPanel value={currentTab} index={0}>
                <AccountsTab />
            </TabPanel>

            <TabPanel value={currentTab} index={1}>
                <TransactionsTab />
            </TabPanel>

            <TabPanel value={currentTab} index={2}>
                <CategoriesTab />
            </TabPanel>

        </div>
    );
}

export default App;

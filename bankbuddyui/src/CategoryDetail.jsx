import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
    Dialog, DialogContent, Box, Typography, IconButton, TextField, InputAdornment, Button, Tooltip, Paper, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { money, signedMoney, titleCase } from './finance';

const gridTheme = themeQuartz.withParams({
    accentColor: '#1976d2', headerBackgroundColor: '#f7f8fa', headerFontWeight: 600,
    rowHoverColor: '#f3f6fb', borderColor: '#e6e8eb', wrapperBorderRadius: 8, fontFamily: 'inherit', rowHeight: 40,
});

const BAR_COLOR = '#2a78d6';

const Stat = ({ label, value, color }) => (
    <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 600, color: color || 'text.primary', lineHeight: 1.3 }}>{value}</Typography>
    </Box>
);

// One bar per month in the range; height = amount spent (or received, for income categories)
const MonthlyBars = ({ rows, fromDate, toDate, inflow, selectedMonth, onSelect }) => {
    const months = useMemo(() => {
        const totals = {};
        rows.forEach((t) => {
            const m = t.transaction_date.slice(0, 7);
            totals[m] = (totals[m] || 0) + t.flow;
        });
        const list = [];
        for (let m = fromDate.startOf('month'); !m.isAfter(toDate, 'month'); m = m.add(1, 'month')) {
            const key = m.format('YYYY-MM');
            const net = totals[key] || 0;
            list.push({ key, label: m.format('MMM'), year: m.format('YYYY'), value: Math.max(inflow ? net : -net, 0) });
        }
        return list;
    }, [rows, fromDate, toDate, inflow]);

    if (months.length < 2) return null;
    const max = Math.max(...months.map((m) => m.value), 1);
    const avg = months.reduce((s, m) => s + m.value, 0) / months.length;

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    By month{' '}
                    <Typography component="span" variant="caption" color="text.secondary">· click a month to filter</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">average {money(avg)} / month</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 120, borderBottom: '1px solid #e6e8eb' }}>
                {months.map((m) => (
                    <Tooltip key={m.key} arrow placement="top"
                        title={`${m.label} ${m.year}: ${money(m.value, true)} — ${selectedMonth === m.key ? 'click to show all months' : 'click to filter'}`}>
                        <Box onClick={() => onSelect(selectedMonth === m.key ? null : m.key)}
                            data-month={m.key}
                            sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'pointer',
                                borderRadius: '4px 4px 0 0', '&:hover': { bgcolor: 'action.hover' } }}>
                            <Box sx={{ width: '100%', height: `${(m.value / max) * 100}%`, minHeight: m.value > 0 ? 2 : 0,
                                bgcolor: BAR_COLOR, borderRadius: '4px 4px 0 0',
                                opacity: selectedMonth && selectedMonth !== m.key ? 0.3 : 1, transition: 'opacity 120ms' }} />
                        </Box>
                    </Tooltip>
                ))}
            </Box>
            <Box sx={{ display: 'flex', gap: '2px', mt: 0.5 }}>
                {months.map((m, i) => (
                    <Typography key={m.key} variant="caption"
                        color={selectedMonth === m.key ? 'text.primary' : 'text.secondary'}
                        sx={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: selectedMonth === m.key ? 700 : 400 }}>
                        {months.length <= 14 || i % 2 === 0 ? m.label : ''}
                    </Typography>
                ))}
            </Box>
        </Paper>
    );
};

const CategoryDetail = ({ open, onClose, category, rows, fromDate, toDate }) => {
    const gridRef = useRef(null);
    const [search, setSearch] = useState('');
    const [month, setMonth] = useState(null); // 'YYYY-MM' or null for the whole range

    // Start fresh whenever a different category is opened
    useEffect(() => { setMonth(null); setSearch(''); }, [category, open]);

    const monthRows = useMemo(
        () => (month ? rows.filter((t) => t.transaction_date.startsWith(month)) : rows),
        [rows, month]
    );

    const stats = useMemo(() => monthRows.reduce((acc, t) => {
        acc.net += t.flow;
        if (t.flow > 0) acc.in += t.flow; else acc.out += -t.flow;
        return acc;
    }, { net: 0, in: 0, out: 0 }), [monthRows]);

    const columnDefs = useMemo(() => [
        { field: 'transaction_date', headerName: 'Date', width: 120, sort: 'desc' },
        { field: 'description', headerName: 'Description', flex: 2, minWidth: 260, tooltipField: 'description' },
        { field: 'category', headerName: 'Category', width: 150, valueFormatter: (p) => titleCase(p.value) },
        { headerName: 'Account', width: 170, valueGetter: (p) => `${p.data.account_name} ··${p.data.last_4_digits}` },
        { field: 'account_institution', headerName: 'Institution', width: 130 },
        { field: 'account_type', headerName: 'Account type', width: 150 },
        {
            field: 'flow', headerName: 'Amount', width: 140, type: 'rightAligned',
            valueFormatter: (p) => signedMoney(p.value),
            cellStyle: (p) => ({ color: p.value > 0 ? '#2e7d32' : '#b3261e', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }),
        },
        { field: 'comment', headerName: 'Comment', flex: 1, minWidth: 160, tooltipField: 'comment' },
    ], []);

    const exportCsv = () => gridRef.current?.api.exportDataAsCsv({
        fileName: `${(category || 'category').replace(/\W+/g, '-')}_${month || `${fromDate.format('YYYY-MM-DD')}_${toDate.format('YYYY-MM-DD')}`}.csv`,
        processCellCallback: (p) => (p.column.getColId() === 'flow' ? p.value : p.formatValue(p.value)),
    });

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" slotProps={{ paper: { sx: { height: '92vh' } } }}>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>{titleCase(category)}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                {fromDate.format('MMM D, YYYY')} – {toDate.format('MMM D, YYYY')}
                            </Typography>
                            {month && (
                                <Chip size="small" color="primary" label={dayjs(`${month}-01`).format('MMMM YYYY')}
                                    onDelete={() => setMonth(null)} />
                            )}
                        </Box>
                    </Box>
                    <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
                </Box>

                <Box sx={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <Stat label="Transactions" value={monthRows.length} />
                    <Stat label="Net" value={signedMoney(stats.net)} color={stats.net >= 0 ? 'success.main' : 'error.main'} />
                    <Tooltip arrow title="Everything you paid in this category">
                        <Box><Stat label="Money out" value={money(stats.out, true)} /></Box>
                    </Tooltip>
                    <Tooltip arrow title="Refunds and credits that came back in this category (returns, cancelled bookings, card credits). Net = money out − money in.">
                        <Box><Stat label="Money in (refunds, credits)" value={money(stats.in, true)} /></Box>
                    </Tooltip>
                </Box>

                <MonthlyBars rows={rows} fromDate={fromDate} toDate={toDate}
                    inflow={rows.reduce((s, t) => s + t.flow, 0) > 0}
                    selectedMonth={month} onSelect={setMonth} />

                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <TextField size="small" placeholder="Search in this category…" value={search}
                        onChange={(e) => setSearch(e.target.value)} sx={{ width: 360 }}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
                    <Button sx={{ ml: 'auto' }} variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={exportCsv}>
                        Export CSV
                    </Button>
                </Box>

                {/* ag-grid needs a definite height; fill what's left of the dialog */}
                <Box sx={{ height: 'calc(92vh - 440px)', minHeight: 360, flexShrink: 0 }}>
                    <AgGridReact ref={gridRef} theme={gridTheme} rowData={monthRows} columnDefs={columnDefs}
                        quickFilterText={search} defaultColDef={{ sortable: true, resizable: true, filter: true }}
                        tooltipShowDelay={300} pagination paginationPageSize={50} paginationPageSizeSelector={[50, 100, 200]} />
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default CategoryDetail;

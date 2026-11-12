import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Paper, Box, Button, Typography, Dialog, DialogContent, DialogTitle, DialogActions,
    TextField, InputAdornment, MenuItem, Autocomplete, ToggleButton, ToggleButtonGroup,
    Chip, LinearProgress, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import UploadPDF from './UploadPdf';
import AddTransaction from './AddTransaction';
import Toast from './Toast';
import DateRangeBar from './DateRangeBar';
import InfoTip from './InfoTip';
import usePersistedDate from './usePersistedDate';
import {
    API, CATEGORIES, EXCLUDED, INCOME, SAVINGS, EXPLAIN, money, signedMoney, titleCase, moneyFlow, storedAmount, isCard, pct,
} from './finance';

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
    accentColor: '#1976d2',
    headerBackgroundColor: '#f7f8fa',
    headerFontWeight: 600,
    rowHoverColor: '#f3f6fb',
    selectedRowBackgroundColor: '#e8f0fe',
    borderColor: '#e6e8eb',
    wrapperBorderRadius: 8,
    fontFamily: 'inherit',
    rowHeight: 44,
});

const StatTile = ({ label, value, color, sub, info }) => (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5, boxSizing: 'border-box', height: '100%' }}>
        <Typography variant="caption" color="text.secondary">{label}{info && <InfoTip text={info} />}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 600, color: color || 'text.primary', lineHeight: 1.3 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
);

const TransactionsTab = () => {
    // Shared with the Categories tab and remembered across reloads
    const [fromDate, setFromDate] = usePersistedDate('bankbuddy.fromDate');
    const [toDate, setToDate] = usePersistedDate('bankbuddy.toDate');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

    // Filters
    const [search, setSearch] = useState('');
    const [account, setAccount] = useState('all');
    const [categories, setCategories] = useState([]);
    const [direction, setDirection] = useState('all');
    const [hideMoves, setHideMoves] = useState(false);

    // Selection + dialogs
    const gridRef = useRef(null);
    const [selected, setSelected] = useState([]);
    const [bulkCategory, setBulkCategory] = useState(null);
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [openUpload, setOpenUpload] = useState(false);
    const [openAdd, setOpenAdd] = useState(false);

    const notify = (message, severity = 'success') => setToast({ open: true, message, severity });
    const datesValid = fromDate?.isValid() && toDate?.isValid() && !fromDate.isAfter(toDate);
    const qs = () => `fromDate=${fromDate.format('YYYY-MM-DD')}&toDate=${toDate.format('YYYY-MM-DD')}`;

    const loadSummary = async () => {
        if (!datesValid) return;
        const res = await fetch(`${API}/financial-summary?${qs()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load summary');
        setSummary(data);
    };

    const load = async () => {
        if (!datesValid) return;
        setLoading(true);
        try {
            const [txRes] = await Promise.all([fetch(`${API}/get-transactions?${qs()}`), loadSummary()]);
            const data = await txRes.json();
            if (!txRes.ok) throw new Error(data.error || 'Failed to load transactions');
            setRows(data.transactions.map((t) => ({ ...t, flow: moneyFlow(t) })));
        } catch (error) {
            notify(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Reload whenever the date range changes (including the remembered range on open)
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromDate?.format('YYYY-MM-DD'), toDate?.format('YYYY-MM-DD')]);

    const accounts = useMemo(() => {
        const seen = new Map();
        rows.forEach((t) => seen.set(t.account_id, `${t.account_name} ··${t.last_4_digits}`));
        return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [rows]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((t) =>
            (account === 'all' || t.account_id === account) &&
            (categories.length === 0 || categories.includes(t.category)) &&
            (direction === 'all' || (direction === 'out' ? t.flow < 0 : t.flow > 0)) &&
            (!hideMoves || !EXCLUDED.has(t.category)) &&
            (!q || [t.description, t.comment, t.category, t.account_name].some((v) => v && v.toLowerCase().includes(q)))
        );
    }, [rows, search, account, categories, direction, hideMoves]);

    // Card charges per card for the whole date range (same rule as the summary:
    // purchases in spending categories, not payments/transfers/savings)
    const cardSpending = useMemo(() => {
        const byCard = new Map();
        rows.forEach((t) => {
            if (!isCard(t) || t.flow >= 0 || EXCLUDED.has(t.category) || INCOME.has(t.category) || SAVINGS.has(t.category)) return;
            const key = `${t.account_name} ··${t.last_4_digits}`;
            byCard.set(key, (byCard.get(key) || 0) - t.flow);
        });
        return [...byCard.entries()].sort((a, b) => b[1] - a[1]);
    }, [rows]);

    const totals = useMemo(() => visible.reduce((acc, t) => {
        if (t.flow > 0) acc.in += t.flow; else acc.out += -t.flow;
        return acc;
    }, { in: 0, out: 0 }), [visible]);

    const filtersActive = search || account !== 'all' || categories.length || direction !== 'all' || hideMoves;
    const clearFilters = () => { setSearch(''); setAccount('all'); setCategories([]); setDirection('all'); setHideMoves(false); };

    // ---- editing ----
    const saveField = async (transactionId, field, value) => {
        const res = await fetch(`${API}/update-transaction`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_id: transactionId, field, value }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to update transaction');
        }
    };

    const onCellValueChanged = async ({ data, colDef }) => {
        // The Amount column shows money flow; the backend stores card charges as positive
        const field = colDef.field === 'flow' ? 'amount' : colDef.field;
        const value = colDef.field === 'flow' ? storedAmount(data, data.flow) : data[colDef.field];
        try {
            await saveField(data.transaction_id, field, value);
            if (field === 'amount') data.amount = value;
            setRows((prev) => prev.map((t) => (t.transaction_id === data.transaction_id ? { ...data } : t)));
            notify('Saved');
            loadSummary().catch(() => {});
        } catch (error) {
            notify(error.message, 'error');
            load();
        }
    };

    const applyBulkCategory = async () => {
        if (!bulkCategory) return;
        setLoading(true);
        try {
            await Promise.all(selected.map((t) => saveField(t.transaction_id, 'category', bulkCategory)));
            const ids = new Set(selected.map((t) => t.transaction_id));
            setRows((prev) => prev.map((t) => (ids.has(t.transaction_id) ? { ...t, category: bulkCategory } : t)));
            notify(`Moved ${selected.length} transaction${selected.length === 1 ? '' : 's'} to ${titleCase(bulkCategory)}`);
            setBulkCategory(null);
            gridRef.current?.api.deselectAll();
            loadSummary().catch(() => {});
        } catch (error) {
            notify(error.message, 'error');
            load();
        } finally {
            setLoading(false);
        }
    };

    const deleteSelected = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/delete-transaction`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_ids: selected.map((t) => t.transaction_id) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to delete transactions');
            const ids = new Set(selected.map((t) => t.transaction_id));
            setRows((prev) => prev.filter((t) => !ids.has(t.transaction_id)));
            notify(`Deleted ${ids.size} transaction${ids.size === 1 ? '' : 's'}`);
            setSelected([]);
            loadSummary().catch(() => {});
        } catch (error) {
            notify(error.message, 'error');
        } finally {
            setConfirmDelete(false);
            setLoading(false);
        }
    };

    const columnDefs = useMemo(() => [
        {
            field: 'transaction_date', headerName: 'Date', width: 125, sort: 'desc', editable: true,
            cellEditor: 'agDateStringCellEditor',
        },
        {
            field: 'description', headerName: 'Description', flex: 2, minWidth: 220, editable: true,
            tooltipField: 'description',
        },
        {
            field: 'category', headerName: 'Category', width: 175, editable: true,
            cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CATEGORIES },
            valueFormatter: (p) => titleCase(p.value),
            cellRenderer: (p) => (
                <Chip size="small" label={titleCase(p.value)} variant="outlined"
                    sx={{ borderRadius: 1.5, color: 'text.secondary', cursor: 'pointer' }} />
            ),
        },
        {
            headerName: 'Account', width: 170,
            valueGetter: (p) => `${p.data.account_name} ··${p.data.last_4_digits}`,
            tooltipValueGetter: (p) => `${p.data.account_institution} · ${p.data.account_type}`,
        },
        {
            field: 'flow', headerName: 'Amount', width: 140, type: 'rightAligned', editable: true,
            valueFormatter: (p) => signedMoney(p.value),
            valueParser: (p) => {
                const n = parseFloat(String(p.newValue).replace(/[^0-9.-]/g, ''));
                return Number.isNaN(n) ? p.oldValue : n;
            },
            cellStyle: (p) => ({ color: p.value > 0 ? '#2e7d32' : '#b3261e', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }),
            headerTooltip: 'Money in (+) or out (−). Double-click to edit.',
        },
        { field: 'comment', headerName: 'Comment', flex: 1, minWidth: 140, editable: true, tooltipField: 'comment' },
    ], []);

    const selectedTotal = selected.reduce((s, t) => s + t.flow, 0);
    const selectedIn = selected.reduce((s, t) => s + Math.max(t.flow, 0), 0);
    const selectedOut = selected.reduce((s, t) => s + Math.max(-t.flow, 0), 0);
    // What the selection is made of, shown before a bulk change
    const selectedBreakdown = useMemo(() => {
        const counts = {};
        selected.forEach((t) => { counts[t.category] = (counts[t.category] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [selected]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <DateRangeBar fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate}
                onReload={load} loading={loading}>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenAdd(true)}>Add</Button>
                <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => setOpenUpload(true)}>
                    Upload statement
                </Button>
            </DateRangeBar>

            {summary && datesValid && (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' } }}>
                    <StatTile label="Income" value={money(summary.total_income)} color="success.main" info={EXPLAIN.income} />
                    <StatTile label="Spending" value={money(summary.total_expense)} color="error.main" info={EXPLAIN.spending}
                        sub={`${money(summary.refunds)} refunded`} />
                    <Tooltip arrow placement="bottom" title={
                        cardSpending.length ? (
                            <Box sx={{ py: 0.5 }}>
                                {cardSpending.map(([card, amount]) => (
                                    <Box key={card} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                                        <span>{card}</span><b>{money(amount)}</b>
                                    </Box>
                                ))}
                                <Box sx={{ mt: 0.5, opacity: 0.8 }}>Purchases only — card payments and transfers excluded</Box>
                            </Box>
                        ) : 'No card purchases in this period'
                    }>
                        <Box>
                            <StatTile label="Credit card spending" value={money(summary.credit_card_expense)} color="error.main" info={EXPLAIN.cardSpending}
                                sub={`${pct(summary.credit_card_expense, summary.total_expense + summary.refunds)} of spending · hover for each card`} />
                        </Box>
                    </Tooltip>
                    <StatTile label="Net position" value={money(summary.net_position)} info={EXPLAIN.netPosition}
                        color={summary.net_position >= 0 ? 'success.main' : 'error.main'} />
                    <StatTile label="Invested + Marcus" value={money(summary.net_invested + summary.marcus_net)} info={EXPLAIN.investedPlusMarcus}
                        sub={`${money(summary.net_invested)} invested · ${money(summary.marcus_net)} Marcus`} />
                </Box>
            )}

            {/* Filters */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                <TextField size="small" placeholder="Search description, comment, category…" value={search}
                    onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 300, flex: '1 1 300px', maxWidth: 420 }}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
                <TextField select size="small" label="Account" value={account} onChange={(e) => setAccount(e.target.value)} sx={{ width: 200 }}>
                    <MenuItem value="all">All accounts</MenuItem>
                    {accounts.map(([id, label]) => <MenuItem key={id} value={id}>{label}</MenuItem>)}
                </TextField>
                <Autocomplete multiple size="small" options={CATEGORIES} value={categories} onChange={(_, v) => setCategories(v)}
                    getOptionLabel={titleCase} limitTags={2} sx={{ width: 300 }}
                    renderInput={(params) => <TextField {...params} label="Categories" />} />
                <ToggleButtonGroup size="small" exclusive value={direction} onChange={(_, v) => v && setDirection(v)}>
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="out">Money out</ToggleButton>
                    <ToggleButton value="in">Money in</ToggleButton>
                </ToggleButtonGroup>
                <Tooltip title="Credit card payments and transfers between your own accounts">
                    <Chip label="Hide transfers & card payments" onClick={() => setHideMoves(!hideMoves)}
                        color={hideMoves ? 'primary' : 'default'} variant={hideMoves ? 'filled' : 'outlined'} />
                </Tooltip>
                {filtersActive && (
                    <Button size="small" startIcon={<FilterAltOffOutlinedIcon />} onClick={clearFilters}>Clear</Button>
                )}
            </Box>

            {/* Result line, or bulk actions while rows are selected */}
            {selected.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                    {visible.length} transaction{visible.length === 1 ? '' : 's'}
                    {visible.length !== rows.length && ` of ${rows.length}`} ·
                    <Box component="span" sx={{ color: 'success.main', mx: 0.5 }}>{signedMoney(totals.in)} in</Box>·
                    <Box component="span" sx={{ color: 'error.main', mx: 0.5 }}>{signedMoney(-totals.out)} out</Box>
                    <InfoTip text={EXPLAIN.visibleTotals} />
                    <Box component="span" sx={{ ml: 'auto' }}>Double-click a cell to edit · select rows for bulk actions</Box>
                </Typography>
            ) : (
                <Paper elevation={0} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, minHeight: 40,
                    bgcolor: '#e8f0fe', borderRadius: 2,
                }}>
                    <IconButton size="small" onClick={() => gridRef.current?.api.deselectAll()} aria-label="Clear selection">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{selected.length} selected</Typography>
                    <Typography variant="body2" sx={{ display: 'flex', gap: 1, fontVariantNumeric: 'tabular-nums' }}>
                        <Box component="span" sx={{ color: 'success.main' }}>{signedMoney(selectedIn)} in</Box>·
                        <Box component="span" sx={{ color: 'error.main' }}>{signedMoney(-selectedOut)} out</Box>·
                        <Box component="span" sx={{ fontWeight: 600 }}>net {signedMoney(selectedTotal)}</Box>
                        <InfoTip text={EXPLAIN.selectedTotals} />
                    </Typography>
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Autocomplete size="small" options={CATEGORIES} value={bulkCategory} onChange={(_, v) => setBulkCategory(v)}
                            getOptionLabel={titleCase} sx={{ width: 220, bgcolor: 'background.paper' }}
                            renderInput={(params) => <TextField {...params} placeholder="Set category…" />} />
                        <Button size="small" variant="contained" startIcon={<LabelOutlinedIcon />}
                            disabled={!bulkCategory || loading} onClick={() => setConfirmBulk(true)}>Apply</Button>
                        <Button size="small" color="error" startIcon={<DeleteOutlineIcon />}
                            disabled={loading} onClick={() => setConfirmDelete(true)}>Delete</Button>
                    </Box>
                </Paper>
            )}

            <Box sx={{ position: 'relative', height: 'calc(100vh - 330px)', minHeight: 420 }}>
                {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }} />}
                <AgGridReact
                    ref={gridRef}
                    theme={gridTheme}
                    rowData={visible}
                    columnDefs={columnDefs}
                    getRowId={(p) => String(p.data.transaction_id)}
                    defaultColDef={{ sortable: true, resizable: true, filter: true }}
                    rowSelection={{ mode: 'multiRow', selectAll: 'currentPage' }}
                    onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
                    onCellValueChanged={onCellValueChanged}
                    pagination paginationPageSize={50} paginationPageSizeSelector={[25, 50, 100, 200]}
                    tooltipShowDelay={400}
                    stopEditingWhenCellsLoseFocus
                    overlayNoRowsTemplate={datesValid
                        ? '<span style="color:#666">No transactions match these filters.</span>'
                        : '<span style="color:#666">Pick a date range or a preset above.</span>'}
                />
            </Box>

            <Dialog open={confirmBulk} onClose={() => setConfirmBulk(false)}>
                <DialogTitle>
                    Change {selected.length} transaction{selected.length === 1 ? '' : 's'} to {titleCase(bulkCategory)}?
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Selected total: {signedMoney(selectedIn)} in · {signedMoney(-selectedOut)} out · net <b>{signedMoney(selectedTotal)}</b>
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>Their current categories:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedBreakdown.map(([cat, n]) => (
                            <Chip key={cat} size="small" variant="outlined" label={`${titleCase(cat)} · ${n}`} />
                        ))}
                    </Box>
                    {selected.length > 50 && (
                        <Typography variant="body2" color="error.main" sx={{ mt: 2 }}>
                            That's a lot of transactions — make sure you meant to select all of them.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmBulk(false)}>Cancel</Button>
                    <Button variant="contained" disabled={loading}
                        onClick={() => { setConfirmBulk(false); applyBulkCategory(); }}>
                        Change {selected.length}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
                <DialogTitle>Delete {selected.length} transaction{selected.length === 1 ? '' : 's'}?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Net {signedMoney(selectedTotal)}. This can't be undone (a daily database backup is kept in <code>backups/</code>).
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={deleteSelected} disabled={loading}
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineIcon />}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reload after adding or uploading so new rows show up */}
            <UploadPDF open={openUpload} onClose={() => { setOpenUpload(false); load(); }} />
            <AddTransaction open={openAdd} onClose={() => { setOpenAdd(false); load(); }} categories={CATEGORIES} />
            <Toast open={toast.open} message={toast.message} severity={toast.severity}
                onClose={(_, reason) => reason !== 'clickaway' && setToast({ ...toast, open: false })} />
        </Box>
    );
};

export default TransactionsTab;

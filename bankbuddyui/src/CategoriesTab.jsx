import { useState, useEffect, useMemo } from 'react';
import {
    Paper, Box, Typography, Grid2, Tooltip, IconButton, LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CategoryDetail from './CategoryDetail';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import Toast from './Toast';
import DateRangeBar from './DateRangeBar';
import InfoTip from './InfoTip';
import usePersistedDate from './usePersistedDate';
import { API, EXCLUDED, SAVINGS, INCOME, EXPLAIN, money, signedMoney, pct, titleCase, moneyFlow } from './finance';

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
    accentColor: '#1976d2', headerBackgroundColor: '#f7f8fa', headerFontWeight: 600,
    rowHoverColor: '#f3f6fb', borderColor: '#e6e8eb', wrapperBorderRadius: 8, fontFamily: 'inherit', rowHeight: 40,
});

// Chart colors (validated: distinct for color-blind viewers, labelled everywhere)
const COLORS = {
    spending: '#eb6834',
    invested: '#2a78d6',
    marcus: '#1baf7a',
    cash: '#b8b6ad',
    bar: '#2a78d6',
    track: '#e9ecf2',
};

const StatTile = ({ label, value, sub, color, info }) => (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', boxSizing: 'border-box' }}>
        <Typography variant="body2" color="text.secondary">{label}{info && <InfoTip text={info} />}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 600, color: color || 'text.primary', mt: 0.5 }}>
            {value}
        </Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
);

// One stacked bar: how income was used (spending / invested / Marcus / kept as cash)
const IncomeSplit = ({ summary }) => {
    const income = summary.total_income;
    const parts = [
        { key: 'spending', label: 'Spending', value: Math.max(summary.total_expense, 0), color: COLORS.spending },
        { key: 'invested', label: 'Invested', value: Math.max(summary.net_invested, 0), color: COLORS.invested },
        { key: 'marcus', label: 'Moved to Marcus', value: Math.max(summary.marcus_net, 0), color: COLORS.marcus },
    ];
    const used = parts.reduce((s, p) => s + p.value, 0);
    const kept = income - used;
    if (kept > 0) parts.push({ key: 'cash', label: 'Kept as cash', value: kept, color: COLORS.cash });
    const total = Math.max(income, used);
    if (total <= 0) return null;

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Where your income went<InfoTip text={EXPLAIN.incomeSplit} /></Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {kept >= 0
                    ? `Of ${money(income)} earned`
                    : `You saved ${money(income - parts[0].value)} and put ${money(parts[1].value + parts[2].value)} into investments and Marcus, so ${money(-kept)} came from cash you already had`}
            </Typography>
            <Box sx={{ display: 'flex', gap: '2px', height: 20 }}>
                {parts.filter((p) => p.value > 0).map((p, i, arr) => (
                    <Tooltip key={p.key} title={`${p.label}: ${money(p.value)} (${pct(p.value, income)} of income)`} arrow>
                        <Box sx={{
                            width: `${(p.value / total) * 100}%`, bgcolor: p.color, cursor: 'default',
                            borderRadius: `${i === 0 ? 4 : 0}px ${i === arr.length - 1 ? 4 : 0}px ${i === arr.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`,
                            '&:hover': { opacity: 0.85 },
                        }} />
                    </Tooltip>
                ))}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 1.5 }}>
                {parts.map((p) => (
                    <Box key={p.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: p.color }} />
                        <Typography variant="body2">
                            {p.label} <b>{money(p.value)}</b>{' '}
                            <Typography component="span" variant="body2" color="text.secondary">
                                {pct(p.value, income)}
                            </Typography>
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Paper>
    );
};

// Ranked horizontal bars; click a row to see its transactions
const CategoryBars = ({ title, rows, total, selected, onSelect, color, info }) => {
    const max = Math.max(...rows.map((r) => r.value), 1);
    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}{info && <InfoTip text={info} />}</Typography>
                <Typography variant="body2" color="text.secondary">{money(total)}</Typography>
            </Box>
            {rows.length === 0 && (
                <Typography variant="body2" color="text.secondary">Nothing in this period.</Typography>
            )}
            {rows.map((r) => (
                <Tooltip
                    key={r.category}
                    placement="top"
                    arrow
                    title={`${titleCase(r.category)}: ${money(r.value, true)} · ${pct(r.value, total)} · ${r.count} transaction${r.count === 1 ? '' : 's'} — click for details`}
                >
                    <Box
                        data-category={r.category}
                        onClick={() => onSelect(r.category)}
                        sx={{
                            display: 'grid', gridTemplateColumns: '140px 1fr 90px 52px', alignItems: 'center',
                            gap: 1.5, py: 0.75, px: 1, borderRadius: 1, cursor: 'pointer',
                            bgcolor: selected === r.category ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: selected === r.category ? 'action.selected' : 'action.hover' },
                        }}
                    >
                        <Typography variant="body2" noWrap>{titleCase(r.category)}</Typography>
                        <Box sx={{ height: 12, bgcolor: COLORS.track, borderRadius: '4px' }}>
                            <Box sx={{ height: '100%', width: `${(r.value / max) * 100}%`, bgcolor: color, borderRadius: '4px', minWidth: 2 }} />
                        </Box>
                        <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 500 }}>{money(r.value)}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                            {pct(r.value, total)}
                        </Typography>
                    </Box>
                </Tooltip>
            ))}
        </Paper>
    );
};

const CategoriesTab = () => {
    // Shared with the Transactions tab and remembered across reloads
    const [fromDate, setFromDate] = usePersistedDate('bankbuddy.fromDate');
    const [toDate, setToDate] = usePersistedDate('bankbuddy.toDate');
    const [summary, setSummary] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

    const datesValid = fromDate?.isValid() && toDate?.isValid() && !fromDate.isAfter(toDate);

    const load = async () => {
        if (!datesValid) return;
        const qs = `fromDate=${fromDate.format('YYYY-MM-DD')}&toDate=${toDate.format('YYYY-MM-DD')}`;
        setIsLoading(true);
        try {
            const [summaryRes, txRes] = await Promise.all([
                fetch(`${API}/financial-summary?${qs}`),
                fetch(`${API}/get-transactions?${qs}`),
            ]);
            const [summaryData, txData] = await Promise.all([summaryRes.json(), txRes.json()]);
            if (!summaryRes.ok) throw new Error(summaryData.error || 'Failed to load summary');
            if (!txRes.ok) throw new Error(txData.error || 'Failed to load transactions');
            setSummary(summaryData);
            setTransactions(txData.transactions);
        } catch (error) {
            setToast({ open: true, message: error.message, severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Reload whenever the date range changes (including the remembered range on open)
    useEffect(() => {
        setSelected(null);
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromDate?.format('YYYY-MM-DD'), toDate?.format('YYYY-MM-DD')]);

    // Group transactions into spending / income / savings using the summary's rules
    const groups = useMemo(() => {
        const byCategory = {};
        for (const t of transactions) {
            if (EXCLUDED.has(t.category)) continue;
            const key = t.category || 'uncategorized';
            byCategory[key] ??= { category: key, net: 0, count: 0 };
            byCategory[key].net += moneyFlow(t);
            byCategory[key].count += 1;
        }
        const spending = [], income = [], savings = [];
        for (const c of Object.values(byCategory)) {
            if (SAVINGS.has(c.category)) savings.push({ ...c, value: -c.net });
            else if (INCOME.has(c.category)) income.push({ ...c, value: c.net });
            else spending.push({ ...c, value: -c.net });
        }
        // Totals include every category (so they match the summary tiles);
        // bars show only categories with a positive amount
        const total = (a) => a.reduce((s, r) => s + r.value, 0);
        const bars = (a) => a.filter((r) => r.value > 0).sort((x, y) => y.value - x.value);
        return {
            spending: bars(spending), spendingTotal: total(spending),
            income: bars(income), incomeTotal: total(income),
            savings: bars(savings), savingsTotal: total(savings),
        };
    }, [transactions]);

    const selectedRows = useMemo(
        () => transactions
            .filter((t) => (t.category || 'uncategorized') === selected)
            .map((t) => ({ ...t, flow: moneyFlow(t) }))
            .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
        [transactions, selected]
    );

    const columnDefs = useMemo(() => [
        { field: 'transaction_date', headerName: 'Date', width: 115, sort: 'desc' },
        { field: 'description', headerName: 'Description', flex: 1, minWidth: 180, tooltipField: 'description' },
        { field: 'account_name', headerName: 'Account', width: 125, tooltipValueGetter: (p) => `··${p.data.last_4_digits}` },
        {
            field: 'flow', headerName: 'Amount', width: 125, type: 'rightAligned',
            valueFormatter: (p) => signedMoney(p.value),
            cellStyle: (p) => ({ color: p.value > 0 ? '#2e7d32' : '#b3261e', fontVariantNumeric: 'tabular-nums' }),
        },
    ], []);

    const savingsRate = summary && summary.total_income > 0
        ? `${pct(summary.net_position, summary.total_income)} of income saved`
        : null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 4 }}>
            <DateRangeBar fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate}
                onReload={load} loading={isLoading} />
            {isLoading && <LinearProgress />}

            {!datesValid && (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">Pick a date range or a preset above to see your summary.</Typography>
                </Paper>
            )}

            {datesValid && summary && (
                <>
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' } }}>
                        <Box>
                            <StatTile label="Income" value={money(summary.total_income)} color="success.main" info={EXPLAIN.income} />
                        </Box>
                        <Box>
                            <StatTile label="Spending" value={money(summary.total_expense)} color="error.main" info={EXPLAIN.spending}
                                sub={`incl. ${money(summary.credit_card_expense)} on cards, ${money(summary.refunds)} refunded`} />
                        </Box>
                        <Box>
                            <StatTile label="Net position" value={money(summary.net_position)} info={EXPLAIN.netPosition}
                                color={summary.net_position >= 0 ? 'success.main' : 'error.main'} sub={savingsRate} />
                        </Box>
                        <Box>
                            <StatTile label="Invested" value={money(summary.net_invested)} sub="Brokerage, crypto…" info={EXPLAIN.invested} />
                        </Box>
                        <Box>
                            <StatTile label="Marcus (net moved in)" value={money(summary.marcus_net)} info={EXPLAIN.marcus} />
                        </Box>
                    </Box>

                    <IncomeSplit summary={summary} />

                    <Grid2 container spacing={2}>
                        <Grid2 size={{ xs: 12, md: selected ? 6 : 7 }}>
                            <CategoryBars title="Spending by category" info={EXPLAIN.byCategory} rows={groups.spending} total={groups.spendingTotal}
                                selected={selected} onSelect={setSelected} color={COLORS.bar} />
                        </Grid2>
                        <Grid2 size={{ xs: 12, md: selected ? 6 : 5 }}>
                            {selected ? (
                                <Paper variant="outlined" sx={{
                                    p: 2, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                                    position: 'sticky', top: 16, height: 'calc(100vh - 32px)', maxHeight: 760,
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{titleCase(selected)}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {selectedRows.length} transactions · net {signedMoney(selectedRows.reduce((s, t) => s + t.flow, 0))}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <Tooltip title="Expand: all columns, monthly chart, export">
                                                <IconButton onClick={() => setExpanded(true)} aria-label="Expand"><OpenInFullIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                            <IconButton onClick={() => setSelected(null)} aria-label="Close"><CloseIcon /></IconButton>
                                        </Box>
                                    </Box>
                                    <Box sx={{ flex: 1, minHeight: 300, mt: 1 }}>
                                        <AgGridReact theme={gridTheme} rowData={selectedRows} columnDefs={columnDefs} tooltipShowDelay={300}
                                            pagination paginationPageSize={20} paginationPageSizeSelector={[20, 50, 100]} />
                                    </Box>
                                </Paper>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <CategoryBars title="Income" info={EXPLAIN.incomeList} rows={groups.income} total={groups.incomeTotal}
                                        selected={selected} onSelect={setSelected} color="#2e7d32" />
                                    <CategoryBars title="Savings & investments" info={EXPLAIN.savingsList} rows={groups.savings} total={groups.savingsTotal}
                                        selected={selected} onSelect={setSelected} color={COLORS.invested} />
                                    <Typography variant="caption" color="text.secondary">
                                        Click any category to see its transactions. Credit card payments and transfers
                                        between your own accounts are left out so nothing is counted twice.
                                    </Typography>
                                </Box>
                            )}
                        </Grid2>
                    </Grid2>
                </>
            )}

            {selected && datesValid && (
                <CategoryDetail open={expanded} onClose={() => setExpanded(false)} category={selected}
                    rows={selectedRows} fromDate={fromDate} toDate={toDate} />
            )}
            <Toast open={toast.open} message={toast.message} severity={toast.severity}
                onClose={(_, reason) => reason !== 'clickaway' && setToast({ ...toast, open: false })} />
        </Box>
    );
};

export default CategoriesTab;

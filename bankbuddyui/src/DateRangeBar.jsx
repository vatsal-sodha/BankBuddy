import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PRESETS } from './finance';

// Date pickers + one-click presets + reload, shared by both tabs
const DateRangeBar = ({ fromDate, toDate, setFromDate, setToDate, onReload, loading, children }) => {
    const activePreset = PRESETS.find((p) => {
        const [from, to] = p.range();
        return fromDate?.isSame(from, 'day') && toDate?.isSame(to, 'day');
    })?.label;

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker label="From" value={fromDate} onChange={setFromDate} maxDate={toDate || undefined}
                    slotProps={{ textField: { size: 'small', sx: { width: 170 } } }} />
                <DatePicker label="To" value={toDate} onChange={setToDate} minDate={fromDate || undefined}
                    slotProps={{ textField: { size: 'small', sx: { width: 170 } } }} />
            </LocalizationProvider>
            {PRESETS.map((p) => (
                <Chip key={p.label} label={p.label}
                    onClick={() => { const [f, t] = p.range(); setFromDate(f); setToDate(t); }}
                    color={activePreset === p.label ? 'primary' : 'default'}
                    variant={activePreset === p.label ? 'filled' : 'outlined'} />
            ))}
            <Tooltip title="Reload">
                <span>
                    <IconButton onClick={onReload} disabled={loading}><RefreshIcon /></IconButton>
                </span>
            </Tooltip>
            {children && <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>{children}</Box>}
        </Box>
    );
};

export default DateRangeBar;

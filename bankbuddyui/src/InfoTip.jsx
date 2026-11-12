import { Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// Small (i) icon that explains how a number is calculated
const InfoTip = ({ text }) => (
    <Tooltip arrow placement="top" title={<span style={{ whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.45 }}>{text}</span>}>
        <InfoOutlinedIcon tabIndex={0} aria-label="How is this calculated?"
            sx={{ fontSize: 15, color: 'text.disabled', ml: 0.5, verticalAlign: 'text-bottom', cursor: 'help',
                '&:hover, &:focus': { color: 'text.secondary' } }} />
    </Tooltip>
);

export default InfoTip;

import { useState } from 'react';
import dayjs from 'dayjs';

/**
 * Like useState for a dayjs date, but remembered in localStorage under `key`
 * so the date survives page reloads and is shared between tabs that use the
 * same key. Storage failures (private mode, blocked storage) are ignored.
 */
export default function usePersistedDate(key) {
    const [value, setValue] = useState(() => {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const date = dayjs(saved);
                if (date.isValid()) return date;
            }
        } catch {
            // storage unavailable - start empty
        }
        return null;
    });

    const update = (date) => {
        setValue(date);
        try {
            if (date && date.isValid()) {
                localStorage.setItem(key, date.format('YYYY-MM-DD'));
            } else {
                localStorage.removeItem(key);
            }
        } catch {
            // storage unavailable - keep the in-memory value only
        }
    };

    return [value, update];
}

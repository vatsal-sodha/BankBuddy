import { describe, expect, it, vi, afterEach } from 'vitest';
import dayjs from 'dayjs';
import {
    CATEGORIES, EXCLUDED, INCOME, SAVINGS, PRESETS, EXPLAIN,
    money, signedMoney, pct, titleCase, isCard, moneyFlow, storedAmount,
} from './finance';

const checking = (amount) => ({ account_type: 'checking/savings', amount });
const card = (amount) => ({ account_type: 'credit/debit', amount });

describe('money flow (positive = money in, negative = money out)', () => {
    it('keeps checking amounts as stored', () => {
        expect(moneyFlow(checking(-42.1))).toBe(-42.1);
        expect(moneyFlow(checking(3000))).toBe(3000);
    });

    it('flips credit card amounts (cards store charges as positive)', () => {
        expect(moneyFlow(card(42.1))).toBe(-42.1);   // purchase -> money out
        expect(moneyFlow(card(-250))).toBe(250);     // payment/refund -> money in
        expect(isCard(card(1))).toBe(true);
        expect(isCard(checking(1))).toBe(false);
    });

    it('storedAmount is the inverse of moneyFlow for edits', () => {
        for (const t of [checking(-12.5), checking(99), card(42.1), card(-15.99)]) {
            expect(storedAmount(t, moneyFlow(t))).toBe(t.amount);
        }
        // editing a card purchase to "-$50" (money out) stores +50
        expect(storedAmount(card(42.1), -50)).toBe(50);
    });
});

describe('formatting', () => {
    it('formats whole and cent amounts', () => {
        expect(money(1234.56)).toBe('$1,235');
        expect(money(1234.56, true)).toBe('$1,234.56');
        expect(money(undefined)).toBe('$0');
    });

    it('signs money flows explicitly', () => {
        expect(signedMoney(24.5)).toBe('+$24.50');
        expect(signedMoney(-1066.22)).toBe('−$1,066.22');
        expect(signedMoney(0)).toBe('$0.00');
    });

    it('computes percentages and guards against zero', () => {
        expect(pct(25, 200)).toBe('12.5%');
        expect(pct(5, 0)).toBe('—');
    });

    it('title-cases categories', () => {
        expect(titleCase('credit card payment')).toBe('Credit Card Payment');
        expect(titleCase('family & gifts')).toBe('Family & Gifts');
        expect(titleCase(null)).toBe('Uncategorized');
    });
});

describe('category rules', () => {
    it('rule sets only use real categories and never overlap', () => {
        for (const set of [EXCLUDED, INCOME, SAVINGS]) {
            for (const c of set) expect(CATEGORIES).toContain(c);
        }
        const all = [...EXCLUDED, ...INCOME, ...SAVINGS];
        expect(new Set(all).size).toBe(all.length);
    });

    it('has no duplicate categories', () => {
        expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
    });

    it('explains every total shown in the UI', () => {
        for (const key of ['income', 'spending', 'cardSpending', 'netPosition', 'invested', 'marcus',
            'investedPlusMarcus', 'incomeSplit', 'byCategory', 'visibleTotals', 'selectedTotals']) {
            expect(EXPLAIN[key]).toBeTruthy();
        }
    });
});

describe('date presets', () => {
    afterEach(() => vi.useRealTimers());

    const range = (label) => PRESETS.find((p) => p.label === label).range().map((d) => d.format('YYYY-MM-DD'));

    it('are computed from today', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-15T12:00:00'));
        expect(range('This month')).toEqual(['2026-03-01', '2026-03-15']);
        expect(range('Last month')).toEqual(['2026-02-01', '2026-02-28']);
        expect(range('Last 3 months')).toEqual(['2025-12-01', '2026-03-15']);
        expect(range('Year to date')).toEqual(['2026-01-01', '2026-03-15']);
        expect(range('Last year')).toEqual(['2025-01-01', '2025-12-31']);
    });

    it('never start after they end', () => {
        for (const p of PRESETS) {
            const [from, to] = p.range();
            expect(dayjs.isDayjs(from) && !from.isAfter(to)).toBe(true);
        }
    });
});

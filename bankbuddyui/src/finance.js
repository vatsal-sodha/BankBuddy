// Shared money/category helpers for the Transactions and Categories tabs.
import dayjs from 'dayjs';

export const API = 'http://127.0.0.1:5000/api';

// Every category the user can pick (keep in sync with the backend prompt)
export const CATEGORIES = [
    'paycheck', 'other income', 'transfer', 'credit card payment',
    'home mortgage', 'home', 'utilities', 'rent', 'auto', 'gas', 'parking', 'travel',
    'restaurant', 'groceries', 'medical', 'amazon', 'walmart',
    'shopping', 'subscriptions', 'donations', 'insurance',
    'investments', 'marcus transfer', 'taxes', 'personal care',
    'entertainment', 'family & gifts', 'fees', 'other expenses', 'cash',
];

// Same rules as the backend summary
export const EXCLUDED = new Set(['credit card payment', 'transfer']); // moves between own accounts
export const SAVINGS = new Set(['investments', 'marcus transfer']);   // tracked separately
export const INCOME = new Set(['paycheck', 'other income']);          // everything else is spending

export const PRESETS = [
    { label: 'This month', range: () => [dayjs().startOf('month'), dayjs()] },
    { label: 'Last month', range: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
    { label: 'Last 3 months', range: () => [dayjs().subtract(3, 'month').startOf('month'), dayjs()] },
    { label: 'Year to date', range: () => [dayjs().startOf('year'), dayjs()] },
    { label: 'Last year', range: () => [dayjs().subtract(1, 'year').startOf('year'), dayjs().subtract(1, 'year').endOf('year')] },
];

export const money = (value, cents = false) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
    }).format(value || 0);

// "+$1,234.56" / "−$24.55" - explicit sign for money flows
export const signedMoney = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), true)}`;

export const pct = (part, whole) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');

export const titleCase = (s) => (s || 'uncategorized').replace(/\b\w/g, (c) => c.toUpperCase());

// Positive = money in, negative = money out. Credit cards store charges as
// positive, so their sign is flipped; checking/savings already match.
export const isCard = (t) => t.account_type === 'credit/debit';
export const moneyFlow = (t) => (isCard(t) ? -t.amount : t.amount);
export const storedAmount = (t, flow) => (isCard(t) ? -flow : flow);

// How each total is calculated - shown in the (i) tooltips on both tabs
export const EXPLAIN = {
    income:
        'Money received in the Paycheck and Other income categories, on any account (salary, tax refunds, people paying you back).\n\n' +
        'Not included: transfers between your own accounts, card payments, investments and Marcus.',
    spending:
        'Money spent in every other category, on checking and credit cards: purchases and bills minus refunds in those categories.\n\n' +
        'Not included: credit card payments and transfers (the purchases are already counted on the card, so paying the bill would count them twice), investments and Marcus.',
    cardSpending:
        'Purchases charged to your credit cards in spending categories, before refunds.\n\n' +
        'This is part of Spending, not in addition to it. The rest of Spending was paid straight from checking (mortgage, rent, car loan, taxes…).',
    netPosition:
        'Income − Spending: what you kept this period before moving money into investments or Marcus.\n\n' +
        'Savings rate = Net position ÷ Income.',
    invested:
        'Money moved into investments (brokerage, crypto…) minus money taken out of them.\n\n' +
        'Not spending and not income - it is your money, just somewhere else.',
    marcus:
        'Money moved into your Marcus savings account minus money moved out.\n\n' +
        'Tracked on its own because it can be savings or later spending.',
    investedPlusMarcus:
        'Invested + Marcus: net money moved into investments and into Marcus (in minus out).\n\n' +
        'If this is larger than Net position, the difference came from cash you already had.',
    incomeSplit:
        'Each part as a share of Income:\n' +
        '• Spending = Spending total\n' +
        '• Invested = net moved into investments\n' +
        '• Moved to Marcus = net moved into Marcus\n' +
        '• Kept as cash = Income − all three (only shown when positive)',
    byCategory:
        'Net per category: money spent minus refunds in that category, across checking and cards.\n' +
        'The % is that category\'s share of total Spending. Card payments and transfers are not shown (they would double count).',
    incomeList: 'Money received per income category, across all accounts. % = share of Income.',
    savingsList: 'Net money moved into each savings bucket (in minus out). Not counted as spending.',
    visibleTotals:
        'Sum of the rows currently in the table (after search and filters).\n' +
        'In = positive amounts, Out = negative amounts.\n\n' +
        'Note: card payments and transfers appear on both sides (leaving one account, arriving at another), so with those rows included In/Out is not income or spending - use the tiles above for that.',
    selectedTotals:
        'Sum of the selected rows. In = positive amounts, Out = negative amounts, Net = In − Out.',
};

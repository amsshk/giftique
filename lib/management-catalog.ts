export const accountingReports = {
  profit_loss: { name: "Profit and Loss Statement", title: "Profit & loss", description: "Income, expenses, and net profit from posted accounting entries." },
  balance_sheet: { name: "Balance Sheet", title: "Balance sheet", description: "Assets, liabilities, and equity for Giftique." },
  cash_flow: { name: "Cash Flow", title: "Cash flow", description: "Operating, investing, and financing cash movements." },
  gross_profit: { name: "Gross Profit", title: "Gross profit", description: "Sales less ERPNext's recorded cost of goods sold." },
  trial_balance: { name: "Trial Balance", title: "Trial balance", description: "Opening balances, debits, credits, and closing balances." },
  general_ledger: { name: "General Ledger", title: "General ledger", description: "The accounting entries behind each transaction." },
  receivables: { name: "Accounts Receivable", title: "Customer credit & dues", description: "Customer balances, overdue invoices, and ageing." },
  payables: { name: "Accounts Payable", title: "Supplier dues", description: "Supplier balances, unpaid bills, and ageing." },
} as const;

export type AccountingReportId = keyof typeof accountingReports;
export type ReportColumn = { fieldname: string; label: string; fieldtype: string; options?: string };
export type ReportRow = Record<string, string | number | boolean | null>;
export type AccountingReport = {
  title: string;
  company: string;
  currency: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: { label: string; value: string | number | null; datatype?: string; currency?: string }[];
};

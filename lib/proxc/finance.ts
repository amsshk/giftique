import { accountingReports, type AccountingReport, type AccountingReportId, type ReportColumn, type ReportRow } from "../management-catalog";
import { proxcRequest } from "./client";
import { ManagementError } from "./management-operations";

export const GIFTIQUE_COMPANY = "Giftique";
type Filters = (string | number | string[])[][];

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new ManagementError("Choose a valid date.", 400);
  }
  return value;
}

export function validatePeriod(from: string, to: string) {
  validDate(from); validDate(to);
  if (from > to) throw new ManagementError("The end date must be on or after the start date.", 400);
  if (Date.parse(to) - Date.parse(from) > 731 * 86400000) throw new ManagementError("Choose a reporting period of two years or less.", 400);
}

export async function financeList<T>(doctype: string, fields: string[], filters: Filters, page = 0, orderBy = "modified desc") {
  if (!Number.isInteger(page) || page < 0 || page > 10000) throw new ManagementError("Invalid page.", 400);
  const query = new URLSearchParams({ fields: JSON.stringify(fields), filters: JSON.stringify(filters), order_by: orderBy, limit_start: String(page * 50), limit_page_length: "51" });
  const response = await proxcRequest("GET", `/api/resource/${encodeURIComponent(doctype)}?${query}`) as { data: T[] };
  if (!Array.isArray(response?.data)) throw new Error("ERPNext returned an invalid record list.");
  return { records: response.data.slice(0, 50), hasMore: response.data.length > 50 };
}

export async function financeDocument<T extends { company?: string }>(doctype: string, name: string): Promise<T> {
  if (!name || name.length > 140 || /[\x00-\x1f/\\]/.test(name)) throw new ManagementError("Invalid record name.", 400);
  const response = await proxcRequest("GET", `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`) as { data: T };
  if (!response?.data) throw new Error("ERPNext did not return the record.");
  if (response.data.company !== GIFTIQUE_COMPANY) throw new ManagementError("Giftique record not found.", 404);
  return response.data;
}

function plainText(value: unknown): string {
  return String(value ?? "").replace(/<[^>]*>/g, "").slice(0, 1000);
}

export async function runAccountingReport(id: AccountingReportId, from: string, to: string): Promise<AccountingReport> {
  if (!Object.hasOwn(accountingReports, id)) throw new ManagementError("Unknown accounting report.", 400);
  validatePeriod(from, to);
  const definition = accountingReports[id];
  const filters: Record<string, unknown> = { company: GIFTIQUE_COMPANY, from_date: from, to_date: to };
  if (["profit_loss", "balance_sheet", "cash_flow"].includes(id)) {
    Object.assign(filters, { filter_based_on: "Date Range", period_start_date: from, period_end_date: to, periodicity: "Monthly", accumulated_values: id === "balance_sheet" ? 1 : 0, include_default_book_entries: 1 });
  }
  if (id === "gross_profit") Object.assign(filters, { group_by: "Invoice", include_returned_invoices: 1 });
  if (id === "general_ledger") Object.assign(filters, { categorize_by: "Categorize by Voucher (Consolidated)", include_default_book_entries: 1 });
  if (id === "receivables" || id === "payables") Object.assign(filters, { report_date: to, ageing_based_on: "Due Date", range1: 30, range2: 60, range3: 90, range4: 120 });
  if (id === "trial_balance") {
    const years = await financeList<{ name: string }>("Fiscal Year", ["name"], [["year_start_date", "<=", from], ["year_end_date", ">=", to], ["disabled", "=", 0]], 0, "year_start_date desc");
    if (!years.records.length) throw new ManagementError("For trial balance, choose dates within one configured fiscal year.", 400);
    filters.fiscal_year = years.records[0].name;
  }
  const response = await proxcRequest("POST", "/api/method/frappe.desk.query_report.run", { report_name: definition.name, filters, ignore_prepared_report: 1, are_default_filters: 0 }) as {
    message?: { columns?: (ReportColumn | string)[]; result?: (Record<string, unknown> | unknown[])[]; report_summary?: { label: string; value: string | number | null; datatype?: string; currency?: string }[]; prepared_report?: boolean };
  };
  const report = response?.message;
  if (!report || !Array.isArray(report.columns) || !Array.isArray(report.result) || report.prepared_report) throw new Error("ERPNext has not returned the completed report.");
  const columns: ReportColumn[] = report.columns.map((column, index) => typeof column === "string"
    ? { fieldname: String(index), label: plainText(column.split(":")[0]), fieldtype: column.split(":")[1]?.split("/")[0] || "Data" }
    : { fieldname: column.fieldname, label: plainText(column.label), fieldtype: column.fieldtype || "Data", options: column.options });
  const rows: ReportRow[] = report.result.filter(Boolean).map(row => Object.fromEntries(columns.map((column, index) => {
    const value = Array.isArray(row) ? row[index] : row[column.fieldname];
    return [column.fieldname, typeof value === "number" || typeof value === "boolean" || value == null ? value ?? null : plainText(value)];
  })));
  return { title: definition.title, company: GIFTIQUE_COMPANY, currency: "AED", columns, rows, summary: (report.report_summary || []).map(item => ({ label: plainText(item.label), value: typeof item.value === "number" || item.value == null ? item.value : plainText(item.value), datatype: item.datatype, currency: item.currency })) };
}

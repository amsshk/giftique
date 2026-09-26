# Giftique business integration

Copy `proxc/giftique_business.py` and `proxc/setup_giftique_business.py` into the **existing** PROXC app's `proxc/integrations/` package. Include both in the ERPNext image used by backend, workers, scheduler and frontend. Do not replace existing PROXC customizations.

## Requirements

- Frappe/ERPNext v16; tested on Frappe16.35 / ERPNext16.36.
- HRMS version16, pinned for this deployment to `c0a04b80eeb721417b75cea758e831464d0da041` (16.20.0). Build/install the app before running the setup migration. All workers must run the same image; `sites/apps.txt` and the site's installed apps must both include hrms.
- Existing Company `Giftique`, restricted integration user with Giftique Owner, and a Company User Permission applying to all doctypes.
- Back up the database, site configuration, and files before installation.

Run as the site administrator:

```sh
bench --site frontend execute proxc.integrations.setup_giftique_business.execute
```

This idempotent migration adds request IDs/audit fields, Giftique scope fields for global records, explicitly scoped business permissions, report role overrides, and a Giftique letterhead. It does not grant administrative roles or change other companies' accounting defaults.

If container PDF generation cannot reach assets through the default site URL, configure an internal frontend origin accessible from the backend, for example in this Docker Compose deployment:

```sh
bench --site frontend set-config giftique_pdf_origin http://frontend:8080
```

This setting is used only while rendering PDFs. The public site hostname is unchanged.

## Owner workflows

- **Accounting:** profit & loss, balance sheet, cash flow, gross profit, trial balance, general ledger, receivables and payables. Create chart accounts and draft balanced journals.
- **Cash & Banks:** posted ledger balances; bank account records; receive/pay against submitted outstanding invoices. Bank payments require the real transaction reference/date. Review and submit the resulting Payment Entry. This does not initiate a transfer or synchronize bank feeds. This payment form requires matching invoice, party-ledger and cash/bank currencies.
- **Credit & Bills:** suppliers, customers, expense/purchase invoice drafts with explicit tax rows, full sales credit note drafts. Review credit notes in Operations → Invoices. Partial returns are not supported by this form.
- **Staff:** employees, departments, designations, holiday lists and holiday assignments. Submit holiday assignments for the appropriate company/employee and date. Creating an employee does not provision a login.
- **Payroll:** salary components with company expense accounts → submitted salary structure → submitted employee assignment → payroll draft → submit to create salary slips → review → submit reviewed slips to post accrual. Payroll payable accounts must have type Payable. Configure working-day/holiday policies and actual salaries before use. Payment of salaries through a bank remains separate; use the journal workflow for the accounting entry. Automated payslip emails should remain off until an outgoing sender is configured; manual emailing is available in Documents.
- **Company & Documents:** real profile/logo/TRN, branded ERPNext document PDFs, downloadable company letters, and queued document emails. Letter text is not stored.

## Email configuration

An administrator must configure a dedicated outgoing **Email Account named Giftique** using the client's business sender/provider. Secrets belong in ERPNext's protected email configuration, never in browser settings or source control. The website owner cannot read email credentials. Without that account, the UI disables sending and the backend rejects it. Email delivery must be verified after configuration; a queued message does not prove delivery.

## Validation

Run `node --test tests/management-finance.test.mjs tests/management-operations.test.mjs`, affected ESLint, TypeScript and the production build. Native integration checks must use synthetic data in a disposable environment or a transaction that forbids commit and rolls back. HRMS payroll helpers normally commit internally; use its `frappe.in_test` guard **and** reject any commit in a validation process. Never test accounting postings or outgoing email against real business records.

Owner-only website APIs validate the Supabase user server-side. PROXC checks the owner role, native document permissions, company scope, allowlisted fields, modified timestamps and request IDs. Client-supplied company or actor fields are rejected. ERPNext validates and calculates accounting/payroll values.

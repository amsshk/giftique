"""Run once via bench execute as Administrator; never a public API."""
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from proxc.integrations.giftique_business import KINDS, SCOPED_GLOBAL, COMPANY, ROLE, _update_letterhead

REPORTS = ["Profit and Loss Statement", "Balance Sheet", "Cash Flow", "Gross Profit", "Trial Balance", "General Ledger", "Accounts Receivable", "Accounts Payable"]

def execute():
    if frappe.session.user != "Administrator":
        frappe.throw("Run the installation as Administrator.", frappe.PermissionError)
    fields = {}
    for dt in set([d[0] for d in KINDS.values()] + ["Sales Invoice", "Communication"]):
        fields[dt] = [
            {"fieldname": "custom_giftique_request_id", "label": "Giftique Request ID", "fieldtype": "Data", "unique": 1, "read_only": 1, "hidden": 1, "no_copy": 1},
            {"fieldname": "custom_giftique_actor", "label": "Giftique User ID", "fieldtype": "Data", "read_only": 1, "hidden": 1, "allow_on_submit": 1, "no_copy": 1},
        ]
    for dt in SCOPED_GLOBAL:
        fields.setdefault(dt, []).append({"fieldname": "custom_giftique_company", "label": "Giftique Company", "fieldtype": "Link", "options": "Company", "read_only": 1, "hidden": 1})
    fields["Company"] = [
        {"fieldname": "custom_giftique_display_name", "label": "Giftique Display Name", "fieldtype": "Data"},
        {"fieldname": "custom_giftique_address", "label": "Giftique Letterhead Address", "fieldtype": "Small Text"},
    ]
    create_custom_fields(fields, update=True)
    # Grant explicit business capabilities without Accounts Manager, HR Manager or System Manager.
    write = set(d[0] for d in KINDS.values())
    read = {"GL Entry", "Payment Ledger Entry", "Fiscal Year", "Report", "Bank", "Gender", "Department", "Designation", "Holiday List", "Employment Type", "Branch", "Supplier Group", "Mode of Payment", "Salary Component", "Salary Structure", "Salary Structure Assignment", "Payroll Period", "Project", "Finance Book", "Letter Head", "Employee", "Journal Entry Account", "Sales Taxes and Charges Template", "Purchase Taxes and Charges Template"}
    printable = {"Sales Invoice", "Sales Order", "Delivery Note", "Salary Slip", "Purchase Invoice", "Payment Entry", "Journal Entry"}
    for dt in sorted(write | read | printable):
        if not frappe.db.exists("DocType", dt) or frappe.get_meta(dt).istable:
            continue
        name = frappe.db.get_value("Custom DocPerm", {"parent": dt, "role": ROLE, "permlevel": 0}, "name")
        doc = frappe.get_doc("Custom DocPerm", name) if name else frappe.new_doc("Custom DocPerm")
        doc.update({"parent": dt, "parenttype": "DocType", "parentfield": "permissions", "role": ROLE, "permlevel": 0, "read": 1, "report": 1})
        if dt in write:
            doc.update({"create": 1, "write": 1, "submit": int(bool(frappe.get_meta(dt).is_submittable))})
        if dt in printable:
            doc.update({"print": 1, "email": 1})
        doc.save(ignore_permissions=True)
    for report_name in REPORTS:
        report = frappe.get_doc("Report", report_name)
        existing = frappe.db.get_value("Custom Role", {"report": report_name}, "name")
        doc = frappe.get_doc("Custom Role", existing) if existing else frappe.new_doc("Custom Role")
        doc.report = report_name
        if not existing:
            doc.set("roles", [{"role": row.role} for row in report.roles])
        if ROLE not in [row.role for row in doc.roles]:
            doc.append("roles", {"role": ROLE})
        doc.save(ignore_permissions=True)
    _update_letterhead()
    frappe.clear_cache()
    frappe.db.commit()
    print("Giftique business setup complete")

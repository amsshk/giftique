"""Owner-only Giftique business operations. Installed inside the PROXC app."""
import base64
import html
import io
import json
import math
import re
import uuid
from contextlib import contextmanager

import frappe
from frappe.utils import cint, getdate

COMPANY = "Giftique"
LETTER_HEAD = "Giftique"
ROLE = "Giftique Owner"

# All fields and document types accepted by this API are listed here.
KINDS = {
    "sales_invoices": ("Sales Invoice", [], ["customer_name", "posting_date", "grand_total", "outstanding_amount", "status"]),
    "holiday_assignments": ("Holiday List Assignment", ["applicable_for", "assigned_to", "holiday_list", "from_date"], ["applicable_for", "assigned_to", "holiday_list", "from_date"]),
    "holiday_lists": ("Holiday List", ["holiday_list_name", "from_date", "to_date", "holidays"], ["holiday_list_name", "from_date", "to_date"]),
    "banks": ("Bank", ["bank_name", "swift_number", "website"], ["bank_name", "swift_number"]),
    "departments": ("Department", ["department_name", "parent_department"], ["department_name"]),
    "designations": ("Designation", ["designation_name", "description"], ["designation_name"]),
    "employees": ("Employee", ["first_name", "last_name", "gender", "date_of_birth", "date_of_joining", "status", "designation", "department", "company_email", "personal_email", "cell_number", "bank_name", "bank_ac_no", "iban", "holiday_list"], ["employee_name", "status", "designation", "department"]),
    "customers": ("Customer", ["customer_name", "customer_type", "customer_group", "territory", "email_id", "mobile_no"], ["customer_name", "email_id", "mobile_no"]),
    "suppliers": ("Supplier", ["supplier_name", "supplier_type", "supplier_group", "email_id", "mobile_no"], ["supplier_name", "supplier_type"]),
    "accounts": ("Account", ["account_name", "parent_account", "account_type", "is_group", "account_currency", "root_type", "report_type"], ["account_name", "account_type", "root_type", "account_currency"]),
    "bank_accounts": ("Bank Account", ["account_name", "bank", "account", "bank_account_no", "iban", "branch_code", "is_default", "disabled"], ["account_name", "bank", "account", "disabled"]),
    "purchase_invoices": ("Purchase Invoice", ["supplier", "posting_date", "due_date", "bill_no", "bill_date", "items", "taxes"], ["supplier_name", "posting_date", "grand_total", "outstanding_amount", "status"]),
    "payments": ("Payment Entry", ["posting_date", "mode_of_payment", "reference_no", "reference_date", "remarks"], ["payment_type", "party_name", "posting_date", "paid_amount", "mode_of_payment", "status"]),
    "journals": ("Journal Entry", ["posting_date", "voucher_type", "user_remark", "accounts"], ["posting_date", "voucher_type", "total_debit", "total_credit"]),
    "salary_components": ("Salary Component", ["salary_component", "salary_component_abbr", "type", "description", "accounts"], ["salary_component", "type"]),
    "salary_structures": ("Salary Structure", ["payroll_frequency", "is_active", "currency", "payment_account", "earnings", "deductions"], ["payroll_frequency", "is_active", "currency"]),
    "salary_assignments": ("Salary Structure Assignment", ["employee", "salary_structure", "from_date", "base", "variable", "payroll_payable_account"], ["employee_name", "salary_structure", "from_date", "base"]),
    "salary_slips": ("Salary Slip", ["employee", "posting_date", "start_date", "end_date"], ["employee_name", "start_date", "end_date", "gross_pay", "total_deduction", "net_pay", "status"]),
    "payroll_runs": ("Payroll Entry", ["posting_date", "start_date", "end_date", "payroll_frequency", "cost_center", "payroll_payable_account", "payment_account", "currency", "exchange_rate"], ["start_date", "end_date", "number_of_employees", "status", "salary_slips_created", "salary_slips_submitted"]),
}
CHILD_FIELDS = {
    ("holiday_lists", "holidays"): ["holiday_date", "description", "weekly_off"],
    ("purchase_invoices", "taxes"): ["charge_type", "account_head", "description", "rate", "tax_amount"],
    ("purchase_invoices", "items"): ["item_code", "item_name", "qty", "uom", "rate", "expense_account", "cost_center"],
    ("journals", "accounts"): ["account", "debit_in_account_currency", "credit_in_account_currency", "cost_center", "party_type", "party"],
    ("salary_components", "accounts"): ["account"],
    ("salary_structures", "earnings"): ["salary_component", "amount", "amount_based_on_formula", "formula"],
    ("salary_structures", "deductions"): ["salary_component", "amount", "amount_based_on_formula", "formula"],
}
SCOPED_GLOBAL = {"Customer", "Supplier", "Salary Component", "Bank", "Designation", "Holiday List", "Holiday List Assignment"}
PRINT_KINDS = {"invoice": "Sales Invoice", "order": "Sales Order", "delivery": "Delivery Note", "salary_slip": "Salary Slip", "purchase_invoice": "Purchase Invoice"}


def _owner():
    if frappe.session.user == "Guest" or ROLE not in frappe.get_roles():
        frappe.throw("Giftique owner access is required.", frappe.PermissionError)


def _kind(kind):
    if kind not in KINDS:
        frappe.throw("Unknown business area.")
    dt, fields, columns = KINDS[kind]
    if not frappe.db.exists("DocType", dt):
        frappe.throw(f"{dt} is not installed. Payroll requires the HRMS app.")
    return dt, fields, columns


def _filters(doctype):
    if doctype in SCOPED_GLOBAL:
        if doctype == "Customer":
            names = set(frappe.get_all("Sales Order", filters={"company": COMPANY}, pluck="customer"))
            names.update(frappe.get_all("Customer", filters={"custom_giftique_company": COMPANY}, pluck="name"))
            return {"name": ["in", sorted(names) or [""]]}
        return {"custom_giftique_company": COMPANY}
    if doctype == "Company":
        return {"name": COMPANY}
    if frappe.get_meta(doctype).has_field("company"):
        return {"company": COMPANY}
    return {}


def _owned(doc):
    if doc.doctype in SCOPED_GLOBAL:
        if doc.get("custom_giftique_company") == COMPANY:
            return
        if doc.doctype == "Customer" and frappe.db.exists("Sales Order", {"company": COMPANY, "customer": doc.name}):
            return
    elif doc.get("company") == COMPANY:
        return
    frappe.throw("Giftique record not found.", frappe.PermissionError)


def _document(kind, name, permission="read"):
    doctype, _, _ = _kind(kind)
    doc = frappe.get_doc(doctype, name)
    _owned(doc)
    doc.check_permission(permission)
    return doc


def _current(doc, modified):
    if not modified or str(doc.modified) != str(modified):
        frappe.throw("This record changed. Refresh it before continuing.", frappe.TimestampMismatchError)


def _field(meta, fieldname, kind=None):
    field = meta.get_field(fieldname)
    if not field:
        return None
    descriptor = {"name": fieldname, "label": field.label or fieldname, "type": field.fieldtype, "required": bool(field.reqd), "default": field.default}
    if fieldname == "currency":
        descriptor["default"] = frappe.get_cached_value("Company", COMPANY, "default_currency")
    if fieldname == "exchange_rate":
        descriptor["default"] = "1"
    if fieldname == "cost_center":
        descriptor["default"] = frappe.get_cached_value("Company", COMPANY, "cost_center")
    if kind == "holiday_assignments" and fieldname in ["applicable_for", "assigned_to"]:
        descriptor["default"] = "Company" if fieldname == "applicable_for" else COMPANY
    if field.fieldtype == "Select":
        descriptor["options"] = (field.options or "").split("\n")
    if field.fieldtype == "Link":
        descriptor["link"] = field.options
    if field.fieldtype == "Table":
        child = frappe.get_meta(field.options)
        descriptor["fields"] = [f for name in CHILD_FIELDS.get((kind, fieldname), []) if (f := _field(child, name))]
    return descriptor


def _descriptor(kind):
    dt, fields, columns = _kind(kind)
    meta = frappe.get_meta(dt)
    return {"id": kind, "doctype": dt, "submittable": bool(meta.is_submittable), "nameRequired": (meta.autoname or "").lower() == "prompt", "canCreate": kind not in ["payments", "sales_invoices"], "fields": [f for name in fields if (f := _field(meta, name, kind))], "columns": [f for name in columns if (f := _field(meta, name))]}


def _profile():
    company = frappe.get_doc("Company", COMPANY)
    return {"name": COMPANY, "display_name": company.get("custom_giftique_display_name") or COMPANY, "currency": company.default_currency, "email": company.email or "", "phone_no": company.phone_no or "", "tax_id": company.tax_id or "", "website": company.website or "", "address": company.get("custom_giftique_address") or "", "has_logo": bool(company.company_logo), "letter_head": company.default_letter_head, "modified": str(company.modified)}


@frappe.whitelist()
def capabilities():
    _owner()
    installed = "hrms" in frappe.get_installed_apps()
    forms = [_descriptor(kind) for kind, (dt, _, _) in KINDS.items() if frappe.db.exists("DocType", dt)]
    email = frappe.db.get_value("Email Account", {"name": COMPANY, "enable_outgoing": 1}, "email_id")
    return {"payroll": installed, "email_ready": bool(email), "sender": email, "profile": _profile(), "forms": forms}


@frappe.whitelist()
def records(kind, page=0, search=""):
    _owner()
    dt, fields, columns = _kind(kind)
    page = cint(page)
    if page < 0 or page > 10000:
        frappe.throw("Invalid page.")
    filters = _filters(dt)
    if search:
        filters[frappe.get_meta(dt).title_field or "name"] = ["like", "%" + str(search)[:80] + "%"]
    selected = ["name", "modified", "docstatus"] + [f for f in columns if frappe.get_meta(dt).has_field(f)]
    rows = frappe.get_list(dt, fields=selected, filters=filters, order_by="modified desc", limit_start=page * 50, limit_page_length=51)
    return {"records": rows[:50], "hasMore": len(rows) > 50}


@frappe.whitelist()
def record(kind, name):
    _owner()
    doc = _document(kind, name)
    return _serialize(kind, doc)


def _serialize(kind, doc):
    _, fields, columns = _kind(kind)
    names = set(fields + columns + ["name", "modified", "docstatus", "status", "currency", "grand_total", "outstanding_amount", "gross_pay", "net_pay", "total_deduction", "total_debit", "total_credit"])
    result = {key: doc.get(key) for key in names if key not in [field for area, field in CHILD_FIELDS if area == kind]}
    for (area, table), children in CHILD_FIELDS.items():
        if area == kind:
            result[table] = [{f: row.get(f) for f in children} for row in (doc.get(table) or [])]
    if kind == "salary_slips":
        for table in ["earnings", "deductions"]:
            result[table] = [{"salary_component": row.salary_component, "amount": row.amount} for row in doc.get(table, [])]
    if kind == "payroll_runs":
        result["error_message"] = re.sub(r"<[^>]*>", "", doc.error_message or "")[:800]
        result["employees"] = [{"employee": row.employee, "employee_name": row.employee_name} for row in doc.employees]
    return result


@frappe.whitelist()
def choices(kind, field, search="", table=None):
    _owner()
    dt, fields, _ = _kind(kind)
    if table:
        if field not in CHILD_FIELDS.get((kind, table), []):
            frappe.throw("Unknown field.")
        meta = frappe.get_meta(frappe.get_meta(dt).get_field(table).options)
    else:
        if field not in fields:
            frappe.throw("Unknown field.")
        meta = frappe.get_meta(dt)
    definition = meta.get_field(field)
    if not definition or definition.fieldtype != "Link":
        frappe.throw("This field does not accept linked records.")
    linked = definition.options
    linked_meta = frappe.get_meta(linked)
    filters = _filters(linked)
    if linked == "Item":
        filters.update({"name": ["like", "GFT-%"], "disabled": 0})
    if linked == "Account":
        filters["is_group"] = 1 if field == "parent_account" else 0
        if field == "payroll_payable_account":
            filters["account_type"] = "Payable"
        if field == "payment_account":
            filters["account_type"] = ["in", ["Bank", "Cash"]]
    if search:
        filters[linked_meta.title_field or "name"] = ["like", "%" + str(search)[:80] + "%"]
    display = linked_meta.title_field or "name"
    rows = frappe.get_list(linked, fields=list(dict.fromkeys(["name", display])), filters=filters, order_by="name asc", limit_page_length=50)
    return [{"value": row.name, "label": row.get(display) or row.name} for row in rows]


def _sanitize(kind, meta, fields, values):
    if not isinstance(values, dict) or set(values) - set(fields):
        frappe.throw("The form contains unsupported fields.")
    result = {}
    for name, value in values.items():
        field = meta.get_field(name)
        if value is None:
            value = ""
        if not field:
            frappe.throw("The form contains an unavailable field.")
        if field.fieldtype == "Table":
            if not isinstance(value, list) or len(value) > 100:
                frappe.throw("A table may contain up to 100 rows.")
            result[name] = [_sanitize(kind, frappe.get_meta(field.options), CHILD_FIELDS.get((kind, name), []), row) for row in value]
            if kind == "salary_components":
                for row in result[name]:
                    row["company"] = COMPANY
        elif field.fieldtype in ["Currency", "Float", "Int", "Percent"]:
            try:
                number = float(value or 0)
            except (ValueError, TypeError):
                frappe.throw(f"{field.label} must be a number.")
            if not math.isfinite(number):
                frappe.throw(f"{field.label} must be a finite number.")
            result[name] = number
        elif field.fieldtype == "Check":
            result[name] = 1 if value in [True, 1, "1"] else 0
        else:
            if not isinstance(value, str) or len(value) > 2000:
                frappe.throw(f"Invalid value for {field.label}.")
            if value and field.fieldtype == "Date":
                getdate(value)
            if value and field.fieldtype == "Select" and value not in (field.options or "").split("\n"):
                frappe.throw(f"Invalid option for {field.label}.")
            if value and field.fieldtype == "Link":
                linked = frappe.get_doc(field.options, value)
                linked.check_permission("read")
                if linked.meta.has_field("company") and linked.company and linked.company != COMPANY:
                    frappe.throw("Linked records must belong to Giftique.", frappe.PermissionError)
                if linked.doctype in SCOPED_GLOBAL:
                    _owned(linked)
            result[name] = value
    if result.get("party"):
        if result.get("party_type") not in ["Customer", "Supplier", "Employee"]:
            frappe.throw("Choose Customer, Supplier or Employee as the party type.")
        party = frappe.get_doc(result["party_type"], result["party"])
        _owned(party); party.check_permission("read")
    if kind == "holiday_assignments" and result.get("assigned_to"):
        if result.get("applicable_for") == "Company":
            if result["assigned_to"] != COMPANY:
                frappe.throw("Choose Giftique as the company.", frappe.PermissionError)
        elif result.get("applicable_for") == "Employee":
            employee = frappe.get_doc("Employee", result["assigned_to"])
            _owned(employee); employee.check_permission("read")
        else:
            frappe.throw("Choose Company or Employee for the holiday assignment.")
    return result


@frappe.whitelist(methods=["POST"])
def save_record(kind, data, request_id, actor, name=None, expected_modified=None, record_name=None):
    _owner()
    dt, fields, _ = _kind(kind)
    if kind == "sales_invoices":
        frappe.throw("Use the invoice operations to manage sales invoices.")
    request_id = str(uuid.UUID(request_id))
    if not frappe.get_meta(dt).has_field("custom_giftique_request_id"):
        frappe.throw("Giftique business features need their setup migration.")
    if isinstance(data, str):
        data = json.loads(data)
    values = _sanitize(kind, frappe.get_meta(dt), fields, data)
    if name:
        doc = _document(kind, name, "write")
        _current(doc, expected_modified)
        if doc.docstatus != 0:
            frappe.throw("Only draft documents can be edited.")
    else:
        if kind == "payments":
            frappe.throw("Create payments from an invoice.")
        existing = frappe.db.get_value(dt, {"custom_giftique_request_id": request_id}, "name")
        if existing:
            return record(kind, existing)
        doc = frappe.new_doc(dt)
        if doc.meta.has_field("company"):
            doc.company = COMPANY
        if dt in SCOPED_GLOBAL:
            doc.custom_giftique_company = COMPANY
        if (doc.meta.autoname or "").lower() == "prompt":
            if not record_name or len(record_name) > 140 or any(c in record_name for c in "<>/\\"):
                frappe.throw("Enter a valid record name.")
            doc.name = record_name
        doc.custom_giftique_request_id = request_id
    doc.update(values)
    doc.custom_giftique_actor = str(actor)[:140]
    if kind == "bank_accounts":
        doc.is_company_account = 1
    if doc.meta.has_field("currency") and not doc.currency:
        doc.currency = frappe.get_cached_value("Company", COMPANY, "default_currency")
    if doc.meta.has_field("exchange_rate") and not doc.exchange_rate:
        if doc.currency != frappe.get_cached_value("Company", COMPANY, "default_currency"):
            frappe.throw("Enter an exchange rate for foreign currency payroll.")
        doc.exchange_rate = 1
    if kind == "purchase_invoices":
        doc.update_stock = 0
    if kind == "payroll_runs":
        doc.fill_employee_details()
    doc.save()
    return _serialize(kind, doc)


@frappe.whitelist(methods=["POST"])
def submit_record(kind, name, expected_modified, actor):
    _owner()
    doc = _document(kind, name, "submit")
    _current(doc, expected_modified)
    if not doc.meta.is_submittable or doc.docstatus != 0:
        frappe.throw("Only draft transactions can be submitted.")
    if kind == "salary_slips" and doc.payroll_entry:
        frappe.throw("Submit these salary slips together from their payroll run to create the payroll accrual.")
    doc.custom_giftique_actor = str(actor)[:140]
    doc.submit()
    doc.reload()
    return _serialize(kind, doc)


@frappe.whitelist(methods=["POST"])
def submit_payroll_slips(name, expected_modified, actor):
    _owner()
    doc = _document("payroll_runs", name, "submit")
    _current(doc, expected_modified)
    if doc.docstatus != 1 or not doc.salary_slips_created or doc.salary_slips_submitted:
        frappe.throw("Create and review the draft salary slips before submitting payroll.")
    doc.submit_salary_slips()
    doc.reload()
    return _serialize("payroll_runs", doc)


@frappe.whitelist()
def bank_balances(date):
    _owner()
    from erpnext.accounts.utils import get_balance_on
    date = getdate(date)
    accounts = frappe.get_list("Account", filters={"company": COMPANY, "is_group": 0, "disabled": 0, "account_type": ["in", ["Bank", "Cash"]]}, fields=["name", "account_name", "account_type", "account_currency"], limit_page_length=0)
    return [{**row, "balance": get_balance_on(account=row.name, date=date, company=COMPANY)} for row in accounts]


@frappe.whitelist()
def invoice_choices(direction="Receive", search=""):
    _owner()
    if direction not in ["Receive", "Pay"]:
        frappe.throw("Choose Receive or Pay.")
    dt = "Sales Invoice" if direction == "Receive" else "Purchase Invoice"
    filters = {"company": COMPANY, "docstatus": 1, "outstanding_amount": [">", 0]}
    if search:
        filters["name"] = ["like", "%" + str(search)[:80] + "%"]
    party = "customer_name" if direction == "Receive" else "supplier_name"
    return frappe.get_list(dt, filters=filters, fields=["name", party, "outstanding_amount", "currency", "modified"], order_by="posting_date desc", limit_page_length=50)


@frappe.whitelist(methods=["POST"])
def create_payment(direction, invoice, account, amount, expected_modified, request_id, actor, reference_no="", reference_date=None):
    _owner()
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
    if direction not in ["Receive", "Pay"]:
        frappe.throw("Choose Receive or Pay.")
    request_id = str(uuid.UUID(request_id))
    existing = frappe.db.get_value("Payment Entry", {"custom_giftique_request_id": request_id}, "name")
    if existing:
        return record("payments", existing)
    dt = "Sales Invoice" if direction == "Receive" else "Purchase Invoice"
    source = frappe.get_doc(dt, invoice)
    _owned(source); source.check_permission("read"); _current(source, expected_modified)
    amount = float(amount)
    if source.docstatus != 1 or not math.isfinite(amount) or amount <= 0 or amount > source.outstanding_amount:
        frappe.throw("Payment must be positive and no greater than the submitted invoice's outstanding amount.")
    bank = frappe.get_doc("Account", account)
    _owned(bank); bank.check_permission("read")
    if bank.is_group or bank.disabled or bank.account_type not in ["Bank", "Cash"]:
        frappe.throw("Choose an active Giftique bank or cash account.")
    if bank.account_type == "Bank" and (not reference_no or not reference_date):
        frappe.throw("Enter the real bank transaction reference and date.")
    party_account = source.debit_to if direction == "Receive" else source.credit_to
    party_currency = frappe.get_cached_value("Account", party_account, "account_currency")
    if source.currency != party_currency or source.currency != bank.account_currency:
        frappe.throw("This payment form requires the invoice, party ledger and bank account to use the same currency.")
    payment = get_payment_entry(dt, invoice, party_amount=amount, bank_account=account)
    payment.reference_no = str(reference_no)[:140]
    payment.reference_date = getdate(reference_date) if reference_date else None
    _owned(payment)
    if not payment.references or any(row.reference_doctype != dt or row.reference_name != invoice for row in payment.references):
        frappe.throw("ERPNext mapped an unexpected payment reference.")
    payment.custom_giftique_request_id = request_id
    payment.custom_giftique_actor = str(actor)[:140]
    payment.insert()
    return _serialize("payments", payment)


@frappe.whitelist(methods=["POST"])
def credit_note(invoice, expected_modified, request_id, actor):
    _owner()
    from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_sales_return
    request_id = str(uuid.UUID(request_id))
    existing = frappe.db.get_value("Sales Invoice", {"custom_giftique_request_id": request_id}, "name")
    if existing:
        doc = frappe.get_doc("Sales Invoice", existing); _owned(doc); doc.check_permission("read")
        return {"name": doc.name, "docstatus": doc.docstatus}
    source = frappe.get_doc("Sales Invoice", invoice)
    _owned(source); source.check_permission("read"); _current(source, expected_modified)
    if source.docstatus != 1 or source.is_return:
        frappe.throw("Select a submitted sales invoice to create its credit note.")
    if frappe.db.exists("Sales Invoice", {"return_against": source.name, "docstatus": ["<", 2]}):
        frappe.throw("A credit note already exists for this invoice. Review it before creating another.")
    doc = make_sales_return(source.name)
    _owned(doc)
    if not doc.is_return or doc.return_against != source.name:
        frappe.throw("ERPNext did not return a valid credit note.")
    doc.custom_giftique_request_id = request_id
    doc.custom_giftique_actor = str(actor)[:140]
    doc.insert()
    return {"name": doc.name, "docstatus": doc.docstatus}


def _update_letterhead():
    company = frappe.get_doc("Company", COMPANY)
    profile = _profile()
    title = html.escape(profile["display_name"])
    logo = f'<img src="{html.escape(company.company_logo, quote=True)}" style="max-height:80px;max-width:220px">' if company.company_logo else ""
    lines = [profile[k] for k in ["address", "email", "phone_no", "website"] if profile[k]]
    if profile["tax_id"]:
        lines.append("TRN: " + profile["tax_id"])
    details = "<br>".join(html.escape(str(line)).replace("\n", "<br>") for line in lines)
    content = f'<div style="border-bottom:2px solid #8b6f47;padding:12px 0;margin-bottom:18px">{logo}<h2 style="margin:8px 0;color:#201b18">{title}</h2><div style="font-size:11px;color:#555">{details}</div></div>'
    doc = frappe.get_doc("Letter Head", LETTER_HEAD) if frappe.db.exists("Letter Head", LETTER_HEAD) else frappe.new_doc("Letter Head")
    doc.letter_head_name = LETTER_HEAD
    doc.source = "HTML"
    doc.content = content
    doc.disabled = 0
    doc.is_default = 0
    doc.save(ignore_permissions=True)
    company.default_letter_head = LETTER_HEAD
    company.save(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def save_profile(data, actor, expected_modified):
    _owner()
    if isinstance(data, str):data = json.loads(data)
    allowed = {"display_name", "address", "email", "phone_no", "website", "tax_id"}
    if not isinstance(data, dict) or set(data) - allowed:
        frappe.throw("Unsupported company profile fields.")
    for value in data.values():
        if not isinstance(value, str) or len(value) > 2000:
            frappe.throw("Company details must be text of at most 2000 characters.")
    if data.get("email"):
        frappe.utils.validate_email_address(data["email"], throw=True)
    company = frappe.get_doc("Company", COMPANY)
    _current(company, expected_modified)
    for key, value in data.items():
        company.set({"display_name": "custom_giftique_display_name", "address": "custom_giftique_address"}.get(key, key), value)
    company.save(ignore_permissions=True)
    _update_letterhead()
    return _profile()


@frappe.whitelist(methods=["POST"])
def upload_logo(content, actor):
    _owner()
    from PIL import Image
    from frappe.utils.file_manager import save_file
    import hashlib
    if not isinstance(content, str) or len(content) > 4000000:
        frappe.throw("Choose a logo smaller than 3 MB.")
    raw = base64.b64decode(content, validate=True)
    image = Image.open(io.BytesIO(raw))
    if image.width * image.height > 16000000:
        frappe.throw("Choose a logo smaller than 16 megapixels.")
    image.thumbnail((1200, 1200))
    normalized = io.BytesIO(); image.convert("RGBA").save(normalized, format="PNG")
    payload = normalized.getvalue()
    filename = "giftique-logo-" + hashlib.sha256(payload).hexdigest()[:16] + ".png"
    file = save_file(filename, payload, "Company", COMPANY, is_private=0)
    company = frappe.get_doc("Company", COMPANY)
    company.company_logo = file.file_url
    company.save(ignore_permissions=True)
    _update_letterhead()
    return {"has_logo": True}


def _print_document(kind, name):
    if kind not in PRINT_KINDS:
        frappe.throw("Unknown document type.")
    doctype = PRINT_KINDS[kind]
    doc = frappe.get_doc(doctype, name)
    _owned(doc); doc.check_permission("read"); doc.check_permission("print")
    return doc


@contextmanager
def _pdf_origin():
    # An admin-configured internal frontend origin avoids broken container asset URLs.
    original = frappe.local.conf.get("host_name")
    origin = frappe.conf.get("giftique_pdf_origin")
    try:
        if origin:
            frappe.local.conf.host_name = origin
        yield
    finally:
        frappe.local.conf.host_name = original


@frappe.whitelist()
def document_pdf(kind, name):
    _owner()
    doc = _print_document(kind, name)
    with _pdf_origin():
        content = frappe.get_print(doc.doctype, doc.name, print_format="Standard", as_pdf=True, letterhead=LETTER_HEAD)
    return {"filename": re.sub(r"[^A-Za-z0-9_.-]", "_", doc.name) + ".pdf", "content": base64.b64encode(content).decode()}


@frappe.whitelist(methods=["POST"])
def email_document(kind, name, recipient, subject, message, request_id, actor):
    _owner()
    from frappe.core.doctype.communication.email import make
    doc = _print_document(kind, name)
    doc.check_permission("email")
    sender = frappe.db.get_value("Email Account", {"name": COMPANY, "enable_outgoing": 1}, "email_id")
    if not sender:
        frappe.throw("Configure Giftique's outgoing email account before sending documents.")
    recipient = frappe.utils.validate_email_address(recipient, throw=True)
    if not recipient or "," in recipient or "\n" in recipient:
        frappe.throw("Enter one recipient email address.")
    if not subject or len(subject) > 200 or len(message or "") > 10000:
        frappe.throw("Enter a subject and a message of at most 10000 characters.")
    request_id = str(uuid.UUID(request_id))
    with frappe.cache.lock("giftique-email-" + request_id, timeout=60):
        existing = frappe.db.get_value("Communication", {"custom_giftique_request_id": request_id}, "name")
        if existing:
            return {"name": existing, "status": "Queued"}
        pdf = document_pdf(kind, name)
        result = make(doctype=doc.doctype, name=doc.name, subject=subject, content=html.escape(message or "").replace("\n", "<br>"), recipients=recipient, sender=sender, send_email=True, attachments=[{"fname": pdf["filename"], "fcontent": base64.b64decode(pdf["content"])}])
        frappe.db.set_value("Communication", result["name"], {"custom_giftique_request_id": request_id, "custom_giftique_actor": str(actor)[:140]})
        frappe.db.commit()
        return {"name": result["name"], "status": "Queued"}


@frappe.whitelist(methods=["POST"])
def letter_pdf(recipient, subject, message, date, actor):
    _owner()
    from frappe.utils.pdf import get_pdf
    if not all(isinstance(v, str) for v in [recipient, subject, message]) or len(recipient) > 2000 or len(subject) > 200 or len(message) > 10000:
        frappe.throw("The letter text exceeds the allowed length.")
    letterhead = frappe.db.get_value("Letter Head", LETTER_HEAD, "content") or ""
    body = f'<html><head><meta charset="utf-8"></head><body>{letterhead}<p>{html.escape(str(getdate(date)))}</p><p>{html.escape(recipient).replace(chr(10), "<br>")}</p><h3>{html.escape(subject)}</h3><div style="line-height:1.7">{html.escape(message).replace(chr(10), "<br>")}</div></body></html>'
    with _pdf_origin():
        content = get_pdf(body)
    return {"filename": "Giftique-letter.pdf", "content": base64.b64encode(content).decode()}


@frappe.whitelist(methods=["POST"])
def retry_payroll_slips(name, expected_modified, actor):
    _owner()
    doc = _document("payroll_runs", name, "submit")
    _current(doc, expected_modified)
    if doc.docstatus != 1 or doc.salary_slips_created:
        frappe.throw("Only a submitted payroll run without completed slips can be retried.")
    doc.create_salary_slips()
    doc.reload()
    return _serialize("payroll_runs", doc)

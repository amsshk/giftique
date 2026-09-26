"""Private invoice attachments for Giftique, backed by native ERPNext File records."""
import base64
import io
import re

import frappe
from frappe.utils import cint
from frappe.utils.file_manager import get_content_hash, save_file
from proxc.integrations.giftique_business import COMPANY, _owner, _document, _current

FOLDER = "Home/Giftique Invoice Uploads"
MAX_BYTES = 5_000_000
KINDS = {"sales_invoices": "Sales Invoice", "purchase_invoices": "Purchase Invoice"}
FIELDS = ["name", "file_name", "file_size", "creation", "modified", "attached_to_doctype", "attached_to_name"]


def _target(kind, name):
    if kind not in KINDS:
        frappe.throw("Choose a sales invoice or supplier bill.")
    doc = _document(kind, name, "write")
    if doc.docstatus == 2:
        frappe.throw("Choose an invoice that is not cancelled.")
    return doc


def _file(name, permission="read"):
    doc = frappe.get_doc("File", name)
    if doc.folder != FOLDER or not doc.is_private or doc.is_folder:
        frappe.throw("Invoice file not found.", frappe.PermissionError)
    if doc.attached_to_doctype == "Company" and doc.attached_to_name == COMPANY:
        frappe.get_doc("Company", COMPANY).check_permission("read")
    else:
        kind = next((kind for kind, dt in KINDS.items() if dt == doc.attached_to_doctype), None)
        if not kind:
            frappe.throw("Invoice file not found.", frappe.PermissionError)
        _document(kind, doc.attached_to_name, permission)
    return doc


def _row(doc):
    return {field: doc.get(field) for field in FIELDS}


def _payload(filename, content):
    if not isinstance(filename, str) or not isinstance(content, str) or len(content) > 6_666_668:
        frappe.throw("Choose a PDF, PNG or JPEG no larger than 5 MB.")
    filename = re.sub(r"[^A-Za-z0-9_. -]", "_", filename).strip(". ")[:140]
    extension = filename.rsplit(".", 1)[-1].lower()
    if extension not in ["pdf", "png", "jpg", "jpeg"]:
        frappe.throw("Choose a PDF, PNG or JPEG.")
    try:
        payload = base64.b64decode(content, validate=True)
        if not payload or len(payload) > MAX_BYTES:
            raise ValueError()
        if extension == "pdf":
            from pypdf import PdfReader
            if not payload.startswith(b"%PDF-"):
                raise ValueError()
            pdf = PdfReader(io.BytesIO(payload))
            if pdf.is_encrypted or not len(pdf.pages):
                raise ValueError()
        else:
            from PIL import Image
            with Image.open(io.BytesIO(payload)) as image:
                if image.format != ("PNG" if extension == "png" else "JPEG") or image.width * image.height > 25_000_000:
                    raise ValueError()
                image.verify()
    except Exception as error:
        # Parser details may include file contents; do not expose them to clients.
        raise frappe.ValidationError("The file is invalid, password-protected, or larger than 5 MB. Choose a readable PDF, PNG or JPEG.") from error
    return filename, payload


@frappe.whitelist()
def list_files(page=0, search=""):
    _owner()
    page = cint(page)
    if page < 0 or page > 10000:
        frappe.throw("Invalid page.")
    # A folder is not an authorization boundary: scope every linked invoice to its company.
    pairs = [("Company", [COMPANY])]
    for dt in KINDS.values():
        pairs.append((dt, frappe.get_list(dt, filters={"company": COMPANY}, pluck="name", limit_page_length=0)))
    allowed = []
    for dt, names in pairs:
        if names:
            allowed.extend(frappe.get_all("File", filters={"folder": FOLDER, "is_private": 1, "is_folder": 0, "attached_to_doctype": dt, "attached_to_name": ["in", names], "file_name": ["like", "%" + str(search)[:80] + "%"]}, fields=FIELDS, order_by="creation desc, name desc", limit_start=0, limit_page_length=(page + 1) * 50 + 1))
    allowed.sort(key=lambda row: (str(row.creation), row.name), reverse=True)
    start = page * 50
    return {"files": allowed[start:start + 50], "hasMore": len(allowed) > start + 50}


@frappe.whitelist()
def invoice_choices(kind, search=""):
    _owner()
    if kind not in KINDS:
        frappe.throw("Choose an invoice type.")
    dt = KINDS[kind]
    party = "customer_name" if dt == "Sales Invoice" else "supplier_name"
    search = "%" + str(search)[:80] + "%"
    return frappe.get_list(dt, filters={"company": COMPANY, "docstatus": ["!=", 2]}, or_filters={"name": ["like", search], party: ["like", search]}, fields=["name", party + " as party", "posting_date", "grand_total", "currency", "docstatus"], order_by="modified desc", limit_page_length=50)


@frappe.whitelist(methods=["POST"])
def upload(filename, content, actor):
    _owner()
    frappe.get_doc("Company", COMPANY).check_permission("read")
    filename, payload = _payload(filename, content)
    # Retrying the same upload returns its existing File, even after it has been linked.
    for name in frappe.get_all("File", filters={"folder": FOLDER, "is_private": 1, "content_hash": get_content_hash(payload)}, pluck="name"):
        try:
            return _row(_file(name))
        except frappe.PermissionError:
            continue
    if not frappe.db.exists("File", FOLDER):
        frappe.get_doc({"doctype": "File", "file_name": "Giftique Invoice Uploads", "is_folder": 1, "folder": "Home"}).insert(ignore_permissions=True)
    file = save_file(filename, payload, "Company", COMPANY, folder=FOLDER, is_private=1)
    frappe.get_doc("Company", COMPANY).add_comment("Info", f"Invoice file uploaded from Giftique Management by {frappe.utils.escape_html(str(actor))}.")
    return _row(file)


@frappe.whitelist(methods=["POST"])
def link(name, kind, invoice, expected_modified, actor):
    _owner()
    file = _file(name, "write")
    _current(file, expected_modified)
    target = _target(kind, invoice)
    file.attached_to_doctype = target.doctype
    file.attached_to_name = target.name
    file.save(ignore_permissions=True)
    target.add_comment("Info", f"Invoice file attached from Giftique Management by {frappe.utils.escape_html(str(actor))}.")
    return _row(file)


@frappe.whitelist()
def download(name):
    _owner()
    file = _file(name)
    payload = file.get_content()
    if isinstance(payload, str):
        payload = payload.encode()
    if len(payload) > MAX_BYTES:
        frappe.throw("This file exceeds the download limit.")
    return {"filename": file.file_name, "content": base64.b64encode(payload).decode()}

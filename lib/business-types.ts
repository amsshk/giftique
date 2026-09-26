export type Field = { name: string; label: string; type: string; required: boolean; default?: string | null; options?: string[]; link?: string; fields?: Field[] };
export type BusinessForm = { id: string; doctype: string; submittable: boolean; nameRequired: boolean; canCreate: boolean; fields: Field[]; columns: Field[] };
export type Values = Record<string, string | number | null | Values[]>;
export type BusinessRecord = Values & { name: string; modified: string; docstatus: number };
export type CompanyProfile = { name: string; display_name: string; currency: string; email: string; phone_no: string; tax_id: string; website: string; address: string; has_logo: boolean; letter_head: string; modified: string };
export type Capabilities = { payroll: boolean; email_ready: boolean; sender?: string; profile: CompanyProfile; forms: BusinessForm[] };

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Upload, Download, Search, Paperclip, X } from "lucide-react";
import type { createSupabaseBrowserClient } from "@/lib/supabase";

type InvoiceFile = { name: string; file_name: string; file_size: number; creation: string; modified: string; attached_to_doctype: string; attached_to_name: string };
type Choice = { name: string; party: string; posting_date: string; grand_total: number; currency: string; docstatus: number };
const control = "rounded-md border border-[#d9d1c7] bg-white px-3 py-2 text-sm disabled:opacity-50";
const primary = `${control} !bg-[#725839] !text-white`;
const input = `${control} w-full`;
const sizeLabel = (size: number) => size < 1000000 ? `${Math.ceil(size / 1000)} KB` : `${(size / 1000000).toFixed(1)} MB`;

export default function InvoiceFiles({ supabase }: { supabase: ReturnType<typeof createSupabaseBrowserClient> }) {
  const [files, setFiles] = useState<InvoiceFile[]>([]), [selected, setSelected] = useState<InvoiceFile | null>(null);
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false), [search, setSearch] = useState(""), [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [kind, setKind] = useState("sales_invoices"), [invoiceSearch, setInvoiceSearch] = useState(""), [choices, setChoices] = useState<Choice[]>([]), [invoice, setInvoice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null), sequence = useRef(0), panel = useRef<HTMLElement>(null);
  const request = useCallback(async (query: Record<string, string>, body?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sign in again to continue.");
    const response = await fetch(`/api/proxc-management/invoice-files?${new URLSearchParams(query)}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || "Invoice files unavailable."); }
    return response;
  }, [supabase]);
  const refresh = useCallback(async () => {
    const id = ++sequence.current; setLoading(true);
    try { const data = await (await request({ action: "list_files", page: String(page), search: filter })).json() as { files: InvoiceFile[]; hasMore: boolean }; if (id === sequence.current) { setFiles(data.files); setHasMore(data.hasMore); } }
    catch (e) { if (id === sequence.current) setError(e instanceof Error ? e.message : "Could not load files."); }
    finally { if (id === sequence.current) setLoading(false); }
  }, [request, page, filter]);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => { clearTimeout(timer); }; }, [refresh]);

  function select(file: InvoiceFile) {
    setSelected(file); setInvoice(""); setChoices([]); setInvoiceSearch(""); setError("");
    requestAnimationFrame(() => { panel.current?.focus(); panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || !file.size || file.size > 5000000) throw new Error("Choose a PDF, PNG or JPEG up to 5 MB.");
      if (file.name.length > 140) throw new Error("Shorten the filename to 140 characters or fewer.");
      const content = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Could not read this file.")); reader.readAsDataURL(file); });
      const result = await (await request({}, { action: "upload", filename: file.name, content })).json() as InvoiceFile;
      select(result); setNotice("File saved privately in PROXC. You can now link it to an invoice."); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function findInvoices(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setChoices([]); setInvoice("");
    try { const data = await (await request({ action: "invoice_choices", kind, search: invoiceSearch })).json() as Choice[]; setChoices(data); if (!data.length) setNotice("No matching invoices. Create the invoice in Operations or the supplier bill in Credit & Bills, then search again."); else setNotice(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Search failed."); } finally { setBusy(false); }
  }
  async function link(e: FormEvent) {
    e.preventDefault(); if (!selected || !invoice) return; setBusy(true); setError(""); setNotice("");
    try { const result = await (await request({}, { action: "link", name: selected.name, expected_modified: selected.modified, kind, invoice })).json() as InvoiceFile; setSelected(result); setNotice(`File attached to ${invoice} in PROXC.`); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not attach file."); } finally { setBusy(false); }
  }
  async function download() {
    if (!selected) return; setBusy(true); setError("");
    try { const response = await request({ action: "download", name: selected.name }); const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = selected.file_name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    catch (e) { setError(e instanceof Error ? e.message : "Download failed."); } finally { setBusy(false); }
  }
  return <div>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Invoice files</h3><p className="mt-1 max-w-xl text-sm text-[#716b66]">Keep existing customer invoices and supplier bills together. Files stay private and can be attached to their PROXC invoice.</p></div><button className={`${primary} inline-flex items-center gap-2`} disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={16} />{busy ? "Working…" : "Upload invoice"}</button></div>
    <input ref={fileInput} type="file" aria-label="Choose invoice file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" disabled={busy} onChange={e => void upload(e.target.files?.[0])} />
    <div className="mb-5 rounded-lg border border-dashed border-[#c9bcad] bg-[#faf8f4] p-5 text-center text-sm" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length > 1) setError("Upload one invoice file at a time."); else void upload(e.dataTransfer.files[0]); }}>
      <Upload className="mx-auto mb-2 text-[#8e7a62]" size={22} /><p>Drop an invoice here, or use Upload invoice</p><p className="mt-1 text-xs text-[#716b66]">PDF, PNG or JPEG · up to 5 MB per file</p>
    </div>
    <p className="mb-5 rounded-md bg-[#f7f3ed] px-4 py-3 text-sm">Uploaded files are supporting documents. Review and create the accounting record separately in Operations → Invoices or Credit & Bills.</p>
    {error && <p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mb-4 text-sm text-green-900">{notice}</p>}
    <div className={`grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
      <div className="min-w-0"><form className="mb-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(0); setFilter(search); }}><label className="min-w-0 grow"><span className="sr-only">Search uploaded filenames</span><input className={input} placeholder="Search uploaded filenames" maxLength={80} value={search} onChange={e => setSearch(e.target.value)} /></label><button className={`${control} inline-flex items-center gap-2`}><Search size={16} />Search</button><button type="button" className={control} disabled={busy || loading} onClick={() => { setError(""); setSelected(null); void refresh(); }}>Refresh</button></form>
        <div className="overflow-x-auto rounded-lg border border-[#e5dfd8]"><table className="w-full text-left text-sm"><thead className="bg-[#f7f5f1] text-xs text-[#716b66]"><tr><th className="p-3">File</th><th className="p-3">Status</th><th className="p-3">Invoice</th><th className="p-3">Uploaded</th></tr></thead><tbody>{!loading && files.map(file => <tr key={file.name} className={`border-t border-[#eee8e0] ${selected?.name === file.name ? "bg-[#f7f3ed]" : ""}`}><td className="p-3"><button className="flex items-center gap-2 text-left font-medium hover:underline" disabled={busy} onClick={() => select(file)}><FileText size={17} className="shrink-0" /><span className="max-w-56 break-words">{file.file_name}</span></button><span className="ml-6 text-xs text-[#716b66]">{sizeLabel(file.file_size)}</span></td><td className="whitespace-nowrap p-3"><span className={`rounded-full px-2 py-1 text-xs ${file.attached_to_doctype === "Company" ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-900"}`}>{file.attached_to_doctype === "Company" ? "Unlinked" : "Attached"}</span></td><td className="p-3">{file.attached_to_doctype === "Company" ? "—" : file.attached_to_name}</td><td className="whitespace-nowrap p-3 text-[#716b66]">{file.creation.slice(0, 10)}</td></tr>)}</tbody></table>{loading ? <p role="status" className="p-8 text-center text-sm">Loading invoice files…</p> : !files.length && <div className="p-8 text-center text-sm text-[#716b66]"><FileText className="mx-auto mb-3" size={30} /><p>{filter ? "No files match your search." : "No invoice files uploaded yet."}</p></div>}</div>
        <div className="mt-3 flex items-center justify-end gap-3 text-sm"><button className={control} disabled={!page || loading || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button className={control} disabled={!hasMore || loading || busy} onClick={() => setPage(p => p + 1)}>Next</button></div>
      </div>
      {selected && <aside ref={panel} tabIndex={-1} aria-label="Invoice file details" className="min-w-0 rounded-lg border border-[#e5dfd8] p-4"><div className="flex items-start justify-between gap-2"><h4 className="break-all font-semibold">{selected.file_name}</h4><button aria-label="Close file details" disabled={busy} onClick={() => setSelected(null)}><X size={18} /></button></div><p className="my-3 text-xs text-[#716b66]">{sizeLabel(selected.file_size)} · Private attachment</p><button className={`${control} inline-flex items-center gap-2`} disabled={busy} onClick={() => void download()}><Download size={16} />Download original</button>
        <div className="my-5 border-t border-[#e5dfd8] pt-4"><h4 className="mb-2 font-medium">Linked invoice</h4><p className="break-words text-sm">{selected.attached_to_doctype === "Company" ? "Not linked yet" : `${selected.attached_to_doctype} · ${selected.attached_to_name}`}</p></div>
        <form onSubmit={findInvoices} className="space-y-3"><label className="block text-sm">Invoice type<select className={`${input} mt-1`} disabled={busy} value={kind} onChange={e => { setKind(e.target.value); setChoices([]); setInvoice(""); }}><option value="sales_invoices">Customer sales invoice</option><option value="purchase_invoices">Supplier purchase invoice</option></select></label><label className="block text-sm">Invoice number or customer / supplier<input className={`${input} mt-1`} disabled={busy} maxLength={80} value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} /></label><button className={control} disabled={busy}>Find invoice</button></form>
        {!!choices.length && <form onSubmit={link} className="mt-4 space-y-3"><label className="block text-sm">Matching invoice<select className={`${input} mt-1`} required disabled={busy} value={invoice} onChange={e => setInvoice(e.target.value)}><option value="">Select invoice</option>{choices.map(choice => <option key={choice.name} value={choice.name}>{choice.name} · {choice.party} · {choice.currency} {choice.grand_total}</option>)}</select></label><button className={`${primary} inline-flex items-center gap-2`} disabled={busy || !invoice}><Paperclip size={15} />Attach to invoice</button></form>}
      </aside>}
    </div>
  </div>;
}

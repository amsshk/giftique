"use client";

import { useEffect, useState, type FormEvent } from "react";

const input = "w-full rounded-lg border border-[#d9d1c7] bg-white px-3 py-2 text-sm";
const button = "rounded-lg border border-[#ded5ca] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f5efe7] disabled:opacity-50";
const primary = `${button} !bg-[#725839] !text-white hover:!bg-[#59442c]`;

type Api = <T>(query: Record<string, string>, body?: Record<string, unknown>) => Promise<T>;

type Courier = {
  provider: string;
  label: string;
  connected: boolean;
  account_number?: string;
  account_entity?: string;
  account_country_code?: string;
  last_tested?: string;
};

export default function CourierIntegrations({ api }: { api: Api }) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [provider, setProvider] = useState("aramex");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountPin, setAccountPin] = useState("");
  const [accountEntity, setAccountEntity] = useState("");
  const [countryCode, setCountryCode] = useState("AE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      setCouriers(await api<Courier[]>({ action: "courier_connections" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Courier connections unavailable.");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, []);

  const current = couriers.find(c => c.provider === provider);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api({}, {
        action: "save_courier_connection",
        provider,
        username,
        password,
        account_number: accountNumber,
        account_pin: accountPin,
        account_entity: accountEntity,
        country_code: countryCode,
      });
      setPassword("");
      setAccountPin("");
      await load();
      setNotice("Delivery company account saved. Test the connection before creating shipments.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the delivery company account.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ message: string }>({}, { action: "test_courier_connection", provider });
      await load();
      setNotice(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection test failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this delivery company account from Giftique?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api({}, { action: "disconnect_courier_connection", provider });
      setUsername("");
      setPassword("");
      setAccountNumber("");
      setAccountPin("");
      setAccountEntity("");
      await load();
      setNotice("Delivery company disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect the delivery company.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <div>
      <h3 className="font-semibold">Delivery companies</h3>
      <p className="mt-2 text-sm leading-6 text-[#716b66]">
        Connect the business's own courier account. Credentials are kept on the business server and are never shown to customers.
      </p>
    </div>

    <div className="rounded-xl border border-[#e5dfd8] bg-[#fbf9f6] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Aramex</p>
          <p className="text-xs text-[#716b66]">Rates, shipment creation, labels, pickup requests and tracking.</p>
        </div>
        <span className={current?.connected ? "rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800" : "rounded-full bg-[#f0ece6] px-3 py-1 text-xs font-medium text-[#716b66]"}>
          {current?.connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Aramex username<input className={input} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label className="text-sm">Aramex password<input className={input} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={current?.connected ? "Enter only to replace saved password" : ""} required={!current?.connected} /></label>
        <label className="text-sm">Account number<input className={input} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required /></label>
        <label className="text-sm">Account PIN<input className={input} type="password" autoComplete="off" value={accountPin} onChange={e => setAccountPin(e.target.value)} placeholder={current?.connected ? "Enter only to replace saved PIN" : ""} required={!current?.connected} /></label>
        <label className="text-sm">Account entity<input className={input} value={accountEntity} onChange={e => setAccountEntity(e.target.value)} maxLength={3} required /></label>
        <label className="text-sm">Account country code<input className={input} value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required /></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className={primary} disabled={busy}>{busy ? "Saving…" : current?.connected ? "Update Aramex account" : "Connect Aramex"}</button>
          {current?.connected && <button type="button" className={button} disabled={busy} onClick={() => void test()}>Test connection</button>}
          {current?.connected && <button type="button" className={button} disabled={busy} onClick={() => void disconnect()}>Disconnect</button>}
        </div>
      </form>

      {current?.last_tested && <p className="mt-3 text-xs text-[#716b66]">Last connection test: {current.last_tested}</p>}
    </div>

    <div className="rounded-xl border border-dashed border-[#ded5ca] p-4">
      <p className="text-sm font-semibold">More delivery companies</p>
      <p className="mt-1 text-sm text-[#716b66]">The same connection layer can be used for DHL and other couriers without changing the customer checkout.</p>
    </div>

    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-900">{notice}</p>}
  </div>;
}

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
  configured?: boolean;
  account_number?: string;
  account_entity?: string;
  account_country_code?: string;
  last_tested?: string;
};

type ConnectionResponse = Courier[] | {
  aramex?: {
    connected?: boolean;
    configured?: boolean;
    last_tested?: string | null;
    account_number?: string;
    account_entity?: string;
    country_code?: string;
  };
};

const providers = [
  {
    id: "aramex",
    name: "Aramex",
    description: "Rates, shipment creation, labels, pickup requests and tracking.",
    status: "available",
  },
  {
    id: "dhl",
    name: "DHL Express",
    description: "Rates, shipment creation, labels, pickup requests and tracking through MyDHL.",
    status: "next",
  },
  {
    id: "emirates_post",
    name: "Emirates Post",
    description: "Booking, pricing, labels, tracking and delivery instructions.",
    status: "next",
  },
  {
    id: "shipa",
    name: "Shipa Delivery",
    description: "Delivery orders, AWBs, tracking and local delivery services.",
    status: "next",
  },
] as const;

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
      const result = await api<ConnectionResponse>({ action: "courier_connections" });
      if (Array.isArray(result)) {
        setCouriers(result);
      } else if (result.aramex) {
        setCouriers([{
          provider: "aramex",
          label: "Aramex",
          connected: Boolean(result.aramex.connected),
          configured: Boolean(result.aramex.configured),
          account_number: result.aramex.account_number,
          account_entity: result.aramex.account_entity,
          account_country_code: result.aramex.country_code,
          last_tested: result.aramex.last_tested || undefined,
        }]);
      } else {
        setCouriers([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delivery company connections are unavailable.");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, []);

  const current = couriers.find(c => c.provider === provider);
  const selected = providers.find(p => p.id === provider) ?? providers[0];
  const activeProvider = selected.status === "available";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!activeProvider) return;
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
        Connect the business's own courier accounts. Credentials are kept securely on the business server and are never shown to customers.
      </p>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      {providers.map(item => {
        const connection = couriers.find(c => c.provider === item.id);
        const isSelected = item.id === provider;
        return <button
          key={item.id}
          type="button"
          onClick={() => { setProvider(item.id); setError(""); setNotice(""); }}
          className={`rounded-xl border p-4 text-left transition ${isSelected ? "border-[#725839] bg-[#fbf9f6]" : "border-[#e5dfd8] bg-white hover:bg-[#fbf9f6]"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="mt-1 text-xs leading-5 text-[#716b66]">{item.description}</p>
            </div>
            <span className={connection?.connected ? "rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-800" : item.status === "available" ? "rounded-full bg-[#f0ece6] px-2.5 py-1 text-[11px] font-medium text-[#716b66]" : "rounded-full bg-[#f0ece6] px-2.5 py-1 text-[11px] font-medium text-[#716b66]"}>
              {connection?.connected ? "Connected" : item.status === "available" ? "Setup" : "Coming next"}
            </span>
          </div>
        </button>;
      })}
    </div>

    <div className="rounded-xl border border-[#e5dfd8] bg-[#fbf9f6] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{selected.name}</p>
          <p className="text-xs text-[#716b66]">{selected.description}</p>
        </div>
        {current?.connected && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">Connected</span>}
      </div>

      {!activeProvider ? <div className="mt-5 rounded-lg border border-dashed border-[#ded5ca] bg-white p-4">
        <p className="text-sm font-medium">Account connection is being prepared</p>
        <p className="mt-1 text-sm leading-6 text-[#716b66]">
          Giftique is keeping the same courier connection structure for every provider. This provider will use its own business account credentials and pricing agreement when enabled.
        </p>
      </div> : <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">{selected.name} username<input className={input} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label className="text-sm">{selected.name} password<input className={input} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={current?.connected ? "Enter only to replace saved password" : ""} required={!current?.connected} /></label>
        <label className="text-sm">Account number<input className={input} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required /></label>
        <label className="text-sm">Account PIN<input className={input} type="password" autoComplete="off" value={accountPin} onChange={e => setAccountPin(e.target.value)} placeholder={current?.connected ? "Enter only to replace saved PIN" : ""} required={!current?.connected} /></label>
        <label className="text-sm">Account entity<input className={input} value={accountEntity} onChange={e => setAccountEntity(e.target.value)} maxLength={3} required /></label>
        <label className="text-sm">Account country code<input className={input} value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required /></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className={primary} disabled={busy}>{busy ? "Saving…" : current?.connected ? `Update ${selected.name} account` : `Connect ${selected.name}`}</button>
          {current?.connected && <button type="button" className={button} disabled={busy} onClick={() => void test()}>Test connection</button>}
          {current?.connected && <button type="button" className={button} disabled={busy} onClick={() => void disconnect()}>Disconnect</button>}
        </div>
      </form>}

      {current?.last_tested && <p className="mt-3 text-xs text-[#716b66]">Last connection test: {current.last_tested}</p>}
    </div>

    <div className="rounded-xl border border-[#e5dfd8] bg-white p-4">
      <p className="text-sm font-semibold">Delivery costs</p>
      <p className="mt-1 text-sm leading-6 text-[#716b66]">
        Courier costs will be stored separately from the delivery amount charged to the customer. Giftique will use the courier's live rate or contracted business rate when available, then record the courier cost and delivery margin against the order.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-[#fbf9f6] p-3"><p className="text-xs text-[#716b66]">Customer delivery fee</p><p className="mt-1 text-sm font-semibold">Revenue</p></div>
        <div className="rounded-lg bg-[#fbf9f6] p-3"><p className="text-xs text-[#716b66]">Courier charge</p><p className="mt-1 text-sm font-semibold">Delivery cost</p></div>
        <div className="rounded-lg bg-[#fbf9f6] p-3"><p className="text-xs text-[#716b66]">Difference</p><p className="mt-1 text-sm font-semibold">Delivery margin</p></div>
      </div>
    </div>

    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-900">{notice}</p>}
  </div>;
}

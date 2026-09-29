"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  AtSign,
  ChevronDown,
  Mail,
  MapPin,
  Package,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase";

import { presentStorefrontProduct } from "../../lib/storefront-products";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  erp_item_code: string | null;
};

type DeliveryLocation = { latitude: number; longitude: number; };
type LeafletMapInstance = any;

type ProxcOrderResponse = {
  error?: string;
  message?: { ok?: boolean; error?: string; order?: { name: string } };
};

const money = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(value);


function UaePinPicker({ value, onChange, onClose }: {
  value: DeliveryLocation | null;
  onChange: (location: DeliveryLocation) => void;
  onClose: () => void;
}) {
  const mapHost = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!mapHost.current) return;
    let cancelled = false;

    const load = async () => {
      try {
        if (!(window as any).L) {
          if (!document.querySelector('link[data-giftique-leaflet]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            link.dataset.giftiqueLeaflet = "true";
            document.head.appendChild(link);
          }
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-giftique-leaflet]') as HTMLScriptElement | null;
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("Map failed to load")), { once: true });
              return;
            }
            const script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.async = true;
            script.dataset.giftiqueLeaflet = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Map failed to load"));
            document.body.appendChild(script);
          });
        }
        if (cancelled || !mapHost.current) return;
        const L = (window as any).L;
        const map = L.map(mapHost.current, {
          center: value ? [value.latitude, value.longitude] : [24.35, 54.55],
          zoom: value ? 15 : 6,
          minZoom: 5,
          maxZoom: 18,
          maxBounds: [[22.55, 51.35], [26.35, 56.65]],
          maxBoundsViscosity: 0.85,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        map.on("click", (event: any) => {
          const location = {
            latitude: Number(event.latlng.lat.toFixed(7)),
            longitude: Number(event.latlng.lng.toFixed(7)),
          };
          onChange(location);
          if (markerRef.current) markerRef.current.setLatLng(event.latlng);
          else markerRef.current = L.marker(event.latlng).addTo(map);
        });
        if (value) markerRef.current = L.marker([value.latitude, value.longitude]).addTo(map);
        mapRef.current = map;
        setReady(true);
        window.setTimeout(() => map.invalidateSize(), 50);
      } catch (error) {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "Unable to load the map.");
      }
    };

    load();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapError("Your browser does not provide location access.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        };
        if (location.latitude < 22.55 || location.latitude > 26.35 || location.longitude < 51.35 || location.longitude > 56.65) {
          setMapError("Please choose a delivery location inside the UAE.");
          return;
        }
        onChange(location);
        const L = (window as any).L;
        if (mapRef.current && L) {
          mapRef.current.setView([location.latitude, location.longitude], 16);
          if (markerRef.current) markerRef.current.setLatLng([location.latitude, location.longitude]);
          else markerRef.current = L.marker([location.latitude, location.longitude]).addTo(mapRef.current);
        }
      },
      () => setMapError("Location access was not available. You can still tap the map to place the pin."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="gq-pin-picker">
      <div className="gq-pin-picker-header">
        <div>
          <span className="gq-eyebrow">Delivery location</span>
          <h3>Place the pin at the door.</h3>
          <p>Tap the map where you want your Giftique order delivered.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close map"><X size={18} strokeWidth={1.5} /></button>
      </div>
      <div className="gq-pin-map" ref={mapHost} />
      <div className="gq-pin-actions">
        <button type="button" onClick={useCurrentLocation}>Use my current location</button>
        <span>{ready ? "Tap anywhere on the UAE map to move the pin." : "Loading map…"}</span>
      </div>
      {mapError && <p className="gq-pin-error">{mapError}</p>}
      <div className="gq-pin-footer">
        <small>Map data © OpenStreetMap contributors</small>
        <button type="button" className="gq-checkout-submit" disabled={!value} onClick={onClose}>
          Confirm location <ArrowRight size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All pieces");
  const [bag, setBag] = useState<Product[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryBuilding, setDeliveryBuilding] = useState("");
  const [deliveryUnit, setDeliveryUnit] = useState("");
  const [deliveryFloor, setDeliveryFloor] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState("");
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [placing, setPlacing] = useState(false);

  const [supabase] = useState(createSupabaseBrowserClient);

  useEffect(() => {
    if (!deliveryLocation) {
      setAddressLoading(false);
      return;
    }

    const controller = new AbortController();
    setAddressLoading(true);

    async function fillAddress() {
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          lat: String(deliveryLocation.latitude),
          lon: String(deliveryLocation.longitude),
          addressdetails: "1",
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Address lookup failed.");
        const data = await response.json() as { display_name?: string };
        if (data.display_name) setDeliveryAddress(data.display_name);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setDeliveryAddress("");
        }
      } finally {
        if (!controller.signal.aborted) setAddressLoading(false);
      }
    }

    void fillAddress();
    return () => controller.abort();
  }, [deliveryLocation]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from("storefront_products")
          .select(
            "id,name,description,category,price,image_url,erp_item_code"
          )
          .eq("active", true)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (queryError) throw queryError;

        setProducts(((data || []) as Product[]).map(presentStorefrontProduct));
      } catch {
        if (active) {
          setError(
            "The collection is being refreshed. Please contact the atelier for current availability."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [supabase]);

  const categories = useMemo(
    () => [
      "All pieces",
      ...Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter(Boolean)
        )
      ),
    ],
    [products]
  );

  const visible =
    category === "All pieces"
      ? products
      : products.filter((product) => product.category === category);

  const addToBag = (product: Product) => {
    setBag((current) => [...current, product]);
    setBagOpen(true);
  };

  const removeFromBag = (index: number) => {
    setBag((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPlacing(true);
    setCheckoutMessage("");

    const grouped = new Map<string, number>();

    for (const product of bag) {
      if (!product.erp_item_code) {
        setPlacing(false);
        setCheckoutMessage(
          `The product "${product.name}" is not currently available for checkout.`
        );
        return;
      }

      grouped.set(
        product.erp_item_code,
        (grouped.get(product.erp_item_code) || 0) + 1
      );
    }

    const items = Array.from(grouped.entries()).map(
      ([item_code, quantity]) => ({
        item_code,
        quantity,
      })
    );

    try {
      const response = await fetch("/api/proxc-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          delivery_building: deliveryBuilding,
          delivery_unit: deliveryUnit,
          delivery_floor: deliveryFloor,
          delivery_instructions: deliveryInstructions,
          preferred_delivery_date: preferredDeliveryDate,
          preferred_delivery_time: preferredDeliveryTime,
          delivery_latitude: deliveryLocation?.latitude ?? null,
          delivery_longitude: deliveryLocation?.longitude ?? null,
          items,
        }),
      });

      const data = (await response.json()) as ProxcOrderResponse;

      if (!response.ok || !data.message?.ok || !data.message.order?.name) {
        throw new Error(
          data?.error ||
            data?.message?.error ||
            "Unable to create the order."
        );
      }

      const order = data.message.order;

      setBag([]);
      setCheckoutOpen(false);
      setBagOpen(false);

      setCheckoutMessage(
        `Order ${order.name} received. We will contact you shortly.`
      );
    } catch (error) {
      setCheckoutMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the order."
      );
    } finally {
      setPlacing(false);
    }

    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setDeliveryBuilding("");
    setDeliveryUnit("");
    setDeliveryFloor("");
    setDeliveryInstructions("");
    setPreferredDeliveryDate("");
    setPreferredDeliveryTime("");
    setDeliveryLocation(null);
  }

  return (
    <main className="gq-store">
      {/* HEADER */}
      <header className="gq-header">
        <a href="#top" className="gq-brand" aria-label="Giftique Atelier">
          <span className="gq-brand-mark">G</span>

          <span className="gq-brand-name">
            <strong>GIFTIQUE</strong>
            <small>ATELIER</small>
          </span>
        </a>

        <nav className="gq-navigation" aria-label="Main navigation">
          <a href="#collection">Collection</a>
          <a href="#story">The story</a>
          <a href="#concierge">Concierge</a>
        </nav>

        <button
          className="gq-bag-button"
          onClick={() => setBagOpen(true)}
          aria-label={`Open gift bag, ${bag.length} items`}
        >
          <span>Bag</span>
          <ShoppingBag size={17} strokeWidth={1.5} />
          <b>{String(bag.length).padStart(2, "0")}</b>
        </button>
      </header>

      {/* HERO */}
      <section className="gq-hero" id="top">
        <div className="gq-hero-image" aria-hidden="true" />

        <div className="gq-hero-index">01 / 04</div>

        <div className="gq-hero-copy">
          <p className="gq-eyebrow">
            Giftique Atelier · United Arab Emirates
          </p>

          <h1>
            Gifts
            <br />
            <em>worth</em>
            <br />
            remembering.
          </h1>

          <p className="gq-hero-description">
            Thoughtfully chosen objects, details and keepsakes
            for the moments that deserve more than an ordinary
            gift.
          </p>

          <a href="#collection" className="gq-editorial-link">
            Explore the collection
            <ArrowRight size={15} strokeWidth={1.5} />
          </a>
        </div>

        <div className="gq-hero-note">
          <span>THE GIFT EDIT</span>
          <strong>For the beautifully<br />considered moment.</strong>
        </div>

        <div className="gq-hero-meta">
          <span>Bridal</span>
          <span>Celebrations</span>
          <span>Keepsakes</span>
          <span>01—26</span>
        </div>
      </section>

      {/* INTRO */}
      <section className="gq-intro" id="story">
        <div className="gq-section-number">02</div>

        <div className="gq-intro-content">
          <p className="gq-eyebrow">Why Giftique</p>

          <h2>
            A gift is
            <br />
            <em>part of the story.</em>
          </h2>

          <div className="gq-intro-text">
            <p>
              We believe the most memorable gifts are rarely
              the biggest ones.
            </p>

            <p>
              They are the little details that say someone
              noticed. A beautifully wrapped surprise. An
              object that becomes part of their everyday.
              Something that stays long after the moment
              itself.
            </p>
          </div>
        </div>
      </section>

      {/* COLLECTION */}
      <section className="gq-collection" id="collection">
        <div className="gq-collection-header">
          <div>
            <p className="gq-eyebrow">The current edit</p>
            <h2>Selected pieces.</h2>
          </div>

          <div className="gq-collection-count">
            <span>{String(visible.length).padStart(2, "0")}</span>
            <small>pieces</small>
          </div>
        </div>

        <div className="gq-category-bar">
          <div className="gq-category-list">
            {categories.map((item) => (
              <button
                className={
                  category === item ? "is-selected" : ""
                }
                key={item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            className="gq-category-mobile"
            onClick={() =>
              setCategory(
                categories[
                  (categories.indexOf(category) + 1) %
                    categories.length
                ]
              )
            }
          >
            {category}
            <ChevronDown size={14} strokeWidth={1.5} />
          </button>
        </div>

        {loading ? (
          <div className="gq-empty-state">
            <span>Preparing the collection</span>
          </div>
        ) : error ? (
          <div className="gq-empty-state">
            <span>{error}</span>
          </div>
        ) : !visible.length ? (
          <div className="gq-empty-state">
            <span>The next edit is being prepared.</span>
          </div>
        ) : (
          <div className="gq-product-grid">
            {visible.map((product, index) => (
              <article
                className={`gq-product gq-product-${index % 4} ${product.image_url ? "has-image" : "no-image"}`}
                key={product.id}
              >
                <div className="gq-product-image">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading={index > 1 ? "lazy" : "eager"}
                    />
                  ) : (
                    <div className="gq-product-placeholder">
                      <Package size={22} strokeWidth={1} />
                      <span>No image available</span>
                    </div>
                  )}

                  <span className="gq-product-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <button
                    className="gq-add-overlay"
                    onClick={() => addToBag(product)}
                    aria-label={`Add ${product.name} to bag`}
                  >
                    <Plus size={18} strokeWidth={1.3} />
                  </button>
                </div>

                <div className="gq-product-info">
                  <div>
                    <span className="gq-product-category">
                      {product.category}
                    </span>

                    <h3>{product.name}</h3>
                  </div>

                  <strong>{money(product.price)}</strong>

                  {product.description && (
                    <p>{product.description}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* CONCIERGE */}
      <section className="gq-concierge" id="concierge">
        <div className="gq-concierge-top">
          <span>03 / 04</span>
          <span>The concierge desk</span>
        </div>

        <div className="gq-concierge-main">
          <div className="gq-concierge-title">
            <p className="gq-eyebrow">A little help choosing</p>

            <h2>
              Have a
              <br />
              moment
              <br />
              <em>in mind?</em>
            </h2>
          </div>

          <div className="gq-concierge-copy">
            <p>
              Tell us who you are celebrating, what the
              occasion feels like, and we will help you find
              something that feels just right.
            </p>

            <div className="gq-contact-list">
              <a href="mailto:hello@giftiqueatelier.com">
                <Mail size={15} strokeWidth={1.5} />
                hello@giftiqueatelier.com
              </a>

              <a
                href="https://www.instagram.com/giftiqueatelier/"
                target="_blank"
                rel="noreferrer"
              >
                <AtSign size={15} strokeWidth={1.5} />
                giftiqueatelier
              </a>

              <span>
                <MapPin size={15} strokeWidth={1.5} />
                United Arab Emirates
              </span>
            </div>
          </div>

          <div className="gq-concierge-statement">
            The detail
            <br />
            they remember
            <br />
            is often
            <br />
            the smallest.
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="gq-footer">
        <div>
          <strong>GIFTIQUE</strong>
          <span>ATELIER</span>
        </div>

        <p>Made for the moment after they open it.</p>

        <a href="/management">Team access</a>

        <span className="gq-footer-index">04 / 04</span>
      </footer>

      {/* BAG */}
      {bagOpen && (
        <div
          className="gq-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setBagOpen(false);
            }
          }}
        >
          <aside className="gq-bag">
            <div className="gq-bag-header">
              <div>
                <span className="gq-eyebrow">Your selection</span>
                <h2>The gift bag</h2>
              </div>

              <button
                onClick={() => setBagOpen(false)}
                aria-label="Close gift bag"
              >
                <X size={19} strokeWidth={1.5} />
              </button>
            </div>

            {!bag.length ? (
              <div className="gq-bag-empty">
                <ShoppingBag
                  size={28}
                  strokeWidth={1}
                />
                <p>
                  Your bag is waiting
                  <br />
                  for its first piece.
                </p>
              </div>
            ) : (
              <>
                <div className="gq-bag-items">
                  {bag.map((product, index) => (
                    <div
                      className="gq-bag-item"
                      key={`${product.id}-${index}`}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                        />
                      ) : (
                        <div className="gq-bag-placeholder" />
                      )}

                      <div>
                        <span>{product.category}</span>
                        <strong>{product.name}</strong>
                        <small>{money(product.price)}</small>
                      </div>

                      <button
                        onClick={() =>
                          removeFromBag(index)
                        }
                        aria-label={`Remove ${product.name}`}
                      >
                        <X
                          size={14}
                          strokeWidth={1.5}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="gq-bag-total">
                  <span>Estimated total</span>
                  <strong>
                    {money(
                      bag.reduce(
                        (sum, product) =>
                          sum + product.price,
                        0
                      )
                    )}
                  </strong>
                </div>

                <button
                  className="gq-checkout-button"
                  onClick={() => {
                    setBagOpen(false);
                    setCheckoutOpen(true);
                  }}
                >
                  Continue to checkout
                  <ArrowRight
                    size={15}
                    strokeWidth={1.5}
                  />
                </button>
              </>
            )}
          </aside>
        </div>
      )}

      {/* CHECKOUT */}
      {checkoutOpen && (
        <div className="gq-overlay">
          <form
            className="gq-checkout"
            onSubmit={checkout}
          >
            <button
              className="gq-checkout-close"
              type="button"
              onClick={() => setCheckoutOpen(false)}
              aria-label="Close checkout"
            >
              <X size={18} strokeWidth={1.5} />
            </button>

            <span className="gq-eyebrow">Checkout</span>

            <h2>
              Tell us
              <br />
              where to begin.
            </h2>

            <p>
              No account needed. Leave your details and the
              atelier will confirm your order personally.
            </p>

            <label>
              Name
              <input
                required
                value={customerName}
                onChange={(event) =>
                  setCustomerName(event.target.value)
                }
                placeholder="Your name"
              />
            </label>

            <label>
              Email
              <input
                required
                type="email"
                value={customerEmail}
                onChange={(event) =>
                  setCustomerEmail(event.target.value)
                }
                placeholder="you@example.com"
              />
            </label>

            <label>
              Phone or WhatsApp
              <input
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(event.target.value)
                }
                placeholder="Your number"
              />
            </label>

            <div className="gq-delivery-section">
              <div className="gq-delivery-heading">
                <span className="gq-eyebrow">Delivery</span>
                <h3>Where should we bring it?</h3>
                <p>Your pin helps us find the right location. You can move it until it sits exactly where you want the delivery made.</p>
              </div>

              <button type="button" className="gq-pin-button" onClick={() => setPinPickerOpen(true)}>
                <MapPin size={17} strokeWidth={1.5} />
                {deliveryLocation ? "Move delivery pin" : "Drop a pin"}
              </button>

              <label>
                Delivery instructions
                <textarea
                  value={deliveryInstructions}
                  onChange={(event) => setDeliveryInstructions(event.target.value)}
                  placeholder="Gate, reception, landmark, or any delivery instructions…"
                  rows={3}
                />
              </label>
            </div>

            <button
              className="gq-checkout-submit"
              type="submit"
              disabled={placing}
            >
              {placing
                ? "Sending order…"
                : "Place order"}
              <ArrowRight
                size={15}
                strokeWidth={1.5}
              />
            </button>

            {checkoutMessage && (
              <p className="gq-checkout-message">
                {checkoutMessage}
              </p>
            )}
          </form>
          {pinPickerOpen && (
            <div className="gq-pin-overlay">
              <UaePinPicker value={deliveryLocation} onChange={setDeliveryLocation} onClose={() => setPinPickerOpen(false)} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

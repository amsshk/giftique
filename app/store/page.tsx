"use client";

import { useEffect, useMemo, useState } from "react";
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

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  erp_item_code: string | null;
};

type ProxcOrderResponse = {
  error?: string;
  message?: { ok?: boolean; error?: string; order?: { name: string } };
};

const money = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(value);

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
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [placing, setPlacing] = useState(false);

  const [supabase] = useState(createSupabaseBrowserClient);

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

        setProducts((data || []) as Product[]);
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
                className={`gq-product gq-product-${index % 4}`}
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
                      <Package
                        size={25}
                        strokeWidth={1}
                      />
                      <span>
                        GIFT
                        <br />
                        DETAIL
                      </span>
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
        </div>
      )}
    </main>
  );
}

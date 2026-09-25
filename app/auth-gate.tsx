"use client";

import {FormEvent,useEffect,useState} from "react";
import {ArrowRight,LockKeyhole,LogIn,LogOut,Package,ShoppingBag} from "lucide-react";
import type {Session} from "@supabase/supabase-js";
import {createSupabaseBrowserClient} from "../lib/supabase";

export default function AuthGate({children}:{children:React.ReactNode}){
 const[session,setSession]=useState<Session|null>(null),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const[supabase]=useState(()=>{try{return createSupabaseBrowserClient()}catch{return null}});
 useEffect(()=>{if(!supabase){setError("Supabase is not configured for this deployment.");setLoading(false);return}let active=true;supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));return()=>{active=false;subscription.unsubscribe()}},[supabase]);
 async function signIn(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!supabase)return;setLoading(true);setError("");const{data,error:signInError}=await supabase.auth.signInWithPassword({email,password});if(signInError){setError(signInError.message);setLoading(false);return}setSession(data.session);setLoading(false)}
 const role=session?.user.app_metadata?.role;
 if(session)return role==="client"?<ClientStorefront/>:role==="owner"||role==="staff"?<><SignOutButton/>{children}</>:<main className="auth-page"><div className="auth-card"><div className="auth-mark">G</div><span>GIFTIQUE ATELIER</span><h1>Access not assigned</h1><p>Your account is authenticated, but an owner must assign an owner, staff, or client role before you can continue.</p></div></main>;
 if(loading)return <main className="auth-page"><div className="auth-card"><div className="auth-mark">G</div><p>GIFTIQUE ATELIER</p><h1>Loading your workspace</h1></div></main>;
 return <main className="auth-page"><form className="auth-card" onSubmit={signIn}><div className="auth-mark">G</div><span>GIFTIQUE ATELIER</span><h1>Sign in to Giftique Management</h1><p>Use your authorized team account to access orders, inventory, accounting, and delivery operations.</p>{error&&<div className="auth-error">{error}</div>}<label>Email address<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" placeholder="you@business.com"/></label><label>Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} required autoComplete="current-password" placeholder="Your password"/></label><button className="primary" type="submit"><LogIn size={17}/>{loading?"Signing in…":"Sign in"}</button><small><LockKeyhole size={14}/>Access is protected by Supabase authentication.</small></form></main>;
}

function SignOutButton(){const[supabase]=useState(createSupabaseBrowserClient);return <button className="global-signout" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/>Sign out</button>}

type StorefrontProduct={id:string;name:string;description:string|null;category:string;price:number;image_url:string|null;erp_item_code:string|null};

function ClientStorefront(){
 const[products,setProducts]=useState<StorefrontProduct[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const[selected,setSelected]=useState<StorefrontProduct|null>(null),[quantity,setQuantity]=useState(1),[customerName,setCustomerName]=useState(""),[customerEmail,setCustomerEmail]=useState(""),[customerPhone,setCustomerPhone]=useState(""),[orderMessage,setOrderMessage]=useState(""),[placing,setPlacing]=useState(false);
 const[supabase]=useState(createSupabaseBrowserClient);
 useEffect(()=>{let active=true;supabase.from("storefront_products").select("id,name,description,category,price,image_url,erp_item_code").eq("active",true).order("created_at",{ascending:false}).then(({data,error:queryError})=>{if(!active)return;if(queryError)setError("Products are being prepared.");else setProducts((data||[]) as StorefrontProduct[]);setLoading(false)});return()=>{active=false}},[supabase]);
 async function placeOrder(event:FormEvent<HTMLFormElement>){
 event.preventDefault();
 if(!selected)return;
 if(!selected.erp_item_code){
  setOrderMessage("This product is not currently available for checkout.");
  return;
 }
 setPlacing(true);
 setOrderMessage("");

 try{
  const response=await fetch("/api/proxc-order",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    customer_name:customerName,
    customer_email:customerEmail,
    customer_phone:customerPhone,
    items:[{
     item_code:selected.erp_item_code,
     quantity
    }]
   })
  });

  const data=await response.json();

  if(!response.ok || !data?.message?.ok){
   throw new Error(
    data?.error ||
    data?.message?.error ||
    "Unable to create the order."
   );
  }

  const order=data.message.order;

  setOrderMessage(
   `Order ${order.name} received. The Giftique team will contact you shortly.`
  );
  setSelected(null);
  setQuantity(1);
  setCustomerName("");
  setCustomerEmail("");
  setCustomerPhone("");
 }catch(error){
  setOrderMessage(
   error instanceof Error
    ? error.message
    : "Unable to create the order."
  );
 }finally{
  setPlacing(false);
 }
}
 const price=(value:number)=>new Intl.NumberFormat("en-AE",{style:"currency",currency:"AED"}).format(value);
 return <main className="storefront">
    <header className="storefront-nav"><div className="storefront-brand"><span>G</span><strong>GIFTIQUE</strong></div><div className="storefront-nav-links"><a href="#shop">Shop</a><a href="#about">About Giftique</a><button aria-label="Shopping bag"><ShoppingBag size={18}/></button><button className="storefront-signout" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/>Sign out</button></div></header>
  <section className="storefront-hero"><span>GIFTING, MADE PERSONAL</span><h1>Thoughtful pieces for your most meaningful moments.</h1><p>Explore Giftique Atelier's curated collection of gifts, keepsakes, and celebration details.</p><a href="#shop">Explore the collection <ArrowRight size={16}/></a></section>
  <section className="storefront-shop" id="shop"><div className="storefront-heading"><div><span>THE COLLECTION</span><h2>Find something worth remembering.</h2></div><Package size={24}/></div>
   {loading?<p className="storefront-empty">Loading the collection…</p>:error?<p className="storefront-empty">{error}</p>:!products.length?<p className="storefront-empty">The collection is being prepared. Please check back soon.</p>:<div className="storefront-grid">{products.map(product=><article className="storefront-product" key={product.id}>{product.image_url?<img src={product.image_url} alt=""/>:<div className="storefront-product-placeholder"><Package size={28}/></div>}<div><small>{product.category}</small><h3>{product.name}</h3>{product.description&&<p>{product.description}</p>}<strong>{price(product.price)}</strong><button className="storefront-order-button" onClick={()=>{setSelected(product);setOrderMessage("")}}>Choose product</button></div></article>)}</div>}
  </section>
  {selected&&<div className="storefront-order-panel"><form onSubmit={placeOrder}><div><small>YOUR ORDER</small><h2>{selected.name}</h2><p>{price(selected.price)} each</p></div><label>Quantity<input type="number" min="1" max="50" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label><label>Name<input required value={customerName} onChange={event=>setCustomerName(event.target.value)} placeholder="Your name"/></label><label>Email<input required type="email" value={customerEmail} onChange={event=>setCustomerEmail(event.target.value)} placeholder="you@example.com"/></label><label>Phone<input value={customerPhone} onChange={event=>setCustomerPhone(event.target.value)} placeholder="WhatsApp number"/></label><div className="storefront-order-actions"><button type="button" onClick={()=>setSelected(null)}>Cancel</button><button className="primary" type="submit">{placing?"Submitting…":"Place order"}</button></div>{orderMessage&&<p className="storefront-order-message">{orderMessage}</p>}</form></div>}
  <footer className="storefront-footer" id="about"><strong>GIFTIQUE ATELIER</strong><span>Curated gifting from the UAE.</span></footer>
 </main>;
}

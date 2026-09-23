"use client";

import {FormEvent,useEffect,useState} from "react";
import {ArrowRight,LockKeyhole,LogIn,Package,ShoppingBag} from "lucide-react";
import {createSupabaseBrowserClient} from "../lib/supabase";
import type {Session} from "@supabase/supabase-js";

export default function AuthGate({children}:{children:React.ReactNode}){
 const[session,setSession]=useState<Session|null>(null);
 const[email,setEmail]=useState("");
 const[password,setPassword]=useState("");
 const[error,setError]=useState("");
 const[loading,setLoading]=useState(true);
 const[supabase]=useState(createSupabaseBrowserClient);
 useEffect(()=>{let active=true;supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));return()=>{active=false;subscription.unsubscribe()}},[supabase]);
 async function signIn(event:FormEvent<HTMLFormElement>){event.preventDefault();setLoading(true);setError("");const{data,error:signInError}=await supabase.auth.signInWithPassword({email,password});if(signInError){setError(signInError.message);setLoading(false);return}setSession(data.session);setLoading(false)}
 if(session)return session.user.user_metadata?.role==="client"?<ClientStorefront/>:<>{children}</>;
 if(loading)return <main className="auth-page"><div className="auth-card"><div className="auth-mark">G</div><p>GIFTIQUE ATELIER</p><h1>Loading your workspace</h1></div></main>;
 return <main className="auth-page"><form className="auth-card" onSubmit={signIn}><div className="auth-mark">G</div><span>GIFTIQUE ATELIER</span><h1>Sign in to Ledger</h1><p>Use your authorized team account to access orders, inventory, and delivery operations.</p>{error&&<div className="auth-error">{error}</div>}<label>Email address<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" placeholder="you@business.com"/></label><label>Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} required autoComplete="current-password" placeholder="Your password"/></label><button className="primary" type="submit"><LogIn size={17}/>{loading?"Signing in…":"Sign in"}</button><small><LockKeyhole size={14}/>Access is protected by Supabase authentication.</small></form></main>;
}

type StorefrontProduct={id:string;name:string;description:string|null;category:string;price:number;image_url:string|null};

function ClientStorefront(){
 const[products,setProducts]=useState<StorefrontProduct[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const[supabase]=useState(createSupabaseBrowserClient);
 useEffect(()=>{let active=true;supabase.from("storefront_products").select("id,name,description,category,price,image_url").eq("active",true).order("created_at",{ascending:false}).then(({data,error:queryError})=>{if(!active)return;if(queryError)setError("Products are being prepared.");else setProducts((data||[]) as StorefrontProduct[]);setLoading(false)});return()=>{active=false}},[supabase]);
 return <main className="storefront"><header className="storefront-nav"><div className="storefront-brand"><span>G</span><strong>GIFTIQUE</strong></div><div className="storefront-nav-links"><a href="#shop">Shop</a><a href="#about">About Giftique</a><button aria-label="Shopping bag"><ShoppingBag size={18}/></button></div></header><section className="storefront-hero"><span>GIFTING, MADE PERSONAL</span><h1>Thoughtful pieces for your most meaningful moments.</h1><p>Explore Giftique Atelier's curated collection of gifts, keepsakes, and celebration details.</p><a href="#shop">Explore the collection <ArrowRight size={16}/></a></section><section className="storefront-shop" id="shop"><div className="storefront-heading"><div><span>THE COLLECTION</span><h2>Find something worth remembering.</h2></div><Package size={24}/></div>{loading?<p className="storefront-empty">Loading the collection…</p>:error?<p className="storefront-empty">{error}</p>:!products.length?<p className="storefront-empty">The collection is being prepared. Please check back soon.</p>:<div className="storefront-grid">{products.map(product=><article className="storefront-product" key={product.id}>{product.image_url?<img src={product.image_url} alt=""/>:<div className="storefront-product-placeholder"><Package size={28}/></div>}<div><small>{product.category}</small><h3>{product.name}</h3>{product.description&&<p>{product.description}</p>}<strong>{new Intl.NumberFormat("en-AE",{style:"currency",currency:"AED"}).format(product.price)}</strong></div></article>)}</div>}</section><footer className="storefront-footer" id="about"><strong>GIFTIQUE ATELIER</strong><span>Curated gifting from the UAE.</span></footer></main>;
}

"use client";

import {FormEvent,useEffect,useState} from "react";
import {LockKeyhole,LogIn} from "lucide-react";
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
 if(session)return <>{children}</>;
 if(loading)return <main className="auth-page"><div className="auth-card"><div className="auth-mark">G</div><p>GIFTIQUE ATELIER</p><h1>Loading your workspace</h1></div></main>;
 return <main className="auth-page"><form className="auth-card" onSubmit={signIn}><div className="auth-mark">G</div><span>GIFTIQUE ATELIER</span><h1>Sign in to Ledger</h1><p>Use your authorized team account to access orders, inventory, and delivery operations.</p>{error&&<div className="auth-error">{error}</div>}<label>Email address<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" placeholder="you@business.com"/></label><label>Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} required autoComplete="current-password" placeholder="Your password"/></label><button className="primary" type="submit"><LogIn size={17}/>{loading?"Signing in…":"Sign in"}</button><small><LockKeyhole size={14}/>Access is protected by Supabase authentication.</small></form></main>;
}

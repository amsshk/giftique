import {createClient} from "@supabase/supabase-js";

const supabaseUrl=process.env.SUPABASE_URL;
const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
const shopUrl=process.env.SHOPIFY_STORE_URL||"https://www.giftiqueatelier.com";
if(!supabaseUrl||!serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const response=await fetch(`${shopUrl}/products.json?limit=250`);
if(!response.ok) throw new Error(`Shopify catalog request failed: ${response.status}`);
const catalog=await response.json();
const stripHtml=value=>String(value||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,1000);
const rows=(catalog.products||[]).map(product=>({
 source_handle:product.handle,
 name:product.title,
 description:stripHtml(product.body_html),
 category:product.product_type||"Gifts",
 price:Number(product.variants?.[0]?.price||0),
 image_url:product.images?.[0]?.src||product.image?.src||null,
 active:true,
 updated_at:new Date().toISOString()
})).filter(product=>product.name&&product.price>=0);
const supabase=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const{error}=await supabase.from("storefront_products").upsert(rows,{onConflict:"source_handle"});
if(error)throw error;
console.log(`Imported ${rows.length} storefront products`);
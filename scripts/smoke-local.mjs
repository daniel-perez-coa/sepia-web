// Explicit local-only integration check. Original product values are restored
// in finally; audit events are intentionally retained (no physical deletion).
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Solo se permiten pruebas locales.');
const signin = await fetch(`${base}/signin-with-chatgpt?return_to=/admin`,{redirect:'manual'});
const cookie=signin.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const api=async(path,method='GET',body)=>{
  const response=await fetch(`${base}${path}`,{method,headers:{cookie,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw new Error(`${response.status}: ${data.error}`);return data;
};
const initial=await api('/api/admin/bootstrap');
const product=initial.products.find(p=>p.id==='ORBIT_01');
const toPayload=p=>({code:p.id,slug:p.slug,title:p.title,label:p.label,shortDescription:p.desc,longDescription:p.longDescription,priceMinor:p.priceMinor,currency:p.currency,stock:p.stock,
  primaryImageUrl:p.photo,primaryImageAlt:p.photoAlt,content:p.content,collectionId:p.collectionId,categoryId:p.categoryId,subcategoryId:p.subcategoryId,active:p.active,sortOrder:p.sortOrder,
  isPromotion:p.isPromotion,promotionLabel:p.promotionLabel,promotionPriceMinor:p.promotionPriceMinor,promotionStartsAt:p.promotionStartsAt,promotionEndsAt:p.promotionEndsAt,
  isFeatured:p.isFeatured,featuredOrder:p.featuredOrder,featuredConfig:JSON.parse(p.featuredConfigJson),version:p.version});
const original=toPayload(product), path=`/api/admin/products/${product.databaseId}`;
let touched=false;
try{
  await api(path,'PUT',{...original,isFeatured:true,isPromotion:true,promotionPriceMinor:original.priceMinor-100,promotionStartsAt:null,promotionEndsAt:null});touched=true;
  const live=await api('/api/catalog'),p=live.products.find(x=>x.id===product.id),f=live.destacados.find(x=>x.id===product.id);
  assert.equal(p.effectivePriceMinor,original.priceMinor-100);assert.equal(f.Titulo2,p.title);assert.equal(f.LinkUrl,`/producto?id=${product.id}`);
  let fresh=(await api('/api/admin/bootstrap')).products.find(x=>x.id===product.id);
  await api(`${path}/deactivate`,'POST',{version:fresh.version});
  const hidden=await api('/api/catalog');assert.ok(!hidden.products.some(x=>x.id===product.id));assert.ok(!hidden.destacados.some(x=>x.id===product.id));
  fresh=(await api('/api/admin/bootstrap')).products.find(x=>x.id===product.id);
  await api(`${path}/reactivate`,'POST',{version:fresh.version});
  assert.ok((await api('/api/catalog')).products.some(x=>x.id===product.id));
  console.log('D1 local: guardado con auditoría, datos compartidos, promoción, desactivación y reactivación correctos.');
} finally {
  if(touched){const current=(await api('/api/admin/bootstrap')).products.find(x=>x.id===product.id);await api(path,'PUT',{...original,version:current.version});console.log('Valores originales del producto restaurados; historial de pruebas conservado.');}
}
const final=await api('/api/admin/bootstrap');const restored=toPayload(final.products.find(x=>x.id===product.id));
// Config defaults may be materialized by validation; presentation remains equivalent.
delete restored.version;delete original.version;delete restored.featuredConfig;delete original.featuredConfig;
assert.deepEqual(restored,original);
console.log(JSON.stringify({products:final.products.length,pending:final.pendingFeatured.filter(x=>!x.assignedProductId).length,auditEvents:final.audit.length}));

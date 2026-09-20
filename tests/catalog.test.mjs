import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { buildImport, jsonAsLegacy } from '../scripts/catalog-import.mjs';
import { getPublicCatalog, getAdminSnapshot, listProducts, listFeaturedItems } from '../src/server/catalog-data.js';
import { saveRecord, setRecordActive, assignLegacyFeatured, writeStatements } from '../src/server/admin-data.js';
import { handleApiRequest } from '../src/server/api.js';
import { normalizeFeaturedConfig, validateFeaturedConfig, validateContent } from '../src/shared/product-config.js';
import { getExplorePrice, productMatchesExploreFilters } from '../src/shared/explore-filters.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const original = JSON.parse(read('../public/data/c_products.json'));
const source = jsonAsLegacy(original, JSON.parse(read('../public/data/c_toys.json')), JSON.parse(read('../public/data/c_tabs.json')));
const actor = { id: 'test-admin', email: 'test@example.test' };
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(read('../drizzle/0000_grey_redwing.sql')); sqlite.exec(read('../drizzle/0001_dear_sue_storm.sql'));
  sqlite.exec(read('../drizzle/0005_tags_and_product_content_cleanup.sql'));
  sqlite.exec(read('../drizzle/0006_one_tag_per_product.sql'));
  sqlite.exec(buildImport(source));
  const db = {
    prepare(sql) {
      let args = [];
      return { sql, bind(...values) { args = values; return this; },
        async all() { const results = sqlite.prepare(sql).all(...args); return { results, meta: { changes: sqlite.prepare('SELECT changes() AS n').get().n } }; },
        async first() { return sqlite.prepare(sql).get(...args) ?? null; },
        async run() { return this.all(); },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const result = []; for (const s of statements) result.push(await s.all()); sqlite.exec('COMMIT'); return result; }
      catch(e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
  return { sqlite, db, close: () => sqlite.close() };
}
const raw = (s, id = 1) => s.sqlite.prepare('SELECT * FROM catalog_products WHERE id=?').get(id);
const payload = r => ({ code:r.code,slug:r.slug,title:r.title,label:r.label,shortDescription:r.short_description,longDescription:r.long_description,
  priceMinor:r.price_minor,currency:r.currency,stock:r.stock,primaryImageUrl:r.primary_image_url,primaryImageAlt:r.primary_image_alt,content:JSON.parse(r.content_json),
  collectionId:r.collection_id,categoryId:r.category_id,subcategoryId:r.subcategory_id,isPromotion:Boolean(r.is_promotion),promotionLabel:r.promotion_label,
  promotionPriceMinor:r.promotion_price_minor,promotionStartsAt:r.promotion_starts_at,promotionEndsAt:r.promotion_ends_at,isFeatured:Boolean(r.is_featured),featuredOrder:r.featured_order,
  featuredConfig:JSON.parse(r.featured_config_json),sortOrder:r.sort_order,active:Boolean(r.active),version:r.version });
const tax = (name, extra={}) => ({name,slug:name.toLowerCase(),description:'',active:true,showInNav:true,sortOrder:0,...extra});
const countAudit = s => s.sqlite.prepare('SELECT count(*) AS n FROM audit_log').get().n;

test('Explore filters use their explicit product data without cross-field matches', () => {
  const blueSeries = { label: 'SERIES', stock: 7, priceMinor: 55000, options: [{ label: 'Color', values: ['Azul Shift'] }] };
  const blackDescription = { label: 'NEW', stock: 3, priceMinor: 65000, desc: 'Una pieza azul, pero sin opción de color.', options: [{ label: 'Acabado', values: ['Negro mate'] }] };
  const soldOut = { label: 'DROP_01', stock: 0, priceMinor: 100000, variants: [{ value: 'Verde Foam' }], variantLabel: 'Color' };

  assert.equal(productMatchesExploreFilters(blueSeries, { color: 'azul' }), true);
  assert.equal(productMatchesExploreFilters(blackDescription, { color: 'azul' }), false);
  assert.equal(productMatchesExploreFilters(blackDescription, { color: 'negro' }), false);
  assert.equal(productMatchesExploreFilters(blueSeries, { series: 'series' }), true);
  assert.equal(productMatchesExploreFilters(blueSeries, { availability: 'available' }), true);
  assert.equal(productMatchesExploreFilters(blackDescription, { availability: 'available' }), false);
  assert.equal(productMatchesExploreFilters(blackDescription, { availability: 'low' }), true);
  assert.equal(productMatchesExploreFilters(soldOut, { availability: 'sold-out' }), true);
  assert.equal(productMatchesExploreFilters(soldOut, { availability: 'available' }), false);
  assert.equal(productMatchesExploreFilters(blueSeries, { price: 'under-600' }), true);
  assert.equal(productMatchesExploreFilters(blackDescription, { price: '600-999' }), true);
  assert.equal(getExplorePrice({ price: '$550 MXN' }), 550);
});
const withDb = fn => async () => { const s=setup();try{await fn(s);}finally{s.close();} };

test('imports all product content and retains collection banners pending explicit association', withDb(async s=>{
  const c=await getPublicCatalog(s.db);assert.equal(c.products.length,12);assert.equal(c.tabs.length,5);assert.equal(c.destacados.length,0);
  for(const p of c.products){const old=original.products.find(x=>x.id===p.id);assert.equal(p.title,old.title);assert.equal(p.longDescription,old.longDescription);assert.equal(p.Collection,old.Collection);assert.deepEqual(p.gallery,old.gallery);assert.deepEqual(p.specifications,old.specifications);assert.deepEqual(p.tags.map(t=>t.name),old.tags.slice(0,1));}
  const snapshot=await getAdminSnapshot(s.db);assert.equal(snapshot.pendingFeatured.length,3);assert.equal(snapshot.pendingFeatured[0].assignedProductId,null);
  assert.deepEqual(s.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
}));
test('product tags are selected from the managed catalog and saved atomically',withDb(async s=>{
  const tags=(await getAdminSnapshot(s.db)).tags;
  const selected=tags.slice(0,2).map(tag=>tag.id);
  await saveRecord(s.db,'products',{...payload(raw(s)),tagId:selected[0]},actor,1);
  assert.deepEqual((await listProducts(s.db,{identifier:'ORBIT_01'}))[0].tagIds,[selected[0]]);
  await assert.rejects(saveRecord(s.db,'products',{...payload(raw(s)),tagId:99999},actor,1));
}));
test('featured labels are selected from catalog tags and fall back to the product tag',withDb(async s=>{
  const tags=(await getAdminSnapshot(s.db)).tags;
  await saveRecord(s.db,'products',{...payload(raw(s)),tagId:tags[0].id,isFeatured:true,featuredConfig:{...payload(raw(s)).featuredConfig,title1:tags[1].name}},actor,1);
  assert.equal((await listFeaturedItems(s.db))[0].Titulo1,tags[1].name);
  await saveRecord(s.db,'products',{...payload(raw(s)),tagId:tags[0].id,isFeatured:true,featuredConfig:{...payload(raw(s)).featuredConfig,title1:''}},actor,1);
  assert.equal((await listFeaturedItems(s.db))[0].Titulo1,tags[0].name);
  await assert.rejects(saveRecord(s.db,'products',{...payload(raw(s)),isFeatured:true,featuredConfig:{...payload(raw(s)).featuredConfig,title1:'NO EXISTE'}},actor,1),/etiqueta activa del catálogo/i);
}));
test('one product supplies details, card and featured; overrides do not copy price or link',withDb(async s=>{
  const data=payload(raw(s));Object.assign(data,{title:'Nombre único',shortDescription:'Descripción compartida',priceMinor:60000,isFeatured:true});
  await saveRecord(s.db,'products',data,actor,1);
  const c=await getPublicCatalog(s.db),p=c.products.find(p=>p.databaseId===1),f=c.destacados[0];
  assert.equal(p.title,f.Titulo2);assert.equal(p.desc,f.text);assert.equal(p.photo,f.Photo);assert.equal(f.LinkUrl,'/producto?id=ORBIT_01');
  assert.equal(p.priceMinor,60000);assert.equal(countAudit(s),2);
}));
test('promotion is independent of featured and uses regular price outside its date window',withDb(async s=>{
  await saveRecord(s.db,'products',{...payload(raw(s)),isPromotion:true,promotionPriceMinor:45000,promotionLabel:'OFERTA'},actor,1);
  let p=(await listProducts(s.db,{identifier:'ORBIT_01'}))[0];assert.equal(p.effectivePriceMinor,45000);assert.equal(p.isFeatured,false);assert.ok(p.badges.includes('OFERTA'));
  await saveRecord(s.db,'products',{...payload(raw(s)),promotionStartsAt:'2099-01-01T00:00:00Z',promotionEndsAt:'2099-02-01T00:00:00Z'},actor,1);
  p=(await listProducts(s.db,{identifier:'ORBIT_01'}))[0];assert.equal(p.effectivePriceMinor,p.priceMinor);assert.equal(p.promotionActive,false);
  await saveRecord(s.db,'products',{...payload(raw(s)),promotionStartsAt:null,promotionEndsAt:'2000-01-01T00:00:00Z'},actor,1);
  assert.equal((await listProducts(s.db,{identifier:'ORBIT_01'}))[0].promotionActive,false);
}));
test('invalid relationship cannot partially change product or audit',withDb(async s=>{
  const before=raw(s);await assert.rejects(saveRecord(s.db,'products',{...payload(before),priceMinor:1,collectionId:999},actor,1));
  assert.deepEqual(raw(s),before);assert.equal(countAudit(s),1);
}));
test('subcategory must belong to category, including at the SQL boundary',withDb(async s=>{
  const c=await saveRecord(s.db,'categories',tax('Hogar'),actor);
  const sub=await saveRecord(s.db,'subcategories',tax('Lamparas',{categoryId:c.id}),actor);
  await assert.rejects(saveRecord(s.db,'products',{...payload(raw(s)),subcategoryId:sub.id},actor,1));
  assert.throws(()=>s.sqlite.prepare('UPDATE catalog_products SET subcategory_id=? WHERE id=1').run(sub.id),/FOREIGN KEY/);
  await saveRecord(s.db,'products',{...payload(raw(s)),categoryId:c.id,subcategoryId:sub.id},actor,1);
  assert.equal(raw(s).subcategory_id,sub.id);
  await assert.rejects(saveRecord(s.db,'subcategories',tax('Lamparas',{categoryId:1,version:1}),actor,sub.id),/FOREIGN KEY/);
}));
test('logical product deletion and reactivation keep IDs and contents',withDb(async s=>{
  const old=raw(s);await setRecordActive(s.db,'products',1,{version:1},actor,false);
  assert.equal((await listProducts(s.db,{identifier:'ORBIT_01'})).length,0);
  assert.equal((await getAdminSnapshot(s.db)).products.length,12);assert.equal(raw(s).content_json,old.content_json);
  assert.ok(raw(s).deactivated_at);await setRecordActive(s.db,'products',1,{version:2},actor,true);
  assert.equal(raw(s).deactivated_at,null);assert.equal((await listProducts(s.db,{identifier:'ORBIT_01'})).length,1);
  const events=s.sqlite.prepare('SELECT action,before_json,after_json FROM audit_log WHERE entity_type=? ORDER BY id').all('products');
  assert.deepEqual(events.map(e=>e.action),['deactivate','reactivate']);assert.equal(JSON.parse(events[0].after_json).active,0);
}));
test('inactive parent hides tabs, cards, details and featured without changing child state',withDb(async s=>{
  await saveRecord(s.db,'products',{...payload(raw(s)),isFeatured:true},actor,1);
  await setRecordActive(s.db,'products',2,{version:1},actor,false);
  await setRecordActive(s.db,'categories',1,{version:1},actor,false);
  const c=await getPublicCatalog(s.db);assert.equal(c.products.length,0);assert.equal(c.destacados.length,0);assert.equal(raw(s).active,1);
  await setRecordActive(s.db,'categories',1,{version:2},actor,true);assert.equal((await listProducts(s.db)).length,11);assert.equal(raw(s,2).active,0);
  await setRecordActive(s.db,'collections',1,{version:1},actor,false);
  assert.ok(!(await getPublicCatalog(s.db)).tabs.some(t=>t.filterValue==='shift-crew'));
  assert.equal((await listProducts(s.db,{identifier:'ORBIT_01'})).length,0);
}));
test('new assignments reject inactive catalogs; existing inactive associations can be retained',withDb(async s=>{
  await setRecordActive(s.db,'collections',1,{version:1},actor,false);
  await saveRecord(s.db,'products',{...payload(raw(s)),title:'Edición conservada'},actor,1);
  await assert.rejects(saveRecord(s.db,'products',{...payload(raw(s,2)),collectionId:1},actor,2));
}));
test('stale versions reject updates',withDb(async s=>{
  const stale=payload(raw(s));await saveRecord(s.db,'products',{...stale,title:'Primero'},actor,1);
  await assert.rejects(saveRecord(s.db,'products',{...stale,title:'Segundo'},actor,1),e=>e instanceof Response&&e.status===409);
  assert.equal(raw(s).title,'Primero');assert.equal(countAudit(s),2);
}));
test('transaction rolls back if audit insert fails',withDb(async s=>{
  s.sqlite.exec("CREATE TRIGGER test_audit_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  const before=raw(s),statements=writeStatements(s.db,'products',before,{title:'No debe persistir'},actor,'update');
  await assert.rejects(s.db.batch(statements));assert.deepEqual(raw(s),before);assert.equal(countAudit(s),1);
}));
test('write-time optimistic guard rolls back an entire multi-record batch',withDb(async s=>{
  const one=raw(s),two=raw(s,2);
  s.sqlite.prepare('UPDATE catalog_products SET version=version+1 WHERE id=2').run();
  await assert.rejects(s.db.batch([...writeStatements(s.db,'products',one,{title:'Rollback'},actor),...writeStatements(s.db,'products',two,{title:'Stale'},actor)]));
  assert.equal(raw(s).title,one.title);assert.equal(countAudit(s),1);
}));
test('pending banner association is explicit, atomic, traceable, and cannot overwrite another banner',withDb(async s=>{
  await assignLegacyFeatured(s.db,{legacyId:'ghost-drop-01',productId:2,productVersion:1,pendingVersion:1},actor);
  const slides=await listFeaturedItems(s.db);assert.equal(slides.length,1);assert.equal(slides[0].LinkUrl,'/producto?id=KUMA_BLACK');
  const snapshot=await getAdminSnapshot(s.db);assert.equal(snapshot.pendingFeatured.find(p=>p.id==='ghost-drop-01').assignedProductId,2);assert.equal(snapshot.pendingFeatured.length,3);
  assert.equal(countAudit(s),3);
  await assert.rejects(assignLegacyFeatured(s.db,{legacyId:'shift-crew-01',productId:2,productVersion:2,pendingVersion:2},actor));
}));
test('prices, dates, booleans, content and visual choices are validated',withDb(async s=>{
  for(const invalid of [{priceMinor:1.5},{stock:-1},{isPromotion:'yes'},{promotionPriceMinor:60000},{promotionStartsAt:'invalid'},{promotionStartsAt:'2030-02-01T00:00:00Z',promotionEndsAt:'2030-01-01T00:00:00Z'}])await assert.rejects(saveRecord(s.db,'products',{...payload(raw(s)),...invalid},actor,1));
  assert.throws(()=>validateFeaturedConfig({template:'unknown'}));assert.throws(()=>validateFeaturedConfig({imageUrl:'javascript:alert(1)'}));assert.throws(()=>validateFeaturedConfig({title1Adj:{horizontal:'diagonal'}}));
  assert.throws(()=>validateFeaturedConfig({titleSize:97}));assert.throws(()=>validateFeaturedConfig({descriptionSize:41}));
  assert.doesNotThrow(()=>validateFeaturedConfig({titleSize:36,descriptionSize:18,lineColor:'#ff3300',linkColor:'#00ff99',labelColor:'#ffffff',titleBoxColor:'#6633ff',title1Adj:{textAlign:'center',justify:'end'}}));
  assert.throws(()=>validateContent({gallery:'not-array'}));assert.throws(()=>validateContent({options:[{label:'Color',values:[],selected:0}]}));
  assert.doesNotThrow(()=>validateContent({variantLabel:'Color',variants:[{value:'Azul',priceMinor:12000,stock:3,isPromotion:true,promotionLabel:'PROMOCIÓN',promotionPriceMinor:10000,promotionStartsAt:'2030-01-01T00:00:00Z',promotionEndsAt:'2030-02-01T00:00:00Z'}]}));
  assert.throws(()=>validateContent({variants:[{value:'Azul',priceMinor:12000,stock:3,isPromotion:true,promotionLabel:'PROMOCIÓN',promotionPriceMinor:13000}]}));
  const normalizedFeatured=normalizeFeaturedConfig({textColor:'#fa0000'});assert.equal(normalizedFeatured.template,'editorial-left');assert.equal(normalizedFeatured.lineColor,'#fa0000');assert.equal(normalizedFeatured.titleBoxColor,'#fa0000');assert.equal(Object.hasOwn(normalizedFeatured.title1Adj,'textAlign'),false);assert.equal(countAudit(s),1);
}));
test('new products require existing taxonomy and get an audit event',withDb(async s=>{
  const p={...payload(raw(s)),code:'TEST_NEW',slug:'test-new',content:{},active:false};delete p.version;
  const result=await saveRecord(s.db,'products',p,actor);assert.ok(result.id>12);
  const last=s.sqlite.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 1').get();assert.equal(last.entity_id,String(result.id));assert.equal(JSON.parse(last.after_json).code,'TEST_NEW');
}));
test('tabs switch to categories without duplicate tab records',withDb(async s=>{
  const snapshot=await getAdminSnapshot(s.db);await saveRecord(s.db,'settings',{version:1,active:true,value:{tabMode:'categories',autoplayMs:8000,featuredEnabled:true}},actor,snapshot.settings.id);
  const c=await getPublicCatalog(s.db);assert.equal(c.tabs.length,2);assert.equal(c.tabs[1].filterType,'category');assert.equal(c.autoplayMs,8000);
}));
test('API denies anonymous and non-admin identities; fails closed without allowlist',withDb(async s=>{
  const req=id=>new Request('http://test/api/admin/bootstrap',{headers:id?{'oai-authenticated-user-id':id}:{}});
  assert.equal((await handleApiRequest(req(),{DB:s.db,ADMIN_USER_IDS:actor.id})).status,401);
  assert.equal((await handleApiRequest(req('visitor'),{DB:s.db,ADMIN_USER_IDS:actor.id})).status,403);
  assert.equal((await handleApiRequest(req(actor.id),{DB:s.db})).status,403);
  assert.equal((await handleApiRequest(req(actor.id),{DB:s.db,ADMIN_USER_IDS:actor.id})).status,200);
}));
test('API returns detail by code and slug; handles async validation errors and cross-origin writes',withDb(async s=>{
  const env={DB:s.db,ADMIN_USER_IDS:actor.id};
  for(const id of ['KUMA_BLACK','kuma-black'])assert.equal((await handleApiRequest(new Request(`http://test/api/products/${id}`),env)).status,200);
  assert.equal((await handleApiRequest(new Request('http://test/api/products/missing'),env)).status,404);
  const req=(body,origin)=>new Request('http://test/api/admin/products/1',{method:'PUT',headers:{'content-type':'application/json','oai-authenticated-user-id':actor.id,...(origin?{origin}:{})},body:JSON.stringify(body)});
  assert.equal((await handleApiRequest(req({...payload(raw(s)),priceMinor:-1}),env)).status,400);
  assert.equal((await handleApiRequest(req(payload(raw(s)),'https://attacker.example'),env)).status,403);
}));
test('API limits streamed request size even without a content-length header',withDb(async s=>{
  const r=new Request('http://test/api/admin/products',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':actor.id},body:JSON.stringify({value:'x'.repeat(524288)})});
  assert.equal((await handleApiRequest(r,{DB:s.db,ADMIN_USER_IDS:actor.id})).status,413);
}));

test('inactive subcategories hide products and category navigation includes active children',withDb(async s=>{
  const sub=await saveRecord(s.db,'subcategories',tax('Articuladas',{categoryId:1}),actor);
  await saveRecord(s.db,'products',{...payload(raw(s)),subcategoryId:sub.id},actor,1);
  const settings=(await getAdminSnapshot(s.db)).settings;
  await saveRecord(s.db,'settings',{version:settings.version,active:true,value:{tabMode:'categories',autoplayMs:6500,featuredEnabled:true}},actor,settings.id);
  assert.ok((await getPublicCatalog(s.db)).tabs.some(t=>t.filterType==='subcategory'&&t.filterValue==='articuladas'));
  await setRecordActive(s.db,'subcategories',sub.id,{version:1},actor,false);
  assert.equal((await listProducts(s.db,{identifier:'ORBIT_01'})).length,0);
  assert.ok(!(await getPublicCatalog(s.db)).tabs.some(t=>t.filterValue==='articuladas'));
  assert.equal(raw(s).active,1);
}));
test('incomplete drafts cannot be activated through the lifecycle endpoint',withDb(async s=>{
  const draft=await saveRecord(s.db,'products',{...payload(raw(s)),code:'DRAFT',slug:'draft',active:false,content:{}},actor);
  await assert.rejects(setRecordActive(s.db,'products',draft.id,{version:1},actor,true));
  assert.equal(raw(s,draft.id).active,0);
}));
test('public product responses do not expose audit actors or raw JSON storage columns',withDb(async s=>{
  const [product]=await listProducts(s.db);
  for(const key of ['createdBy','updatedBy','deactivatedBy','contentJson','featuredConfigJson'])assert.equal(Object.hasOwn(product,key),false);
  assert.equal((await getAdminSnapshot(s.db)).products[0].createdBy,'migration:legacy');
}));

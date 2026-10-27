const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.BLOG_QA_URL||'http://127.0.0.1:4326';const out=path.resolve(process.env.BLOG_QA_OUT||'editorial/ccsc-2026/audit/blog-adaptation-2026-10-26');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});const results=[];const errors=[];
 for(const width of [375,390,768,1440])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
  await ctx.addInitScript(({theme})=>{localStorage.setItem('torchbearer-locale','zh-CN');localStorage.setItem('torchbearer-theme',theme)}, {theme});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
  for(const part of [1,2,3]){
   await page.goto(`${base}/writing/research-notes/ccsc-2026-part-0${part}/?lang=zh-CN`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   const info=await page.evaluate(async()=>{
    const article=document.querySelector('[data-essay-article]');
    const images=[...article.querySelectorAll('img')];
    const statuses=await Promise.all(images.map(async i=>(await fetch(i.src,{method:'HEAD'})).status));
    const refs=[...article.querySelectorAll('a[href^="#ref-"]')];
    const toc=[...document.querySelectorAll('[data-toc-link]')];
    const styles=getComputedStyle(article.querySelector('p:not([class])'));
    return {h1:article.querySelectorAll('h1').length,math:article.querySelectorAll('.katex').length,displayMath:article.querySelectorAll('.katex-display').length,mathErrors:article.querySelectorAll('.katex-error').length,figures:article.querySelectorAll('figure').length,intrinsicSizes:images.every(img=>Number(img.getAttribute('width'))>0&&Number(img.getAttribute('height'))>0),centered:[...article.querySelectorAll('figcaption')].every(c=>getComputedStyle(c).textAlign==='center'),imageStatuses:statuses,refsValid:refs.every(a=>document.getElementById(a.hash.slice(1))),tocValid:toc.every(a=>document.getElementById(decodeURIComponent(a.hash.slice(1)))),series:article.querySelectorAll('.series-navigation li').length,current:article.querySelectorAll('.series-navigation [aria-current="page"]').length,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,signatures:article.querySelectorAll('.report-signature').length,font:styles.fontFamily,fontSize:styles.fontSize,lineHeight:styles.lineHeight,theme:document.documentElement.dataset.theme,preBackground:getComputedStyle(article.querySelector('pre')).backgroundColor,missingStyles:[...document.querySelectorAll('link[rel="stylesheet"]')].filter(l=>!l.sheet).length};
   });
   assert.equal(info.h1,1);assert.equal(info.math,[122,183,162][part-1]);assert.equal(info.displayMath,[91,141,141][part-1]);assert.equal(info.mathErrors,0);assert.equal(info.figures,[24,14,24][part-1]);assert.ok(info.centered);assert.ok(info.intrinsicSizes);assert.ok(info.imageStatuses.every(s=>s===200));assert.ok(info.refsValid);assert.ok(info.tocValid);assert.equal(info.series,3);assert.equal(info.current,1);assert.ok(info.pageWidth<=width+1,JSON.stringify({width,theme,part,info}));assert.equal(info.missingStyles,0);assert.equal(info.theme,theme);assert.equal(info.preBackground,theme==='light'?'rgb(247, 248, 250)':'rgb(15, 26, 42)');
   const overflow=await page.evaluate(()=>[...document.querySelectorAll('.katex-display')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>{const box=el.getBoundingClientRect();const first=el.querySelector('.katex-html .base')?.getBoundingClientRect();return {start:first?.left-box.left,maxScroll:el.scrollWidth-el.clientWidth}}));assert.ok(overflow.every(x=>x.start>=-1),JSON.stringify(overflow));
   for(const a of await page.locator('.series-navigation li a').all()){const response=await page.request.head(new URL(await a.getAttribute('href'),base).href);assert.equal(response.status(),200);}
   if(width===375){const details=page.locator('[data-mobile-contents]');await details.locator('summary').click();assert.ok(await details.evaluate(d=>d.open));await details.locator('a').first().click();await page.waitForTimeout(100);assert.ok(!(await details.evaluate(d=>d.open)));assert.ok(new URL(page.url()).hash);}
   if(width===1440&&theme==='light'&&part===1){
    for(const [name,selector] of [['report-title','h2'],['figure','figure'],['gray-frame','pre[data-language="text"]'],['formula','.katex-display'],['reference','.article-reference']]){const candidates=page.locator('.essay-article '+selector);const target=(name==='reference'?candidates.filter({hasText:/^\[\d+\]/}):candidates).first();await target.scrollIntoViewIfNeeded();if(name==='figure')await target.locator('img').evaluate(img=>img.decode());await target.screenshot({path:path.join(out,name+'-detail.png')});}
   }
   if(width===375||width===1440){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`part0${part}-${width}-${theme}.png`)});}
   results.push({part,width,theme,...info});
  }
  if(width===1440&&theme==='light'){
   await page.goto(`${base}/writing/essays/sovereign-driver/?lang=zh-CN`);await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.essay-article h2').count(),5);assert.equal(await page.locator('.series-navigation').count(),0);await page.screenshot({path:path.join(out,'existing-essay-desktop.png')});
  }
  await page.goto(`${base}/writing/research-notes/?lang=zh-CN`);assert.equal(await page.locator('h3 a[href*="ccsc-2026-part-"]').count(),0);assert.equal(await page.locator('h3 a[href="/writing/research-notes/series/ccsc-2026"]').count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('a[href*="content-system-fixture"]').count(),0);
  await page.locator('h3 a[href="/writing/research-notes/series/ccsc-2026"]').click();assert.deepEqual(await page.locator('h3 a').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),[1,2,3].map(i=>`/writing/research-notes/ccsc-2026-part-0${i}`));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await ctx.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({passed:true,results,errors},null,2));await browser.close();console.log(JSON.stringify({passed:true,scenarios:results.length,math:467,images:62,errors}));
})().catch(e=>{console.error(e);process.exit(1)});

import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { fromHtml } from 'hast-util-from-html';
import remarkMath from 'remark-math';
const pluginUrl=new URL('../../src/plugins/rehype-article.mjs',import.meta.url);
test('article markup gives images captions, report bylines small text, and a bounded reference region',async()=>{
 assert.ok(existsSync(pluginUrl),'Article markup plugin is required');
 const {default:plugin}=await import(pluginUrl);
 const text=value=>({type:'text',value}); const el=(tagName,children=[],properties={})=>({type:'element',tagName,properties,children});
 const tree={type:'root',children:[el('h2',[text('报告')]),el('p',[el('strong',[text('大学 作者')])]),el('p',[el('img',[],{src:'/slide.png',alt:'报告图'})]),el('h2',[text('参考资料')]),el('p',[text('[1] Source')]),el('h2',[text('收束')]),el('p',[text('末句')])]};
 plugin({imageDimensions:{'/slide.png':{width:1200,height:800}}})(tree);
 assert.equal(tree.children[2].tagName,'figure');
 assert.equal(tree.children[2].children[0].properties.width,1200);
 assert.equal(tree.children[2].children[0].properties.height,800);
 assert.equal(tree.children[2].children[1].tagName,'figcaption');
 assert.equal(tree.children[2].children[1].children[0].value,'报告图');
 assert.ok(tree.children[1].properties.className.includes('report-signature'));
 assert.ok(tree.children[4].properties.className.includes('article-reference'));
 assert.equal(tree.children[6].properties.className,undefined);
});

for (const part of ['01','02','03']) {
 test(`CCSC part ${part} renders strong emphasis without literal Markdown delimiters`,async()=>{
  const source=readFileSync(new URL(`../../src/content/writing/research-notes/ccsc-2026-part-${part}/index.md`,import.meta.url),'utf8').replace(/^---\n[\s\S]*?\n---\n/,'');
  const processor=await createMarkdownProcessor({syntaxHighlight:false,remarkPlugins:[remarkMath]});
  const {code}=await processor.render(source);
  const tree=fromHtml(code,{fragment:true});
  const literals=[]; const strong=[];
  const text=n=>n.type==='text'?n.value:(n.children??[]).map(text).join('');
  function visit(n,protectedText=false){
   protectedText ||= n.type==='element'&&['code','pre','math'].includes(n.tagName);
   if(n.type==='text'&&!protectedText&&n.value.includes('**'))literals.push(n.value);
   if(n.type==='element'&&n.tagName==='strong')strong.push(text(n));
   for(const child of n.children??[])visit(child,protectedText);
  }
  visit(tree);
  assert.deepEqual(literals,[],`Part ${part} has unparsed emphasis`);
  if(part==='01')assert.ok(strong.includes('自然语言摘要很容易损失程序执行所依赖的精确语义。'));
  if(part==='03'){
   const before=strong.find(s=>s.includes('判断这次执行安不安全'));
   assert.ok(before&&!before.includes('走向')&&!before.includes('理解为什么失败'),'The two emphasized phrases must remain separate');
  }
 });
}
test('exported articles contain no internal editorial audit markers',()=>{
 for(const part of ['01','02','03']){
  const url=new URL(`../../src/content/writing/research-notes/ccsc-2026-part-${part}/index.md`,import.meta.url);
  const body=readFileSync(url,'utf8');
  assert.ok(!/<!--\s*(?:source:|equations:|figure:|editorial:|REVIEW_)/.test(body), `Part ${part} has an internal marker`);
 }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as writing from '../../src/lib/writing-entities.ts';
const { assembleWritingEntities } = writing;
const getWritingSeries = (...args) => { assert.equal(typeof writing.getWritingSeries, 'function', 'Series navigation helper is required'); return writing.getWritingSeries(...args); };
const entry = (slug, order, extra = {}) => ({
 id: `research-notes/${slug}`,
 data: {title: slug, description: slug, locale:'zh-CN', date:new Date(`2026-10-${30-order}`), series:{id:'ccsc-2026',title:'CCSC 2026 研究札记',order}, ...extra},
});
test('series follows explicit order rather than date and carries shared metadata', () => {
 const entities=assembleWritingEntities([entry('part-three',3),entry('part-one',1),entry('part-two',2),entry('other',1,{series:{id:'other',title:'Other',order:1}})]);
 const current=entities.find(x=>x.slug==='part-two');
 assert.deepEqual(getWritingSeries(current,entities).map(x=>x.slug),['part-one','part-two','part-three']);
 assert.equal(current.data.series.title,'CCSC 2026 研究札记');
});
test('series rejects duplicate positions and translations repeating shared series metadata', () => {
 assert.throws(()=>assembleWritingEntities([entry('one',1),entry('two',1)]),/duplicate.*series.*order/i);
 assert.throws(()=>assembleWritingEntities([entry('one',1),{id:'research-notes/one/en',data:{title:'English',description:'English',locale:'en',series:{id:'ccsc-2026',title:'CCSC',order:1}}}]),/shared metadata.*series/i);
});
test('a standalone article has no series navigation',()=>{
 const entities=assembleWritingEntities([entry('standalone',1,{series:undefined})]);
 assert.deepEqual(getWritingSeries(entities[0],entities),[]);
});
test('production hides drafts, while explicit preview admits series drafts and excludes internal fixtures',()=>{
 assert.equal(typeof writing.isWritingVisible,'function','Draft visibility helper is required');
 const [published]=assembleWritingEntities([entry('published',1,{draft:false})]);
 const [seriesDraft]=assembleWritingEntities([entry('series-draft',1,{draft:true})]);
 const [fixture]=assembleWritingEntities([entry('fixture',1,{series:undefined,draft:true})]);
 assert.ok(writing.isWritingVisible(published));
 assert.equal(writing.isWritingVisible(seriesDraft),false);
 assert.ok(writing.isWritingVisible(seriesDraft,true));
 assert.equal(writing.isWritingVisible(fixture,true),false);
});
test('writing listings collapse a series before limiting while retaining standalone entries',()=>{
 assert.equal(typeof writing.groupWritingEntries,'function','Grouped list entries are required');
 const entries=assembleWritingEntities([entry('three',3),entry('one',1),entry('two',2),entry('single',1,{series:undefined})]);
 const grouped=writing.groupWritingEntries(entries);
 assert.equal(grouped.length,2);
 const series=grouped.find(group=>group.series);
 assert.deepEqual(series.entries.map(e=>e.slug),['one','two','three']);
 assert.equal(series.entries.length,3);
 assert.ok(grouped.some(group=>!group.series&&group.entries[0].slug==='single'));
 assert.equal(writing.getWritingSeriesHref(series.series,series.type),'/writing/research-notes/series/ccsc-2026');
});
test('a series spanning years has one list group dated by its latest visible entry',()=>{
 const entries=assembleWritingEntities([entry('one',1,{date:new Date('2025-01-01')}),entry('two',2,{date:new Date('2026-02-01')})]);
 assert.equal(typeof writing.groupWritingEntries,'function','Grouped list entries are required');
 const groups=writing.groupWritingEntries(entries);
 assert.equal(groups.length,1);
 assert.equal(groups[0].date.getFullYear(),2026);
 assert.equal(groups[0].entries[0].slug,'one');
 assert.deepEqual(writing.groupWritingEntries(groups[0].entries,false).map(g=>g.entries[0].slug),['one','two']);
});

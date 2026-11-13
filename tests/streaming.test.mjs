import test from 'node:test';
import assert from 'node:assert/strict';
import {CHUNK_SIZE,CHUNK_LIMIT,ChunkStore} from '../dist/chunks.mjs';
import {World} from '../dist/sim.mjs';
import {revealProgress,REVEAL_SECONDS} from '../dist/reveal.mjs';

test('los sectores tienen 64x64 y encajan exactamente en coordenadas negativas',()=>{
 assert.equal(CHUNK_SIZE,64);
 assert.equal(CHUNK_LIMIT,36);
 const cache=new ChunkStore((x,y)=>({x,y}));
 assert.equal(cache.getChunk(0,0).length,4096);
 assert.deepEqual(cache.tile(-1,-1),{x:-1,y:-1});
 assert.deepEqual(cache.tile(-64,-64),{x:-64,y:-64});
 assert.deepEqual(cache.tile(63,63),{x:63,y:63});
 assert.deepEqual(cache.tile(64,64),{x:64,y:64});
 assert.equal(cache.getChunk(1,1).length,4096);
});
test('prefetch prepara las zonas limítrofes de forma gradual y respeta el tope de memoria',()=>{
 const cache=new ChunkStore((x,y)=>({x,y}));cache.setRegion(0,0);
 const before=cache.chunkCount;
 assert.ok(cache.pending.length>0);
 assert.equal(cache.prefetchNext(1),1);
 assert.equal(cache.chunkCount,before+1);
 for(let i=0;i<50;i++)cache.prefetchNext(1);
 assert.equal(cache.chunkCount,25);
 cache.setRegion(3,-2);
 for(let i=0;i<60;i++)cache.prefetchNext(1);
 assert.ok(cache.chunkCount<=CHUNK_LIMIT);
 assert.deepEqual(cache.tile(3*64,-2*64),{x:192,y:-128});
});
test('las texturas y modificaciones no desaparecen tras descartar sectores de gran tamaño',()=>{
 const world=new World('SECTORES-GRANDES');
 const t=world.tile(-80,174);const wasTree=t.tree;
 t.tree=false;t.road=true;world.rememberTile(t);
 for(let i=0;i<45;i++)world.setViewRegion(i,-i);
 assert.ok(world.loadedChunks<=CHUNK_LIMIT);
 assert.equal(world.tile(-80,174).road,true);
 assert.equal(world.tile(-80,174).tree,false);
 const restored=new World(world.seed,JSON.parse(JSON.stringify(world.serialize())));
 assert.equal(restored.tile(-80,174).road,true);
 assert.equal(restored.tile(-80,174).tree,false);
 assert.equal(typeof wasTree,'boolean');
});
test('la aparición del terreno es continua, progresiva y termina en 100%',()=>{
 assert.equal(revealProgress(-3),0);
 assert.equal(revealProgress(0),0);
 assert.equal(revealProgress(REVEAL_SECONDS),1);
 assert.equal(revealProgress(REVEAL_SECONDS*2),1);
 assert.ok(revealProgress(REVEAL_SECONDS*.25)<revealProgress(REVEAL_SECONDS*.5));
 assert.ok(revealProgress(REVEAL_SECONDS*.5)<revealProgress(REVEAL_SECONDS*.75));
 assert.ok(Math.abs(revealProgress(REVEAL_SECONDS*.5)-.5)<1e-9);
 assert.ok(revealProgress(.001)<.001,'evita el salto de aparición inicial');
 assert.ok(1-revealProgress(REVEAL_SECONDS-.001)<.001,'evita el salto final');
});

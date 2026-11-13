import test from 'node:test';
import assert from 'node:assert/strict';
import {ChunkStore,CHUNK_SIZE,CHUNK_LIMIT} from '../dist/chunks.mjs';
import {World} from '../dist/sim.mjs';

test('la región lógica reutiliza el sector existente, sin repetir 4.096 accesos a casillas',()=>{
 const store=new ChunkStore((x,y)=>({x,y,type:'grass',tree:false,rock:false}));
 const chunk=store.getChunk(0,0);
 assert.strictEqual(store.setRegion(0,0),chunk);
 assert.strictEqual(store.setRegion(0,0),chunk);
 assert.equal(store.chunkCount,1);
 assert.equal(chunk.length,CHUNK_SIZE*CHUNK_SIZE);
});
test('un sector sin cambios mantiene su revisión y no requiere re-renderizado diario',()=>{
 const store=new ChunkStore((x,y)=>({x,y,type:'grass',tree:false,rock:false}));
 store.setRegion(0,0);
 assert.equal(store.revision(0,0),0);
 const tile=store.tile(4,5);
 tile.road=true;store.remember(tile);
 assert.equal(store.revision(0,0),1);
 assert.equal(store.revision(1,0),0);
 for(let i=0;i<25;i++)store.setRegion(0,0);
 assert.equal(store.revision(0,0),1);
});
test('la revisión persiste al expulsar de caché y volver a cargar el mismo sector',()=>{
 const store=new ChunkStore((x,y)=>({x,y,type:'grass',tree:false,rock:false}));
 const tile=store.tile(-73,105);tile.tree=true;store.remember(tile);
 const rev=store.revision(-2,1);assert.equal(rev,1);
 for(let x=10;x<100;x++)store.setRegion(x,-x);
 assert.ok(store.chunkCount<=CHUNK_LIMIT);
 assert.equal(store.revision(-2,1),rev);
 assert.equal(store.tile(-73,105).tree,true);
 const modified=store.tile(-73,105);
 modified.tree=false;store.remember(modified);
 assert.equal(store.revision(-2,1),rev+1);
});
test('la importación de una partida marca sectores sucios y conserva los recursos',()=>{
 const world=new World('PERFORMANCE-GUARDADO');
 const tile=world.tile(20,20);const before=world.chunks.revision(0,0);
 tile.road=true;world.rememberTile(tile);
 assert.equal(world.chunks.revision(0,0),before+1);
 const save=world.serialize(),newWorld=new World(save.seed,JSON.parse(JSON.stringify(save)));
 assert.equal(newWorld.tile(20,20).road,true);
 assert.ok(newWorld.chunks.revision(0,0)>0);
});

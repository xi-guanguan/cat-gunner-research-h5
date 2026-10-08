import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,sourceGun,serializeSession,deserializeSession} from '../session';
test('catalogue history survives persistence after its gun is no longer owned',()=>{const s=createSession(1);s.catalogSeen=[0,6,32];const r=deserializeSession(serializeSession(s));assert.deepEqual(r.catalogSeen,[0,6,32]);});
test('legacy history seeds current source identities; malformed history is rejected',()=>{const s=createSession(1);s.gunInventory=[sourceGun(6),sourceGun(32)];delete s.catalogSeen;assert.deepEqual(deserializeSession(serializeSession(s)).catalogSeen,[6,32,0]);const json=JSON.parse(serializeSession(s));json.session.catalogSeen=[65];assert.throws(()=>deserializeSession(JSON.stringify(json)),/catalogue/);json.session.catalogSeen=[6,6];assert.throws(()=>deserializeSession(JSON.stringify(json)),/catalogue/);});

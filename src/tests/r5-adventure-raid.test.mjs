import test from 'node:test'
import assert from 'node:assert/strict'
import * as A from '../r5-adventure.ts'
import * as R from '../r5-raid.ts'
test('source arrays and original rewards remain independent of PlusPack duration', () => {
 assert.deepEqual(A.ADVENTURE_DURATION_HOURS,[1,2,4,8,16])
 assert.deepEqual(A.ADVENTURE_UNLOCK_LEVELS,[0,1,3,6,10])
 assert.equal(A.adventureEffectiveDurationHours(4,true),0)
 assert.equal(A.adventureRewardCore([0,1,2],4),1056)
 assert.equal(A.adventureRewardExp(3,4),480)
 assert.equal(A.adventureRewardCore(null,4),0)
 assert.deepEqual([0,1,2,6,7].map(A.adventurePetSlotCount),[1,1,2,2,3])
})
test('native runtime exp curve replaces serialized old curve and level cap clears overflow', () => {
 assert.deepEqual([0,1,2,3,14].map(A.adventureRequiredExp),[50,73,102,137,918])
 assert.deepEqual(A.adventureGainExp({level:0,exp:49},74),{level:2,exp:0})
 assert.deepEqual(A.adventureGainExp({level:14,exp:900},1000),{level:15,exp:0})
 assert.deepEqual(A.adventureGainExp({level:15,exp:0},1000),{level:15,exp:0})
})
test('all weekday masks including invalid days/types', () => {
 assert.deepEqual([0,1,2].map(type=>Array.from({length:7},(_,d)=>d).filter(d=>A.adventureIsOpenDay(type,d))),[[0,1,4],[0,2,5],[0,3,6]])
 assert.equal(A.adventureIsOpenDay(0,-1),false); assert.equal(A.adventureIsOpenDay(3,0),false)
})
test('ticket default date, exact interval and preserved surplus time', () => {
 const four=A.ADVENTURE_TICKET_INTERVAL_TICKS, start=500n
 assert.deepEqual(A.adventureRefreshTickets({tickets:2,lastChargeTicks:null},start),{tickets:2,lastChargeTicks:start})
 assert.deepEqual(A.adventureRefreshTickets({tickets:2,lastChargeTicks:start},start+four-1n),{tickets:2,lastChargeTicks:start})
 assert.deepEqual(A.adventureRefreshTickets({tickets:2,lastChargeTicks:start},start+four*2n+99n),{tickets:4,lastChargeTicks:start+four*2n})
 assert.deepEqual(A.adventureRefreshTickets({tickets:2,lastChargeTicks:start},start-1n),{tickets:2,lastChargeTicks:start})
})
test('ticket cap loses surplus time; use starts recharge from full; insufficient use still refreshes', () => {
 const four=A.ADVENTURE_TICKET_INTERVAL_TICKS,now=1n+four*4n+99n
 assert.deepEqual(A.adventureRefreshTickets({tickets:19,lastChargeTicks:1n},now),{tickets:20,lastChargeTicks:now})
 assert.deepEqual(A.adventureUseTickets({tickets:20,lastChargeTicks:1n},3,now),{state:{tickets:17,lastChargeTicks:now},used:true})
 assert.deepEqual(A.adventureUseTickets({tickets:0,lastChargeTicks:1n},5,now),{state:{tickets:4,lastChargeTicks:1n+four*4n},used:false})
})
test('raid cumulative award boundaries from native tier constants', () => {
 assert.deepEqual([-1,0,1,10,11,20,21,30,31,40].map(R.raidStarGemReward),[0,0,25,250,270,450,460,550,555,600])
 assert.deepEqual([0,1,10,11,20,21,30,31].map(R.raidStarGemPerLevel),[0,25,25,20,20,10,10,5])
})
test('raid source entry ordering and seasonal reset preserve state in same week', () => {
 assert.equal(R.raidEntryTypeNow({freeUseCount:1,adUsed:true,iapUsed:true}),1)
 assert.equal(R.raidEntryTypeNow({freeUseCount:2,adUsed:false,iapUsed:false}),2)
 assert.equal(R.raidEntryTypeNow({freeUseCount:2,adUsed:true,iapUsed:false}),3)
 assert.equal(R.raidEntryTypeNow({freeUseCount:2,adUsed:true,iapUsed:true}),0)
 assert.deepEqual(R.raidCheckSeason({seasonIndex:5,tryCount:3,bestLevel:18},6),{seasonIndex:6,tryCount:0,bestLevel:0})
 assert.deepEqual(R.raidCheckSeason({seasonIndex:5,tryCount:3,bestLevel:18},5),{seasonIndex:5,tryCount:3,bestLevel:18})
})
test('raid float32 time crosses zero then ends on next resume; inactive does not consume time', () => {
 assert.equal(R.raidStartTimer(0),60); assert.equal(R.raidStartTimer(30),90)
 const frame=R.raidTimerFrame(0.125,true,0.25)
 assert.deepEqual(frame,{remaining:-0.125,end:false})
 assert.deepEqual(R.raidTimerFrame(frame.remaining,true,0),{remaining:-0.125,end:true})
 assert.deepEqual(R.raidTimerFrame(3,false,1),{remaining:3,end:false})
})

test('Raid HP keeps the three-digit cache separate from the two-digit result', () => {
 const fixtures=['10000000','30000000','90000000','270000000','810000000','2400000000','7200000000','21000000000','65000000000','190000000000','580000000000']
 fixtures.forEach((value,index)=>assert.ok(R.raidBossHealth(index).eq(value),`HP ${index}`))
 assert.ok(R.raidBossHealth(-2147483648).eq(fixtures[0]))
 assert.ok(R.raidBossHealth(10).eq('580000000000'))
 assert.ok(R.raidBossHealth(8).eq('65000000000')) // returning H2(7) must not feed H(8)
 assert.deepEqual(R.raidBossHealth(10000).toJSON(),{coefficient:'42',exponent:4771})
 assert.throws(()=>R.raidBossHealth(2147483647),/BigValue exponent/)
 for(const value of [NaN,Infinity,1.5,2147483648,-2147483649])assert.throws(()=>R.raidBossHealth(value),RangeError)
})
test('Raid HP finite cycle agrees with an independent decimal recurrence', () => {
 let digits=10000000n,exponent=0
 for(let index=0;index<=2000;index++) {
  const outputShift=digits.toString().length-2
  assert.deepEqual(R.raidBossHealth(index).toJSON(),{coefficient:(digits/(10n**BigInt(outputShift))).toString(),exponent:exponent+outputShift})
  digits*=3n
  const shift=digits.toString().length-3
  if(shift>0){digits/=10n**BigInt(shift);exponent+=shift}
 }
})
test('Raid PlusPack zero purchase, strict expiry and 60/70 second duration', () => {
 const purchase=100n,expires=purchase+R.RAID_PLUS_PACK_DAYS_TICKS
 assert.equal(R.raidPlusPackActive(0n,expires),false)
 assert.equal(R.raidPlusPackActive(purchase,expires-1n),true)
 assert.equal(R.raidPlusPackActive(purchase,expires),false)
 assert.equal(R.raidPlusPackActive(purchase,expires+1n),false)
 assert.equal(R.raidStartTimer(R.raidTimeBonus(false)),60)
 assert.equal(R.raidStartTimer(R.raidTimeBonus(true)),70)
})

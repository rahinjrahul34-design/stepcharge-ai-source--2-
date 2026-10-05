import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing'
import { ref, get, set, update, remove } from 'firebase/database'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = async (name, p) => {
  try { await p; pass++; console.log(`PASS  ${name}`) }
  catch (e) { fail++; console.log(`FAIL  ${name} :: ${String(e).slice(0, 140)}`) }
}

const env = await initializeTestEnvironment({
  projectId: 'stepcharge-test',
  database: { rules: readFileSync('../../firebase.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
})

// Seed the ownership allow-list with rules disabled.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.database()
  await set(ref(db, 'config/deviceOwners/ESP32-01/device-uid'), true)
  await set(ref(db, 'config/modelPublishers/trainer-uid'), true)
  await set(ref(db, 'telemetry/ESP32-01/latest'), {
    deviceId: 'ESP32-01', timestamp: '2026-10-05T10:00:00Z',
    peakVoltage: 3.4, averageVoltage: 2.1, storageVoltage: 4.2,
  })
  await set(ref(db, 'footstepEvents/ESP32-01/1760000000000'), {
    deviceId: 'ESP32-01', timestamp: '2026-10-05T10:00:00Z',
    peakVoltage: 3.4, averageVoltage: 2.1, storageVoltage: 4.2,
  })
  await set(ref(db, 'devices/ESP32-01/loads/led/actualState'), false)
})

const anon   = env.unauthenticatedContext().database()
const user   = env.authenticatedContext('user-uid').database()
const device = env.authenticatedContext('device-uid').database()
const other  = env.authenticatedContext('intruder-uid').database()
const trainer= env.authenticatedContext('trainer-uid').database()

const goodTelem = {
  deviceId: 'ESP32-01', timestamp: '2026-10-05T11:00:00Z',
  peakVoltage: 3.9, averageVoltage: 2.4, storageVoltage: 4.3,
  pulseDuration: 180, stepInterval: 1.4, footstepCount: 10,
  wifiRssi: -55, uptimeSec: 900, deviceStatus: 'ONLINE',
  firmwareVersion: '1.3.0', loadControlAvailable: true,
}

console.log('--- UNAUTHENTICATED (must all be denied) ---')
await check('anon read telemetry DENIED',  assertFails(get(ref(anon, 'telemetry/ESP32-01/latest'))))
await check('anon write telemetry DENIED', assertFails(set(ref(anon, 'telemetry/ESP32-01/latest'), goodTelem)))
await check('anon read events DENIED',     assertFails(get(ref(anon, 'footstepEvents/ESP32-01'))))
await check('anon write load cmd DENIED',  assertFails(set(ref(anon, 'devices/ESP32-01/loads/led/command'), true)))
await check('anon read dataset DENIED',    assertFails(get(ref(anon, 'dataset/samples/ESP32-01'))))

console.log('--- AUTHENTICATED USER ---')
await check('user read telemetry OK',      assertSucceeds(get(ref(user, 'telemetry/ESP32-01/latest'))))
await check('user read events OK',         assertSucceeds(get(ref(user, 'footstepEvents/ESP32-01'))))
await check('user sets load COMMAND OK',   assertSucceeds(set(ref(user, 'devices/ESP32-01/loads/led/command'), true)))
await check('user CANNOT forge actualState', assertFails(set(ref(user, 'devices/ESP32-01/loads/led/actualState'), true)))
await check('user CANNOT write telemetry', assertFails(set(ref(user, 'telemetry/ESP32-01/latest'), goodTelem)))

console.log('--- DEVICE OWNER ---')
await check('device writes telemetry OK',  assertSucceeds(set(ref(device, 'telemetry/ESP32-01/latest'), goodTelem)))
await check('device reports actualState OK', assertSucceeds(set(ref(device, 'devices/ESP32-01/loads/led/actualState'), true)))
await check('WRONG device denied',         assertFails(set(ref(other, 'telemetry/ESP32-01/latest'), goodTelem)))

console.log('--- PAYLOAD VALIDATION ---')
await check('999 V rejected',              assertFails(set(ref(device, 'telemetry/ESP32-01/latest'), { ...goodTelem, peakVoltage: 999 })))
await check('negative voltage rejected',   assertFails(set(ref(device, 'telemetry/ESP32-01/latest'), { ...goodTelem, storageVoltage: -1 })))
await check('deviceId mismatch rejected',  assertFails(set(ref(device, 'telemetry/ESP32-01/latest'), { ...goodTelem, deviceId: 'OTHER' })))
await check('missing fields rejected',     assertFails(set(ref(device, 'telemetry/ESP32-01/latest'), { deviceId: 'ESP32-01' })))
await check('bad RSSI rejected',           assertFails(set(ref(device, 'telemetry/ESP32-01/latest'), { ...goodTelem, wifiRssi: 50 })))
await check('non-boolean load cmd rejected', assertFails(set(ref(user, 'devices/ESP32-01/loads/led/command'), 'ON')))
await check('unknown load key rejected',   assertFails(set(ref(user, 'devices/ESP32-01/loads/heater/command'), true)))

console.log('--- APPEND-ONLY HISTORY ---')
await check('device appends new event OK', assertSucceeds(set(ref(device, 'footstepEvents/ESP32-01/1760000009999'), { deviceId:'ESP32-01', timestamp:'2026-10-05T11:00:00Z', peakVoltage:3.1, averageVoltage:2.0, storageVoltage:4.1 })))
await check('OVERWRITE existing event DENIED', assertFails(set(ref(device, 'footstepEvents/ESP32-01/1760000000000'), { deviceId:'ESP32-01', timestamp:'x', peakVoltage:1, averageVoltage:1, storageVoltage:1 })))
await check('DELETE event DENIED',         assertFails(remove(ref(device, 'footstepEvents/ESP32-01/1760000000000'))))
await check('non-epoch event key rejected', assertFails(set(ref(device, 'footstepEvents/ESP32-01/abc'), { deviceId:'ESP32-01', timestamp:'x', peakVoltage:1, averageVoltage:1, storageVoltage:1 })))

console.log('--- DATASET ---')
const goodSample = { id:'s1', timestamp:'2026-10-05T10:00:00Z', deviceId:'ESP32-01', label:'NORMAL', source:'live', participantId:'P1',
  features:{ peakVoltage:3.3, averageVoltage:2.1, pulseDuration:190, stepInterval:1.8, storageVoltage:4.2 } }
await check('user writes dataset sample OK', assertSucceeds(set(ref(user, 'dataset/samples/ESP32-01/s1'), goodSample)))
await check('invalid label rejected',      assertFails(set(ref(user, 'dataset/samples/ESP32-01/s2'), { ...goodSample, id:'s2', label:'MEDIUM' })))
await check('missing features rejected',   assertFails(set(ref(user, 'dataset/samples/ESP32-01/s3'), { ...goodSample, id:'s3', features:{ peakVoltage:1 } })))
await check('mismatched sample id rejected', assertFails(set(ref(user, 'dataset/samples/ESP32-01/s4'), { ...goodSample, id:'WRONG' })))

console.log('--- CONFIG / MODEL ---')
await check('user CANNOT write config',    assertFails(set(ref(user, 'config/deviceOwners/ESP32-01/intruder-uid'), true)))
await check('device CANNOT write config',  assertFails(set(ref(device, 'config/deviceOwners/ESP32-01/device-uid2'), true)))
await check('non-publisher CANNOT write modelMetadata', assertFails(set(ref(user, 'modelMetadata'), { modelName:'x' })))
await check('publisher writes modelMetadata OK', assertSucceeds(set(ref(trainer, 'modelMetadata'), { modelName:'Random Forest', version:'v1' })))

console.log('--- UNDECLARED PATHS ---')
await check('write to random root path DENIED', assertFails(set(ref(user, 'somethingElse/x'), 1)))

await env.cleanup()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

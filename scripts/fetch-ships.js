#!/usr/bin/env node
// Connects to AISstream WebSocket, collects vessel data for COLLECT_MS,
// writes a snapshot to /tmp/ships.json. Run via GitHub Actions.
// Requires env var AIS_KEY.

import { WebSocket } from 'ws'
import { writeFileSync } from 'fs'

const WS_URL    = 'wss://stream.aisstream.io/v0/stream'
const COLLECT_MS = 4 * 60 * 1000   // 4 minutes
const OUT_FILE  = '/tmp/ships.json'

const apiKey = process.env.AIS_KEY
if (!apiKey) { console.error('Missing AIS_KEY env var'); process.exit(1) }

const vessels = new Map()   // mmsi → { mmsi, lat, lon, name, shipType, sog }

const ws = new WebSocket(WS_URL)

ws.on('open', () => {
  console.log('[fetch-ships] connected')
  ws.send(JSON.stringify({
    APIKey: apiKey,
    BoundingBoxes: [[[-90, -180], [90, 180]]],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
  }))
  setTimeout(() => {
    ws.close()
    const snapshot = {
      generated: new Date().toISOString(),
      vessels:   [...vessels.values()].filter(v => v.lat != null && v.lon != null),
    }
    writeFileSync(OUT_FILE, JSON.stringify(snapshot))
    console.log(`[fetch-ships] wrote ${snapshot.vessels.length} vessels → ${OUT_FILE}`)
    process.exit(0)
  }, COLLECT_MS)
})

ws.on('message', data => {
  try {
    const msg  = JSON.parse(data.toString())
    const meta = msg.MetaData
    if (!meta?.MMSI) return
    const mmsi    = meta.MMSI
    const existing = vessels.get(mmsi) ?? {}

    if (msg.MessageType === 'ShipStaticData') {
      const s = msg.Message?.ShipStaticData
      if (!s) return
      vessels.set(mmsi, {
        ...existing,
        mmsi,
        name:     s.Name?.trim() || meta.ShipName?.trim() || existing.name || null,
        shipType: s.Type ?? existing.shipType ?? 0,
        lat:      existing.lat ?? null,
        lon:      existing.lon ?? null,
      })
    } else {
      if (meta.latitude == null) return
      vessels.set(mmsi, {
        ...existing,
        mmsi,
        lat:      meta.latitude,
        lon:      meta.longitude,
        name:     meta.ShipName?.trim() || existing.name || null,
        sog:      msg.Message?.PositionReport?.Sog ?? null,
        shipType: existing.shipType ?? 0,
      })
    }
  } catch { /* skip malformed frames */ }
})

ws.on('error', e => { console.error('[fetch-ships] error', e.message); process.exit(1) })

ws.on('unexpected-response', (_req, res) => {
  console.error(`[fetch-ships] unexpected HTTP response: ${res.statusCode}`)
  process.exit(1)
})

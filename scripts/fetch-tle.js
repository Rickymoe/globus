#!/usr/bin/env node
// Fetches all Starlink TLE data from tle.ivanstanojevic.me and writes
// data/starlinks.json — run via GitHub Actions or manually: node scripts/fetch-tle.js

import { createWriteStream, mkdirSync, statSync, writeFileSync } from 'fs'
import { get }  from 'https'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE_URL  = 'https://tle.ivanstanojevic.me/api/tle/?search=STARLINK&page-size=100'
const OUT_FILE  = join(__dirname, '..', 'data', 'starlinks.json')
const BATCH     = 10
const DELAY_MS  = 300

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = get(url, { headers: { 'User-Agent': 'globus-tle-updater/1.0' } }, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

const first  = await fetchJson(`${BASE_URL}&page=1`)
const total  = first.totalItems
const pages  = Math.ceil(total / 100)
console.log(`Total: ${total} satellites (${pages} pages)`)

const members = [...first.member]

for (let start = 2; start <= pages; start += BATCH) {
  const end   = Math.min(start + BATCH - 1, pages)
  const batch = []
  for (let p = start; p <= end; p++) batch.push(fetchJson(`${BASE_URL}&page=${p}`))

  const results = await Promise.allSettled(batch)
  for (const r of results) {
    if (r.status === 'fulfilled') members.push(...r.value.member)
    else console.warn('Page failed:', r.reason?.message)
  }
  process.stdout.write(`\r  ${members.length} / ${total}…`)
  if (end < pages) await sleep(DELAY_MS)
}

console.log(`\nFetched ${members.length} TLEs`)

const output = {
  updated: new Date().toISOString(),
  count:   members.length,
  member:  members.map(s => ({ name: s.name, line1: s.line1, line2: s.line2 })),
}

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(output))
console.log(`Saved → ${OUT_FILE} (${(statSync(OUT_FILE).size / 1024).toFixed(0)} KB)`)

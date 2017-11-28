'use strict'

const fs = require('fs')
const path = require('path')
const sprom = require('sprom')
const BRS = require('../src')

const fixturePath = path.join(__dirname, 'fixtures', 'text.txt')

const chunksFromStream = brs => {
  // Shouldn't make these kind of horrible assumptions on binary/text, headers etc.
  // But this is tests. Controlled environment etc.
  const contentType = brs.getHeaders()['Content-Type']
  const boundary = contentType.slice(contentType.indexOf('boundary=') + 9)

  return sprom.buf(brs).then(buffer => {
    const content = buffer.toString()

    const chunks = content
      .split(boundary)
      .map(part => part.replace(/^-+/, '').trim())
      .map(part => part.split('\r\n\r\n')[1])
      .filter(Boolean)

    return chunks
  })
}

const without = (obj, prop) =>
  Object.keys(obj)
    .filter(key => key !== prop)
    .reduce((acc, key) => Object.assign(acc, {[key]: obj[key]}), {})

const options = {
  range: 'bytes=0-17',
  getChunk: range => fs.createReadStream(fixturePath, range),
  totalSize: fs.statSync(fixturePath).size
}

const omitOption = prop => without(options, prop)
const addOption = (prop, value) => Object.assign({}, options, {[prop]: value})

test('throws on missing/invalid `range`', () => {
  expect(() => new BRS()).toThrowErrorMatchingSnapshot()
  expect(() => new BRS(omitOption('range'))).toThrowErrorMatchingSnapshot()
  expect(() => new BRS(addOption('range', null))).toThrowErrorMatchingSnapshot()
})

test('throws on missing/invalid `getChunk`', () => {
  expect(() => new BRS(omitOption('getChunk'))).toThrowErrorMatchingSnapshot()
  expect(() => new BRS(addOption('getChunk', 'moo'))).toThrowErrorMatchingSnapshot()
})

test('throws on missing/invalid `totalSize`', () => {
  expect(() => new BRS(omitOption('totalSize'))).toThrowErrorMatchingSnapshot()
  expect(() => new BRS(addOption('totalSize', 'moo'))).toThrowErrorMatchingSnapshot()
})

test('throws on invalid `contentType`', () => {
  expect(() => new BRS(addOption('contentType', 123))).toThrowErrorMatchingSnapshot()
})

test('can instantiate without `new`', () => {
  expect(BRS(options)).toBeInstanceOf(BRS)
})

test('serializes to object of type ByteRangeStream', () => {
  expect(`${new BRS(options)}`).toBe('[object ByteRangeStream]')
})

test('flagged as invalid on unsupported range', () => {
  expect(BRS(addOption('range', 'page=0-5')).isValid()).toBe(false)
})

test('flagged as invalid on unsatisfiable range', () => {
  expect(BRS(addOption('range', 'bytes=500000-500005')).isSatisfiable()).toBe(false)
})

test('returns valid headers', () => {
  const headers = BRS(options).getHeaders()
  expect(headers).toHaveProperty('Content-Length', 199)
  expect(headers['Content-Type']).toMatch(
    /^multipart\/byteranges; boundary=--------------------------\d+$/
  )
})

test('returns valid headers on multiple chunks', () => {
  const headers = BRS(addOption('range', 'bytes=0-5, 5-10')).getHeaders()
  expect(headers).toHaveProperty('Content-Length', 319)
  expect(headers['Content-Type']).toMatch(
    /^multipart\/byteranges; boundary=--------------------------\d+$/
  )
})

test('returns valid number of chunks on single chunk', () => {
  expect(BRS(options).getChunkCount()).toEqual(1)
})

test('returns valid number of chunks on multiple chunks', () => {
  expect(BRS(addOption('range', 'bytes=0-5, 5-10,15-30')).getChunkCount()).toEqual(3)
})

test('streams correct chunk on single chunk', () => {
  chunksFromStream(BRS(options)).then(chunks => {
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('The "Range" header')
  })
})

test('streams correct chunk on multiple chunks', () => {
  chunksFromStream(BRS(addOption('range', 'bytes=0-17, 1976-1984'))).then(chunks => {
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toBe('The "Range" header')
    expect(chunks[1]).toBe('[RFC7232]')
  })
})

test('streams correct chunk on open-ended range', () => {
  chunksFromStream(BRS(addOption('range', 'bytes=2156-'))).then(chunks => {
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('(Not Modified) response.')
  })
})

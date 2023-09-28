'use strict'

const util = require('util')
const CombinedStream = require('combined-stream')
const parseRange = require('range-parser')

// Public API
module.exports = ByteRangeStream

// make it a Stream
util.inherits(ByteRangeStream, CombinedStream)

/**
 * Create readable "multipart/byteranges" streams.
 * Can be used to handle `Range`-requests
 *
 * @constructor
 * @param {Object} options - Properties to be added/overriden for ByteRangeStream and CombinedStream
 */
function ByteRangeStream(options) {
  if (!(this instanceof ByteRangeStream)) {
    return new ByteRangeStream(options)
  }

  validateOptions(options)

  this._isValid = true
  this._isSatisfiable = true
  this._overheadLength = 0
  this._valueLength = 0
  this._options = {}
  this._numChunks = 0
  this._ranges = null

  CombinedStream.call(this)

  for (const option in options) {
    this._options[option] = options[option]
  }

  this._ranges = parseRange(options.totalSize, options.range)
  if (!Array.isArray(this._ranges)) {
    this._isSatisfiable = false
    this._isValid = this._ranges !== -2
    return this
  }

  if (this._ranges.type !== 'bytes') {
    this._isValid = false
    return this
  }

  const lastIndex = this._ranges.length - 1
  this._ranges.forEach((range, i) => {
    const isLast = i === lastIndex
    this._numChunks++
    this._append(range, next => Promise.resolve(this._options.getChunk(range)).then(next), isLast)
  })

  return this
}

ByteRangeStream.LINE_BREAK = '\r\n'
ByteRangeStream.DEFAULT_CONTENT_TYPE = 'application/octet-stream'

ByteRangeStream.prototype.isValid = function() {
  return this._isValid
}

ByteRangeStream.prototype.isSatisfiable = function() {
  return this._isSatisfiable
}

ByteRangeStream.prototype.getRanges = function() {
  return this._ranges
}

ByteRangeStream.prototype.getHeaders = function() {
  return {
    'Content-Type': `multipart/byteranges; boundary=${this.getBoundary()}`,
    'Content-Length': this.getLength()
  }
}

ByteRangeStream.prototype.getBoundary = function() {
  if (!this._boundary) {
    this._generateBoundary()
  }

  return this._boundary
}

ByteRangeStream.prototype.getChunkCount = function() {
  return this._numChunks
}

ByteRangeStream.prototype.getLength = function() {
  let knownLength = this._overheadLength + this._valueLength

  if (this._numChunks > 0) {
    knownLength += this._lastBoundary().length
  }

  return knownLength
}

ByteRangeStream.prototype.toString = function() {
  return '[object ByteRangeStream]'
}

// ==================================
// ===        INTERNALS           ===
// ==================================

ByteRangeStream.prototype._generateBoundary = function() {
  // This generates a 50 character boundary similar to those used by Firefox.
  // They are optimized for boyer-moore parsing.
  let boundary = '--------------------------'
  for (let i = 0; i < 24; i++) {
    boundary += Math.floor(Math.random() * 10).toString(16)
  }

  this._boundary = boundary
}

ByteRangeStream.prototype._append = function(range, stream, isLast) {
  const append = CombinedStream.prototype.append.bind(this)

  const header = this._multiPartHeader(range, stream)
  const footer = this._multiPartFooter(isLast)

  append(header)
  append(stream)
  append(footer)

  this._trackLength(header, range)
}

ByteRangeStream.prototype._trackLength = function(header, range) {
  this._valueLength += range.end - range.start + 1
  this._overheadLength += Buffer.byteLength(header) + ByteRangeStream.LINE_BREAK.length
}

ByteRangeStream.prototype._multiPartHeader = function(range, stream) {
  const contentType = this._options.contentType || ByteRangeStream.DEFAULT_CONTENT_TYPE
  const contentRange = contentRangeString('bytes', this._options.totalSize, range)
  const contents = [`Content-Type: ${contentType}`, `Content-Range: ${contentRange}`].join(
    ByteRangeStream.LINE_BREAK
  )

  return [
    '',
    this.getBoundary(),
    ByteRangeStream.LINE_BREAK,
    contents,
    ByteRangeStream.LINE_BREAK,
    ByteRangeStream.LINE_BREAK
  ].join('')
}

ByteRangeStream.prototype._multiPartFooter = function(isLast) {
  let footer = ByteRangeStream.LINE_BREAK

  if (isLast) {
    footer += this._lastBoundary()
  }

  return footer
}

ByteRangeStream.prototype._lastBoundary = function() {
  return [this.getBoundary(), '--', ByteRangeStream.LINE_BREAK].join('')
}

function validateOptions(opts) {
  const options = opts || {}

  if (typeof options.range !== 'string') {
    throw new Error('`range` must be a string')
  }

  if (typeof options.getChunk !== 'function') {
    throw new Error('`getChunk` must be a function')
  }

  if (typeof options.totalSize !== 'number') {
    throw new Error('`totalSize` must be a number')
  }

  if (options.contentType && typeof options.contentType !== 'string') {
    throw new Error('`contentType` must be a string')
  }
}

function contentRangeString(type, size, range) {
  return `${type} ${range.start}-${range.end}/${size}`
}

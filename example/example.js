const fs = require('fs')
const path = require('path')
const pump = require('pump')
const ByteRangeStream = require('../') // require('byte-ranges')
const express = require('express')
const app = express()

const filePath = path.join(__dirname, 'example.js')
const totalSize = fs.statSync(filePath).size

function getChunk(start, end) {
  return fs.createReadStream(filePath, {start, end})
}

app.get('/somefile.txt', (req, res) => {
  // Flag that we accept range requests
  res.set('Accept-Ranges', 'bytes')

  // Create a new byte-range stream
  const byteStream = new ByteRangeStream({
    range: req.headers.range || '',
    getChunk,
    totalSize,
    contentType: 'text/javascript',
  })

  // If the client didn't specify a range or the range header was invalid, stream the entire file
  if (!byteStream.isValid()) {
    pump(fs.createReadStream(filePath), res)
    return
  }

  // If the byte stream is not satisfiable (out of range etc), return a 416
  if (!byteStream.isSatisfiable()) {
    res.status(416).set('Content-Range', contentRange('bytes', totalSize)).end()
    return
  }

  // If a range was specified, indicate this is a partial response
  res.status(206)

  // We need to set some headers to indicate the boundary and content type
  res.set(byteStream.getHeaders())

  // Now stream the response to the HTTP response stream
  pump(byteStream, res)
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})

function contentRange(type, size, range) {
  const start = range ? `${range.start}-${range.end}` : '*'
  return `${type} ${start}/${size}`
}

# byte-range-stream

[![npm version](http://img.shields.io/npm/v/byte-range-stream.svg?style=flat-square)](http://browsenpm.org/package/byte-range-stream)[![Build Status](http://img.shields.io/travis/rexxars/byte-range-stream/master.svg?style=flat-square)](https://travis-ci.org/rexxars/byte-range-stream)

Create a multipart/byteranges stream based on passed ranges.

Code heavily inspired by [form-data](https://github.com/form-data/form-data)

## Installation

```
npm install --save byte-range-stream
```

## Usage

```js
const fs = require('fs')
const path = require('path')
const ByteRangeStream = require('byte-range-stream')

const filePath = path.join(__dirname, 'example.js')
const totalSize = fs.statSync(filePath).size
const getChunk = range => fs.createReadStream(filePath, {start: range.start, end: range.end})

const byteStream = new ByteRangeStream({
  range: 'bytes=0-100',
  getChunk,
  totalSize,
  contentType: 'text/javascript'
})

// Invalid could mean unsupported range type (only "bytes" is supported)
// or incorrect syntax
if (!byteStream.isValid()) {
  console.log('Invalid')
}

// Unsatisfiable could mean out of range
if (!byteStream.isSatisfiable()) {
  console.log('Unsatisfiable')
}

// You will need the generated boundary for the multipart response,
// as well as content length
const headers = byteStream.getHeaders()

process.stdout.write('206 Partial Content\n\n')
for (const header in headers) {
  process.stdout.write(`${header}: ${headers[header]}\n`)
}

process.stdout.write('\n')
byteStream.pipe(process.stdout)
```

## License

MIT © [Espen Hovlandsdal](https://espen.codes/)

import CombinedStream from 'combined-stream'

type Appendable = NodeJS.ReadableStream | NodeJS.WritableStream | Buffer | string

interface ByteRangeStreamOptions {
  range: string
  getChunk: (range: {start: number; end: number}) => Appendable | Promise<Appendable>
  totalSize: number
  contentType?: string
}

declare class ByteRangeStream extends CombinedStream {
  LINE_BREAK: '\r\n'
  DEFAULT_CONTENT_TYPE: 'application/octet-stream'

  constructor(options: ByteRangeStreamOptions)

  isValid(): boolean
  isSatisfiable(): boolean

  getLength(): number
  getBoundary(): string
  getChunkCount(): number
  getRanges(): {
    start: number
    end: number
  }[]
  getHeaders(): {
    'Content-Type': string
    'Content-Length': string
  }

  toString(): '[object ByteRangeStream]'
}

export = ByteRangeStream

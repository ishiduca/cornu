var xtend = require('xtend')
var trumpet = require('trumpet')
var { htmlToText: toText } = require('html-to-text')
var { BufferListStream } = require('bl')
var { pipe, duplex, through, concat } = require('mississippi')

module.exports = Cornu

function Cornu (options) {
  if (!(this instanceof Cornu)) return new Cornu(options)
  options = xtend(options)

  this.sanitizeHtml = options.sanitizeHtml || require('sanitize-html')
  var allowedTags = this.sanitizeHtml.defaults.allowedTags.concat('img')
  var allowedAttributes = xtend(
    this.sanitizeHtml.defaults.allowedAttributes,
    { img: [ 'src', 'data-src' ] }
  )
  this.sanitizeHtmlOption = (
    options.sanitizeHtmlOption ||
    xtend(this.sanitizeHtml.defaults, { allowedTags, allowedAttributes })
  )

  this.toText = options.toText || toText
}

Cornu.prototype.createStream = function (config) {
  var snk = trumpet()
  var src = through.obj()
  var props = Object.keys(config)
  var i = 0
  var mid = through.obj()
  mid.setMaxListeners(0)
  mid.on('pipe', () => (i += 1))
  mid.on('unpipe', () => {
    if ((i -= 1) === 0 && snk._readableState.ended) mid.end()
  })
  snk.once('end', () => {
    if (i === 0 && !mid._readableState.ended) mid.end()
  })

  pipe(
    mid,
    concat(o => src.end(o.reduce((a, b) => xtend(a, b), {}))),
    error => error != null && src.emit('error', error)
  )

  props.forEach(p => {
    if (typeof config[p] === 'string') {
      getConfigValue({ [p]: config[p] }).pipe(mid, { end: false })
      return
    }

    var { selector } = config[p]
    if (Array.isArray(selector)) {
      var x = xtend(config[p], { selector: selector[0] })
      snk
        .pipe(this.selectAll(x))
        .pipe(through.obj((data, _, done) => done(null, { [p]: data })))
        .pipe(mid, { end: false })
    } else if (selector && typeof selector === 'string') {
      snk
        .pipe(this.select(config[p]))
        .pipe(through.obj((data, _, done) => done(null, { [p]: data })))
        .pipe(mid, { end: false })
    }
  })

  return duplex.obj(snk, src)
}

Cornu.prototype.select = function (config) {
  var snk = trumpet()
  var src = through.obj()

  var { selector, get, properties } = config
  var node = snk.select(selector)

  if (toString(properties) === '[object Object]') {
    node.createReadStream()
      .pipe(this.createStream(config.properties))
      .pipe(src)
  } else if (typeof get === 'function') {
    getFunc(node, get).pipe(src)
  } else if (get === 'text') {
    getText(node, this.toText).pipe(src)
  } else if (get === 'html') {
    getHTML(node, this.sanitizeHtml, this.sanitizeHtmlOption).pipe(src)
  } else if (get != null && get.slice(0, 1) === '@') {
    getAttributeValue(node, get.slice(1)).pipe(src)
  }

  return duplex.obj(snk, src)
}

Cornu.prototype.selectAll = function (config) {
  var snk = trumpet()
  var src = through.obj()
  var i = 0
  var mid = through.obj()
  mid.setMaxListeners(0)
  mid.on('pipe', () => (i += 1))
  mid.on('unpipe', () => {
    if ((i -= 1) === 0 && snk._readableState.ended) mid.end()
  })
  snk.once('end', () => {
    if (i === 0 && !mid._readableState.ended) mid.end()
  })
  pipe(
    mid,
    concat(x => src.end(x)),
    error => error != null && src.emit('error', error)
  )

  var { selector, get, properties } = config

  snk.selectAll(selector, node => {
    if (toString(properties) === '[object Object]') {
      node.createReadStream()
        .pipe(this.createStream(config.properties))
        .pipe(mid, { end: false })
    } else if (typeof get === 'function') {
      getFunc(node, get).pipe(mid, { end: false })
    } else if (get === 'text') {
      getText(node, this.toText).pipe(mid, { end: false })
    } else if (get === 'html') {
      getHTML(node, this.sanitizeHtml, this.sanitizeHtmlOption)
        .pipe(mid, { end: false })
    } else if (get.slice(0, 1) === '@') {
      getAttributeValue(node, get.slice(1)).pipe(mid, { end: false })
    }
  })

  return duplex.obj(snk, src)
}

function getFunc (node, f) {
  var s = through.obj()
  f(node, (error, result) => {
    error != null
      ? s.emit('error', error)
      : s.end(result)
  })
  return s
}

function getAttributeValue (node, attName) {
  var s = through.obj()
  node.getAttribute(attName, val => s.end(val))
  return s
}

function getText (node, _toText) {
  var s = through.obj()
  node.createReadStream().pipe(BufferListStream((error, buf) => {
    error != null
      ? s.emit('error', error)
      : s.end(_toText(String(buf)))
  }))
  return s
}

function getHTML (node, _sanitizeHtml, _sanitizeHtmlOption) {
  var s = through.obj()
  node.createReadStream().pipe(BufferListStream((error, buf) => {
    error != null
      ? s.emit('error', error)
      : s.end(_sanitizeHtml(String(buf).replace(/\s*\n\s*/g, '').replace(/\s*\n\s*/g, ''), _sanitizeHtmlOption))
  }))
  return s
}

function getConfigValue (value) {
  var s = through.obj()
  process.nextTick(() => s.end(value))
  return s
}

function toString (v) {
  return Object.prototype.toString.apply(v)
}

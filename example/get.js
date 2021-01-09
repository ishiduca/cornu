var fs = require('fs')
var path = require('path')
var { pipe, through } = require('mississippi')
var config = require('./new-sale-today')
var Cornu = require('../cornu')
var cornu = new Cornu()
var html = path.join(__dirname, './new-sale-today.html')

var { home_page_url } = config
var { url } = config.items.properties
url.get = (node, done) => {
  node.getAttribute('href', href => {
    done(null, String(new URL(href, home_page_url)))
  })
}

start()

function start () {
  pipe(
    fs.createReadStream(html),
    cornu.createStream(config),
    through.obj((data, _, done) => {
      console.log(JSON.stringify(data))
      done()
    }),
    error => {
      if (error) return console.error(error)
      console.log(JSON.stringify({ cornuEnded: true }))
    }
  )
}

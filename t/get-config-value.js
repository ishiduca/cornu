var test = require('tape')
var fs = require('fs')
var path = require('path')
var { pipe, concat, through } = require('mississippi')
var Cornu = require('../cornu')

test('get value from config', t => {
  var version = 'https://jsonfeed.org/version/1.1'
  var config = { version }
  var html = '<p>hello cornu</p>'
  var expected = [ { version } ]

  var c = new Cornu()
  var src = through()

  pipe(
    src,
    c.createStream(config),
    concat(result => {
      t.deepEqual(result, expected, JSON.stringify(result))
    }),
    error => {
      t.error(error, 'no error')
      t.end()
    }
  )

  src.end(html)
})

test('get value from html', t => {
  var config = {
    first: {
      selector: 'li:first-child',
      get: 'text'
    },
    last: {
      selector: 'li:nth-child(3)',
      get: 'html'
    },
    link: {
      selector: 'li a',
      get: '@href'
    }
  }

  var html = `<div>
    <ul>
      <li>one</li>
      <li><a href="/two">two</a></li>
      <li><a>three</a></li>
    </ul>
  </div>`

  var expected = [ {
    first: 'one',
    last: '<a>three</a>',
    link: '/two'
  } ]

  var c = new Cornu()
  var src = through()

  pipe(
    src,
    c.createStream(config),
    concat(result => {
      t.deepEqual(result, expected, JSON.stringify(result))
    }),
    error => {
      t.error(error, 'no error')
      t.end()
    }
  )
  src.end(html)
})

test('nest', t => {
  var config = {
    image: {
      selector: 'figure',
      properties: {
        link: {
          selector: 'img',
          get: '@src'
        },
        title: {
          selector: 'img',
          get: '@alt'
        }
      }
    }
  }

  var html = `<div>
    <img src="/dummy.jpg" alt="dummy" />
    <figure>
      <img src="/bingo.png" alt="BINGO" />
    </figure>
  </div>`

  var expected = [
    {
      image: {
        link: '/bingo.png',
        title: 'BINGO'
      }
    }
  ]

  var c = new Cornu()
  var src = through()

  pipe(
    src,
    c.createStream(config),
    concat(result => {
      t.deepEqual(result, expected, JSON.stringify(result))
    }),
    error => {
      t.error(error, 'no error')
      t.end()
    }
  )
  src.end(html)
})

test('', t => {
  var html = path.join(__dirname, 'news.html')
  var config = require('./config-news')
  var expected = require('./expected-news')
  var c = new Cornu()

  config.items.properties.url.get = (node, done) => {
    node.getAttribute('href', href => {
      done(null, String(new URL(href, config.home_page_url)))
    })
  }

  pipe(
    fs.createReadStream(html),
    c.createStream(config),
    concat(result => {
      var itemsTitles = result[0].items.map(i => i.title)
      t.deepEqual(result, expected, JSON.stringify(itemsTitles))
    }),
    error => {
      t.error(error, 'no error')
      t.end()
    }
  )
})

module.exports = (href, home, done) => {
  try {
    done(null, String(new URL(href, home)))
  } catch (error) {
    return done(error)
  }
}

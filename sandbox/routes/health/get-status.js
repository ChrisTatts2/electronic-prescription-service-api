module.exports = [
  {
    method: 'GET',
    path: '/_status',
    handler: (request, h) => {
      return h.response("EPS is alive")
    }
  }
]

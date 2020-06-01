const path = require('path')

const get = (obj, path) =>
  path.split('.').reduce((xs, x) => (xs && xs[x] ? xs[x] : null), obj)

const makeOutputPath = (filename, ext) =>
  path.join(__dirname, '../../', 'reports', 'autocannon', filename + ext)

const firstKey = (obj) => Object.keys(obj).pop()

const isObject = (item) =>
  typeof item === 'object' && !Array.isArray(item) && item !== null

// Parses Autocannon body responses by finding beginning and end brackets in text
function parseBody(body) {
  try {
    const bodyString = body.toString()
    console.log('BODY STRING', bodyString)
    const firstBracket = bodyString.indexOf('{')
    const lastBracket = bodyString.lastIndexOf('}')
    const jsonText = bodyString.substring(firstBracket, lastBracket + 1)
    const bodyJson = JSON.parse(jsonText)
    return bodyJson
  } catch (err) {}
}

const COLORS = {
  FG_YELLOW: '\x1b[33m',
  FG_CYAN: '\x1b[36m',
  RESET: '\x1b[0m',
}

const assertionFailureMap = new Map()
// Assert response data matches
const assertResponse = (entry) => (client) => {
  const expectedResults = get(entry, 'assert.results')
  client.on('body', (body) => {
    try {
      const bodyJson = parseBody(body)
      const key = firstKey(bodyJson.data)
      const data = bodyJson.data[key]
      // Assert response is an object if results "1" expected
      // Else assert response length matches expected length
      let trueLength
      if (isObject(data) && data.errors != true) trueLength = 1
      else if (data.length) trueLength = data.length
      else trueLength = 0
      // Log the error the first time
      if (
        trueLength != expectedResults &&
        !assertionFailureMap.has(entry.name)
      ) {
        assertionFailureMap.set(entry.name, true)
        console.log(
          COLORS.FG_YELLOW,
          '\n[WARNING]:',
          COLORS.RESET,
          'Failed result length assertion for query',
          entry.name
        )
        console.log(
          COLORS.FG_CYAN,
          '[INFO]:',
          COLORS.RESET,
          'Wanted',
          expectedResults,
          'results, got',
          trueLength
        )
      }
    } catch (err) {}
  })
}

module.exports = {
  makeOutputPath,
  assertResponse,
}

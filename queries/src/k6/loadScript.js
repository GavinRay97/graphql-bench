import http from 'k6/http'
import { check } from 'k6'

// Parse config passed in from wrapper script
const config = JSON.parse(__ENV.CONFIG)

const isObject = (item) =>
  typeof item === 'object' && !Array.isArray(item) && item !== null

export default function () {
  // Prepare query & variables (if provided)
  let body = JSON.stringify({
    query: config.query,
    variables: config.variables,
  })

  // Send the request
  let res = http.post(config.url, body, {
    headers: config.headers,
  })

  // Configure assertions
  const assertions = {
    'is status 200': (r) => r.status === 200,
    'no error in body': (r) => Boolean(r.json('errors')) == false,
  }

  // Add result count assertion if set
  if (config.assertResults) {
    Object.assign(assertions, {
      'result count matches': (r) => {
        // Grab first key of data
        // Using GSON selector helpers from k6
        const data = r.json('data.*')
        // If only expecting a single result, assert it's an object
        // Else assert the length of results array matches
        if (config.assertResults == 1) return isObject(data)
        else return data.length == config.assertResults
      },
    })
  }

  // Run assertions on status, errors in body, optionally results count
  check(res, assertions)
}

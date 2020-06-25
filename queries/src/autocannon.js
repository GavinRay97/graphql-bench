const autocannon = require('autocannon')
const reporter = require('autocannon-reporter')
const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')
const { makeOutputPath, assertResponse } = require('./utils')

const makeOptions = (entry, config) => {
  // If assert.response set in YAML config, set up the validator function here
  const assertionHandler = assertResponse(entry)
  // Return entry and config in options for context in case need to reference
  return {
    entry,
    config,
    autocannonOpts: {
      url: config.url,
      method: 'POST',
      headers: config.headers,
      duration: entry.duration,
      body: JSON.stringify({ query: entry.query, variables: entry.variables }),
      overallRate: entry.rps,
      // setupClient: assertionHandler,
    },
  }
}

function runBenchmark({ entry, config, autocannonOpts }) {
  return new Promise((resolve, reject) => {
    const reportOutputPath = makeOutputPath(entry.name, '.html')
    const statsOutputPath = makeOutputPath(entry.name, '.json')
    const instance = autocannon(autocannonOpts, (err, results) => {
      if (err) throw err
      fs.writeFileSync(statsOutputPath, JSON.stringify(results, null, 2))
      const report = reporter.buildReport(results)
      reporter.writeReport(report, reportOutputPath, (err, res) => {
        if (err) console.error('Error writting report: ', err)
        else console.log('Report written to: ', reportOutputPath)
      })
    })
    autocannon.track(instance)
    instance.on('done', resolve)
    if (entry.rps) console.log(entry.rps, 'req/s')
  })
}

async function main() {
  const configFile = path.join(__dirname, '../', 'config.yaml')
  const config = yaml.load(fs.readFileSync(configFile))
  const benchmarks = config.queries.map((entry) => makeOptions(entry, config))
  for (let benchmark of benchmarks) await runBenchmark(benchmark)
}

main()

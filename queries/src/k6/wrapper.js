const cp = require('child_process')
const yaml = require('js-yaml')
const path = require('path')
const fs = require('fs')

const filePath = path.join(__dirname, '../../', 'config.yaml')
const fileText = fs.readFileSync(filePath, 'utf-8')
const config = yaml.load(fileText)
const k6Path = path.join(__dirname, 'k6')
const reportPath = path.join(__dirname, '../../../', 'reports', 'k6')

const makeK6Config = (config, queryOpts) => ({
  url: config.url,
  headers: config.headers,
  rps: queryOpts.rps,
  duration: queryOpts.duration,
  name: queryOpts.name,
  query: queryOpts.query,
  variables: queryOpts.variables,
  assertResults: queryOpts.assert && queryOpts.assert.results,
})

function runK6(config) {
  return new Promise((resolve, reject) => {
    const outfile = `${config.name}_${config.rps}rps.json`
    const outPath = path.join(reportPath, outfile)
    const scriptFile = path.join(__dirname, 'loadScript.js')
    const baseOpts = ['run', scriptFile]

    baseOpts.push('-e', `CONFIG=${JSON.stringify(config)}`)
    baseOpts.push('--summary-export', outPath)
    baseOpts.push('--rps', config.rps)
    baseOpts.push('--duration', config.duration)

    const k6 = cp.spawn(k6Path, baseOpts, {
      cwd: __dirname,
      detached: true,
      stdio: 'inherit',
    })

    k6.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
      const output = fs.readFileSync(outPath, 'utf-8')
      const jsonStats = JSON.parse(output)
      resolve(jsonStats)
    })
  })
}

// Formats K6 output stats collected during runs into Chart.js input data
// Uses "metrics.iteration_duration" which contains avg, min, max, p90, p95
function writeChartJSData(results, path) {
  const chartjsData = Object.entries(results).map(([query, data]) => {
    const requestData = Object.values(data.metrics.iteration_duration)
    return { label: query, data: requestData }
  })
  fs.writeFileSync(path, JSON.stringify(chartjsData, null, 2))
}

async function main() {
  const k6Configs = config.queries.map((query) => makeK6Config(config, query))

  let results = {}
  for (let k6Config of k6Configs) {
    const stats = await runK6(k6Config)
    const nameWithRPS = `${k6Config.name}_${k6Config.rps}rps`
    results[nameWithRPS] = stats
  }

  writeChartJSData(results, path.join(reportPath, 'chartJSData.json'))
}

main()

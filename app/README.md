# Transient readme

Temporary readme while handling getting V2 (contents of the `/app` folder) completely merged.

# Changes

## Web report (early preview)

Zero-dependency single file `index.html` + `index.js` web report dashboard that runs without webserver (just doubleclick the file).

**Live App Demo:**

https://dbx6f.csb.app/


**Video Demo**:

![](./hasura-bench-report.gif)

## Unified CLI using oclif

Added `/cli` app which just imports the exported benchmark and subscription methods and wraps them in global CLI interface using `@oclif` to handle the heavy lifting.

Example:
```sh
❯ graphql-bench --help
VERSION
  graphql-bench/0.0.0 linux-x64 node-v14.6.0

USAGE
  $ graphql-bench [COMMAND]

COMMANDS
  help          display help for graphql-bench
  query         Benchmark GraphQL queries or mutations
  subscription  Benchmark GraphQL subscriptions
```

```sh
❯ graphql-bench query --help
Benchmark GraphQL queries or mutations

USAGE
  $ graphql-bench query [FILE]

OPTIONS
  -c, --config=config    (required) Filepath to YAML config file for query benchmarks
  -h, --help             show CLI help
  -o, --outfile=outfile  Filepath to output JSON file containing benchmark stats

EXAMPLE
  $ graphql-bench query --config ./config.query.yaml --outfile results.json
```


## Subscriptions

Exactly the same. Only change will be that the command will become part of the master CLI located in `/cli` that query bench has already been integrated with, for a unified interface.

## Queries

- Added `wrk2` to tools, now supports `k6`, `autocannon` and `wrk2`
- Instead of just a single benchmark mode of `req/s x duration`, there are 5 modes. See below for example config file with descriptions and example uses:
  
```yaml
url: 'http://localhost:8085/v1/graphql'
headers:
  X-Hasura-Admin-Secret: my-secret
queries:
    # Name: Unique name for the query
  - name: SearchAlbumsWithArtist
    # Tools: List of benchmarking tools to run: ['autocannon', 'k6', 'wrk2']
    tools: [autocannon, k6, wrk2]
    # Execution Strategy: the type of the benchmark to run. Options are: 
    # REQUESTS_PER_SECOND: Fixed duration, fixed rps. Example parameters:
    #   duration: 10s
    #   rps: 500
    # FIXED_REQUEST_NUMBER: Complete requests as fast as possible, no duration. Example parameters:
    #   requests: 10000
    # MAX_REQUESTS_IN_DURATION: Make as many requests as possible in duration. Example parameters:
    #   duration: 10s
    # MULTI_STAGE: (K6 only currently) Several stages of REQUESTS_PER_SECOND benchmark. Example parameters:
    #   initial_rps: 0
    #   stages:
    #     - duration: 5s
    #       target: 100
    #     - duration: 10s
    #       target: 1000
    # CUSTOM: Pass completely custom options to each tool (see full API spec for all supported options, very large)
    execution_strategy: REQUESTS_PER_SECOND
    rps: 2000
    duration: 10s
    connections: 50
    query: |
      query SearchAlbumsWithArtist {
        albums(where: {title: {_like: "%Rock%"}}) {
          id
          title
          artist {
            name
            id
          }
        }
      }
  - name: AlbumByPK
    tools: [autocannon, k6]
    execution_strategy: FIXED_REQUEST_NUMBER
    requests: 10000
    query: |
      query AlbumByPK {
        albums_by_pk(id: 1) {
          id
          title
        }
      }
  - name: AlbumByPKMultiStage
    tools: [k6]
    execution_strategy: MULTI_STAGE
    initial_rps: 0
    stages:
      - duration: 5s
        target: 100
      - duration: 5s
        target: 1000
    query: |
      query AlbumByPK {
        albums_by_pk(id: 1) {
          id
          title
        }
      }
```


# GraphQL Benchmarking Toolset

## Introduction

This repo contains four top-level folders, and a Makefile. This is the significance of each:

- `/containers`: Has the `docker-compose.yaml` manifest for Hasura + Postgres 12. By default, Hasura is bound to `localhost:8085` not to conflict, and postgres to `localhost:5430`. Feel free to modify these if you like. It also contains a SQL script for creating the Chinook database, and a bash script for loading it into Postgres as-configured.

- `/queries`: This folder contains the code for benchmarking GraphQL queries. Two different benchmarking tools are used to get a better estimate. Autocannon, written in Node, and K6, written in Go (with a JS scripting API).

- `/subscriptions`: Contains the code for benchmarking subscriptions (this contains it's own README and set of instructions, please see it for details).

- `/reports`: The output of both JSON and HTML reports when running benchmarks goes here. It contains two folders, `/k6` and `/autocannon` which each hold their respective report data.

There is a makefile in the root of the project, with a help command available. Running `make` without arguments or `make help` will prompt it:

```
❯ make
00README                       RECOMMENDED PROCESS: "make setup_containers" -> "make create_chinook_database" -> "make benchmark_all_then_serve_reports"
benchmark_all_then_serve_reports Runs benchmarks with Autocannon & K6, then serves their reports on http://localhost:5000
benchmark_autocannon           Runs benchmarks using Autocannon, outputs HTML & JSON reports per-query to './reports/autocannon'
benchmark_k6                   Runs benchmarks using K6, outputs JSON reports per-query to './reports/k6'
clean_reports                  Remove previously generated bench reports
create_chinook_database        Sets up Chinook database in Hasura for testing
do_everything_for_me           Sets up containers, creates Chinook database, runs benchmarks with Autocannon & K6, then serves reports
install_node_modules           Installs nodes modules for query dependencies
serve_reports                  Starts a webserver to display the output of Autocannon and K6 reports on http://localhost:5000
setup_all                      Sets up containers and then creates Chinook database
setup_containers               Sets up Hasura and Postgres Docker containers
```

The easiest path, as the recommendation states, is likely to run `make setup_container`, `make_create_chinook_database`, and then `make benchmark_all_then_serve` to see if any issues arise at one of those points. You can also run `make do_everything_for_me` and cross your fingers though.

## Requirements

- Node
- Docker
- Docker Compose
- Unix-based OS or Dockerize the setup/run in VM

## Queries

### Configuration

The query configuration is done in a file `./queries/config.yaml`. Below is an explanation of each setting:

```yaml
# URL to Hasura endpoint
url: http://localhost:8085/v1/graphql
# (Optional) Headers object
headers:
  X-Hasura-Admin-Secret: my-secret
# Array of query objects
queries:
  # Name identifies it on the output reports
  - name: SearchAlbumsWithArtist
    # Duration is a timestring
    duration: 10s
    # Requests per second
    rps: 400
    # (Optional) Assert that the number of results returned by query matches a number
    assert:
      results: 7
    # Query string
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
    duration: 10s
    rps: 400
    assert:
      results: 1
    query: |
      query AlbumByPK($id: Int!) {
        albums_by_pk(id: $id) {
          id
          title
        }
      }
    # (Optional) Variables object, easier just to send direct queries
    variables:
      id: 5
```

### Running

You can call any of the following to run benchmarks:

- `make benchmark_k6`
- `make benchmark_autocannon`
- `make benchmark_all_then_serve_reports`

If you want to run the entire process of benchmarking manually, you can do:

- `make benchmark_k6 benchmark_autocannon serve_reports`

After running this process, during the benchmarking, you should have gotten terminal stdout output like this:

| Autocannon                               | K6                               |
| ---------------------------------------- | -------------------------------- |
| ![](readme_images/autocannon-output.png) | ![](readme_images/k6-output.png) |

And if you chose to run `make benchmark_all_then_serve_reports`, then finally it should be serving the finished reports on `http://localhost:5000`:

| Output                                  | Web index                          |
| --------------------------------------- | ---------------------------------- |
| ![](readme_images/npx-serve-output.png) | ![](readme_images/serve-index.png) |

Inside of the `autocannon` directory, you should see several HTML files with query names, one per query, with reports like below:

![](readme_images/autocannon-report.png)

Clicking on `k6` will take you to the generated plot from the aggregate query data:

![](readme_images/k6s-report.png)

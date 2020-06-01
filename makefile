.PHONY: clean_reports benchmark_autocannon benchmark_k6 serve_reports create_chinook_database help

clean_reports: ## Remove previously generated bench reports
	rm reports/**/*.json
	rm reports/autocannon/*.html

benchmark_k6: ## Runs benchmarks using K6, outputs JSON reports per-query to './reports/k6'
	node queries/src/k6/wrapper.js

benchmark_autocannon: ## Runs benchmarks using Autocannon, outputs HTML & JSON reports per-query to './reports/autocannon'
	node queries/src/autocannon.js

serve_reports: ## Starts a webserver to display the output of Autocannon and K6 reports on http://localhost:5000
	cd reports && npx serve

benchmark_all_then_serve_reports: ## Runs benchmarks with Autocannon & K6, then serves their reports on http://localhost:5000
benchmark_all_then_serve_reports: install_node_modules benchmark_autocannon benchmark_k6 serve_reports

setup_containers: ## Sets up Hasura and Postgres Docker containers
	cd containers && docker-compose up -d

create_chinook_database: ## Sets up Chinook database in Hasura for testing
	./containers/psql-seed-chinook.sh

setup_all: ## Sets up containers and then creates Chinook database
setup_all: setup_containers create_chinook_database

install_node_modules: ## Installs nodes modules for query dependencies
	@if command -v yarn; then \
		cd queries && yarn install; \
	elif command -v npm; then \
		cd queries && npm install; \
	fi

do_everything_for_me: ## Sets up containers, creates Chinook database, runs benchmarks with Autocannon & K6, then serves reports
do_everything_for_me: setup_all benchmark_all_then_serve_reports

00README: ## RECOMMENDED PROCESS: "make setup_containers" -> "make create_chinook_database" -> "make benchmark_all_then_serve_reports"
	@echo 1

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help

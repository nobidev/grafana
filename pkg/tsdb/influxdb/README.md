# InfluxDB

This directory contains the InfluxDB datasource for Grafana. As the InfluxDB datasource supports multiple query languages, the implementation differs from most other datasources in structure to handle different query types, such as Flux and InfluxQL.

## Directory Structure

- `models`: Contains the various data models used by the InfluxDB datasource.
- `services`: Contains the services used to interact with InfluxDB. These generally wrap the appropriate client libraries.
- `query`: Contains the "queriers" for the InfluxDB datasource. These are responsible for executing queries against InfluxDB and returning results, and also closing the client connections.
- `handlers`: Contains the request handlers for the InfluxDB datasource.

## Architecture

```md
QueryData -> Handler -> Querier -> Service -> Client
```

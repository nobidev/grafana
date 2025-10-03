---
aliases:
canonical: https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/alert-enrichment/
description: Alert enrichment
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alert enrichment
weight: 120
---

# Alert enrichment

Grafana Cloud alert enrichment feature makes your alert notifications richer and more actionable with a variety of enrichment options. With Alert enrichment, you can configure different enrichment types to add add to preliminary analysis or additional context. Alert enrichments can be scoped by either labels, annotations, or applied across all alerts.

## Before you begin

Alert enrichments must be turned on by a feature flag.

Only an alerting administrator can create alert enrichments.

## Create a new enrichment

1. To create a new alert enrichment, go to **Alerting > Settings > Alert Enrichment**.
   Click **+ New alert enrichment** to create a new enrichment.

1. Give your enrichment a name an optional description.

1. Enter a timeout for the enrichment.

1. Select an enricher type.
   - Assign: add an annotation assignment to alerts.
   - External: trigger an external service endpoint.
   - Data Source Query: assign a PromQL data source query to be added to alerts.
   - Asserts: use Asserts enrichment.
   - Sift: create a [Sift investigation](/docs/grafana-cloud/machine-learning/sift/) for alerts.
   - Explain: create a LLM enrichment for alerts. Requires [LLM plugin to be enabled](docs/grafana-cloud/machine-learning/llm/llm-setup/).
   - Assistant Investigations: enrichments from Grafana Assistant.

1. Define the Scope of the enrichment. You can choose to have the enrichment scoped to All alerts, Label scoped, or Annotation scoped.

1. Click **Save Enrichment** to save and apply the new enrichment.

## Edit enrichments

You can edit your alert enrichments from the Alert rule list page. Find the alert rule and click **Edit**. At the bottom of the alert rule edit page, you can find a button to view the alert enrichments or edit the alert enrichments.

If you add an alert enrichment here, it is applied on a individual level to the designated alert rule.

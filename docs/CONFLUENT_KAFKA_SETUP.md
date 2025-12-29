# Confluent Kafka Integration Guide

This project uses Confluent Cloud Kafka to handle asynchronous job search processing. This architecture prevents timeouts in Supabase Edge Functions and allows for reliable, scalable processing.

## Architecture

1.  **Frontend**: Calls `jobs-search` Edge Function.
2.  **`jobs-search` Function**: Validates the request and **Produces** a message to the `job-search-requests` topic in Confluent Cloud. Returns immediately to the frontend.
3.  **Confluent Cloud**: Buffers the message.
4.  **HTTP Sink Connector**: Pushes the message to the `process-job-search` Edge Function.
5.  **`process-job-search` Function**: Acts as the **Consumer**. It performs the heavy lifting (Firecrawl scraping, OpenAI enrichment, Database insertion).
6.  **Supabase Realtime**: The Frontend listens for `INSERT` events on the `jobs` table and updates the UI automatically when the worker finishes.

## Setup Instructions

### 1. Confluent Cloud Setup

1.  **Create Cluster**: Create a Basic or Standard cluster in Confluent Cloud.
2.  **Create Topic**: Create a topic named `job-search-requests` (partitions: 1-6 depending on load).
3.  **Create API Key**: Create a Global Access (or granular) API Key & Secret for the cluster.

### 2. Environment Variables

Add the following secrets to your Supabase project (and local `.env` if testing locally):

```bash
# Confluent Cloud Connection
CONFLUENT_REST_URL="https://pkc-xxxxx.region.provider.confluent.cloud:443"
CONFLUENT_CLUSTER_ID="lkc-xxxxx"
CONFLUENT_API_KEY="<your-api-key>"
CONFLUENT_API_SECRET="<your-api-secret>"

# Topic Name
KAFKA_TOPIC_JOB_SEARCH="job-search-requests"
```

### 3. Deploy Functions

Deploy the updated functions to Supabase:

```bash
supabase functions deploy jobs-search --no-verify-jwt
supabase functions deploy process-job-search --no-verify-jwt
```

### 4. Configure HTTP Sink Connector

In Confluent Cloud, go to **Connectors** and add a **HTTP Sink** connector.

**Configuration:**

*   **Topics**: `job-search-requests`
*   **Input Data Format**: JSON
*   **HTTP URL**: `https://<your-project-ref>.supabase.co/functions/v1/process-job-search`
*   **HTTP Method**: `POST`
*   **Authorization Header**: `Bearer <your-service-role-key>` (Use the Service Role Key so the function bypasses Auth checks if you removed them, or keep Anon Key if you pass user context inside payload).
    *   *Note:* The `process-job-search` function currently expects the payload in the body. Ensure the connector sends the raw value.
*   **Batch Size**: 1 (Start with 1 to ensure each search is processed individually).

## Troubleshooting

*   **Logs**: Check Supabase Function logs for `jobs-search` (Producer) and `process-job-search` (Consumer).
*   **Confluent UI**: Check the "Messages" tab in your Topic to see if messages are arriving. Check "Connectors" status for errors.

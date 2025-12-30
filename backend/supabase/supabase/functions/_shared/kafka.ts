
// Utility to produce messages to Confluent Cloud via REST API (v3)
// Reference: https://docs.confluent.io/cloud/current/api.html#records-v3

export interface KafkaMessage {
  key?: string;
  value: any;
  headers?: Record<string, string>;
}

export async function produceMessage(
  topic: string,
  message: KafkaMessage
): Promise<void> {
  const restUrl = Deno.env.get('CONFLUENT_REST_URL');
  const clusterId = Deno.env.get('CONFLUENT_CLUSTER_ID');
  const apiKey = Deno.env.get('CONFLUENT_API_KEY');
  const apiSecret = Deno.env.get('CONFLUENT_API_SECRET');

  if (!restUrl || !clusterId || !apiKey || !apiSecret) {
    throw new Error('Missing Confluent Cloud configuration (CONFLUENT_REST_URL, CONFLUENT_CLUSTER_ID, CONFLUENT_API_KEY, CONFLUENT_API_SECRET)');
  }

  // Construct the endpoint
  // Endpoint: {baseUrl}/kafka/v3/clusters/{cluster_id}/topics/{topic_name}/records
  const endpoint = `${restUrl}/kafka/v3/clusters/${clusterId}/topics/${topic}/records`;

  // Prepare payload
  // The API expects a partition_id (optional), key (optional object), value (optional object), headers (optional list)
  // We will serialize value as JSON if it is an object.

  const payload = {
    key: message.key ? { type: "STRING", data: message.key } : undefined,
    value: { type: "JSON", data: message.value },
    headers: message.headers ? Object.entries(message.headers).map(([k, v]) => ({ name: k, value: btoa(v) })) : undefined
  };

  const auth = btoa(`${apiKey}:${apiSecret}`);

  console.log(`[Kafka] Producing to ${topic}...`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[Kafka] Produce failed: ${response.status} ${text}`);
    throw new Error(`Failed to produce to Kafka: ${response.status} ${text}`);
  }

  const result = await response.json();
  console.log(`[Kafka] Produce success: offset ${result.offset}, partition ${result.partition_id}`);
}

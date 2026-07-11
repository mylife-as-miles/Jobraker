import { Composio } from "@composio/core";


const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

async function main() {
  const { data: connectedAccounts } = await composio.connectedAccounts.list({
    userIds: ["f51c7263-54cd-4e9d-bb62-b7f94b159f8c"]
  });
  console.log(JSON.stringify(connectedAccounts, null, 2));
}

main();

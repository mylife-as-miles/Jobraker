import { Composio } from "@composio/core";
const apiKey = process.env.COMPOSIO_API_KEY;

const composio = new Composio({ apiKey });

async function main() {
  const result = await composio.authConfigs.list({
    toolkitSlug: "linkedin"
  });
  console.log("toolkitSlug=linkedin configs:", JSON.stringify(result, null, 2));

  const result2 = await composio.authConfigs.list({
    appName: "linkedin"
  });
  console.log("appName=linkedin configs:", JSON.stringify(result2, null, 2));
}

main();

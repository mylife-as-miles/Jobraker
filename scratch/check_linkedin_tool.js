import { Composio } from "@composio/core";
const apiKey = process.env.COMPOSIO_API_KEY;

const composio = new Composio({ apiKey });

async function main() {
  try {
    const tool = await composio.tools.get("linkedin");
    console.log("LinkedIn Tool Metadata:", JSON.stringify(tool, null, 2));
  } catch (e) {
    console.error("Error fetching linkedin tool:", e);
  }
}

main();

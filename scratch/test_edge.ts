

const SUPABASE_URL = "https://yquhsllwrwfvrwolqywh.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function main() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/composio-auth`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ANON_KEY}`,
      "x-user-id": "f51c7263-54cd-4e9d-bb62-b7f94b159f8c",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "status",
      integrations: [
        { slug: "github", authConfigId: process.env.COMPOSIO_GITHUB_CONFIG_ID },
        { slug: "googledrive" }
      ]
    })
  });

  console.log(response.status, response.statusText);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main();

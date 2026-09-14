import { readFileSync } from "node:fs";

// Proves spike 3 (webhook reliability): re-send the exact same signed event
// Stripe already delivered once, and confirm server.ts's idempotency guard
// (keyed on event.id, see src/server.ts) skips the side effect the second time.
// Stripe genuinely does this in production on any non-2xx response or timeout,
// so this replay is not artificial — it's the documented retry behavior.
async function main() {
  const { rawBody, signature } = JSON.parse(readFileSync(".last-webhook.json", "utf8"));

  console.log("Replaying last webhook payload to /webhook ...");
  const res = await fetch("http://localhost:4242/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: rawBody,
  });

  const body = await res.json();
  console.log("Response:", res.status, body);

  if (body.duplicate) {
    console.log("\n✅ PASS — server recognized this as a duplicate event and skipped the side effect.");
  } else {
    console.log("\n❌ Unexpected — check server logs for confirm side-effect run count; it should not exceed 1.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "onyu-crm-push";
const KEY = "subscriptions";

async function getSubscriptions() {
  const store = getStore(STORE_NAME);
  const data = await store.get(KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const subscription = body.subscription;

    if (!subscription || !subscription.endpoint) {
      return { statusCode: 400, body: "Missing subscription" };
    }

    const store = getStore(STORE_NAME);
    const subscriptions = await getSubscriptions();
    const next = subscriptions.filter((item) => item.endpoint !== subscription.endpoint);
    next.push(subscription);

    await store.setJSON(KEY, next);
    return { statusCode: 200, body: JSON.stringify({ ok: true, count: next.length }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Subscribe failed" };
  }
};

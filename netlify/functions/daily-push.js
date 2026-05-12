const { schedule } = require("@netlify/functions");
const { getStore } = require("@netlify/blobs");
const webpush = require("web-push");

const STORE_NAME = "onyu-crm-push";
const KEY = "subscriptions";

function setupVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:example@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function getSubscriptions() {
  const store = getStore(STORE_NAME);
  const data = await store.get(KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}

async function saveSubscriptions(subscriptions) {
  const store = getStore(STORE_NAME);
  await store.setJSON(KEY, subscriptions);
}

const handler = async () => {
  try {
    setupVapid();
    const subscriptions = await getSubscriptions();

    const payload = JSON.stringify({
      title: "오늘 연락 대상 확인",
      body: "고객관리 앱에서 오늘 연락할 고객을 확인해 주세요.",
      url: "/"
    });

    const stillValid = [];

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription, payload);
        stillValid.push(subscription);
      } catch (error) {
        const code = error.statusCode || error.status;
        if (code !== 404 && code !== 410) {
          stillValid.push(subscription);
          console.error("Push send error:", error);
        }
      }
    }

    await saveSubscriptions(stillValid);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent: stillValid.length })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Daily push failed"
    };
  }
};

// 매일 00:00 UTC = 한국시간 오전 9시
exports.handler = schedule("0 0 * * *", handler);

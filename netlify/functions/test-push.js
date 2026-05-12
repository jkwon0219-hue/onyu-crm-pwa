const webpush = require("web-push");

function setupVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:example@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    setupVapid();
    const body = JSON.parse(event.body || "{}");
    const subscription = body.subscription;

    if (!subscription || !subscription.endpoint) {
      return { statusCode: 400, body: "Missing subscription" };
    }

    await webpush.sendNotification(subscription, JSON.stringify({
      title: "테스트 알림",
      body: "관계 CRM 푸시 알림이 정상 작동합니다.",
      url: "/"
    }));

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Test push failed" };
  }
};

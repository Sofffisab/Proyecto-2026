import admin from "firebase-admin";

let firebase = null;

try {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Firebase env vars are not set");
  }

  if (!admin.apps.length) {
    firebase = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    firebase = admin.app();
  }

  console.log("[firebase] Initialized");
} catch (err) {
  console.warn("[firebase] Push notifications unavailable:", err.message);
}

export { firebase };
export default firebase;
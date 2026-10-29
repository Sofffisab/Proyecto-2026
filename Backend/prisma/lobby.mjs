import "dotenv/config";
import Ably from "ably";
const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY });
const page = await rest.channels.get("social:lobby").presence.get();
console.log("En la sala:", page.items.map((m) => m.clientId));

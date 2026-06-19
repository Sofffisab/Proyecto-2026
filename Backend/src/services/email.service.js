import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to, subject, html) {
  return resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

export async function sendWelcomeEmail(user) {
  return sendEmail(
    user.email,
    "Welcome to the Gym App",
    `<h1>Hello ${user.firstName}</h1><p>Welcome!</p>`
  );
}

export async function sendProgressEmail(user, message) {
  return sendEmail(
    user.email,
    "Progress Update",
    `<p>${message}</p>`
  );
}

export {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendProgressEmail,
} from "./communication.service.js";
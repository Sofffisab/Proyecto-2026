import QRCode from "qrcode";
import { randomUUID } from "crypto";

export const generateQrToken = () => {
  return randomUUID();
};

export const generateQrImage = async (payload) => {
  try {
    return await QRCode.toDataURL(JSON.stringify(payload));
  } catch (err) {
    throw new Error(`[QR Utils] Failed to generate QR Image: ${err.message}`);
  }
};

export const encodeQrPayload = (payload) => {
  return JSON.stringify(payload);
};

export const decodeQrPayload = (payload) => {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};
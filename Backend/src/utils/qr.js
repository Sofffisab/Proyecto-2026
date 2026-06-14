import QRCode from "qrcode";
import { randomUUID } from "crypto";

export const generateQrToken = () => {
  return randomUUID();
};

export const generateQrImage = async (payload) => {
  return QRCode.toDataURL(
    JSON.stringify(payload)
  );
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
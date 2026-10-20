// src/screens/admin/GenerateQRScreen.js
//
// Admin-facing "Generar nuevo QR" (spec section 13). Thin wrapper around
// the shared implementation — see src/screens/shared/GenerateQRScreen.js
// for the actual logic and the backend endpoints it calls.

import React from 'react';
import GenerateQRScreen from '../shared/GenerateQRScreen';

export default function AdminGenerateQRScreen({ onBack }) {
  return <GenerateQRScreen role="ADMIN" onBack={onBack} />;
}

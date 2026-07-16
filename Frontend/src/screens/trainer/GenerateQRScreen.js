// src/screens/trainer/GenerateQRScreen.js
//
// Trainer-facing "Generar nuevo QR" (spec section 9). Thin wrapper around
// the shared implementation — see src/screens/shared/GenerateQRScreen.js
// for the actual logic and the backend endpoints it calls.

import React from 'react';
import GenerateQRScreen from '../shared/GenerateQRScreen';

export default function TrainerGenerateQRScreen({ onBack }) {
  return <GenerateQRScreen role="TRAINER" onBack={onBack} />;
}

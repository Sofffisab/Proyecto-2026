// Lets the person pick a profile picture from their gallery and returns it as a
// small JPEG data URL ("data:image/jpeg;base64,...") ready for
// PUT /users/me { profilePhoto }. The backend caps it at ~1 MB, so the image is
// cropped square and shrunk to MAX_SIDE px here first.

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const MAX_SIDE = 320;
const JPEG_QUALITY = 0.7;

/** Web: draw the picked image on a canvas no bigger than MAX_SIDE and export a JPEG. */
function shrinkOnWeb(uri) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const target = Math.min(MAX_SIDE, side);
      const canvas = document.createElement('canvas');
      canvas.width = target;
      canvas.height = target;
      // Centered square crop.
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, target, target);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = uri;
  });
}

/**
 * @returns {Promise<string|null>} the data URL, or null if the person cancelled.
 * @throws {Error} with code 'PERMISSION_DENIED' if the gallery permission was refused.
 */
export async function pickProfilePhoto() {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      const err = new Error('Permission denied');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
    base64: Platform.OS !== 'web',
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  if (Platform.OS === 'web') return shrinkOnWeb(asset.uri);
  return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
}

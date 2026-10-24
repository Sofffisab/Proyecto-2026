// src/constants/exerciseImages.js
//
// Photos bundled with the app, keyed by the exercise `slug` coming from the
// database. Exercises without an entry here use their own `imageUrl` (custom
// exercises) or show an empty placeholder. To add a photo to another
// built-in exercise: drop `assets/exercise_<slug>.png` and add a line below.

export const EXERCISE_IMAGES = {
  declinePress: require('../assets/exercise_declinePress.png'),
  declineFlyes: require('../assets/exercise_declineFlyes.png'),
  parallelDips: require('../assets/exercise_parallelDips.png'),
  closeGripPress: require('../assets/exercise_closeGripPress.png'),
  cablePushdown: require('../assets/exercise_cablePushdown.png'),
  skullCrushers: require('../assets/exercise_skullCrushers.png'),
};

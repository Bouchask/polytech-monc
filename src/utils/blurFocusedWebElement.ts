import { Platform } from 'react-native';

/** Clear browser focus before React Navigation hides the screen containing it. */
export default function blurFocusedWebElement() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const activeElement = document.activeElement;
  if (activeElement && 'blur' in activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
}

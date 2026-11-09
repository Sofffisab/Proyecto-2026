import { useEffect } from 'react';
import { apiClient } from '../../apiClient/client';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Tells the Backend which language the signed-in person uses, so the texts the
 * Backend writes (notifications) come in that language. Renders nothing; the
 * app itself already follows the device choice. Best effort: a failure is ignored.
 */
export default function LanguageSync() {
  const { user } = useAuth();
  const { language } = useTranslation();

  useEffect(() => {
    if (!user?.id) return;
    apiClient.patch('/users/me/language', { language }).catch(() => {});
  }, [user?.id, language]);

  return null;
}

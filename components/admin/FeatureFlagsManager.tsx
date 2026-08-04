'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {useTranslations} from 'next-intl';
import Switch from '@/components/ui/Switch';

export default function FeatureFlagsManager() {
  const t = useTranslations('admin.featureFlags');
  const flags = useQuery(api.featureFlags.list);
  const setFlag = useMutation(api.featureFlags.setFlag);

  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggle(key: string, enabled: boolean) {
    setToggling(key);
    try {
      await setFlag({key, enabled});
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">{t('rulesTitle')}</h2>
        <p className="text-xs text-gray-500">{t('rulesSubtitle')}</p>
      </div>

      {flags === undefined ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          {t('loading')}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {flags.map(flag => (
            <li key={flag.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{t(`items.${flag.key}.label`)}</p>
                <p className="mt-0.5 text-xs text-gray-500">{t(`items.${flag.key}.description`)}</p>
              </div>
              <Switch
                checked={flag.enabled}
                disabled={toggling === flag.key}
                label={t(`items.${flag.key}.label`)}
                onChange={enabled => handleToggle(flag.key, enabled)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

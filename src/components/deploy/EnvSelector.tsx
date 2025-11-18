'use client';

import {useTranslations} from 'next-intl';
import type {DeployEnv} from '@/types/deploy';

interface EnvSelectorProps {
  selectedEnv: DeployEnv;
  onEnvChange: (env: DeployEnv) => void;
}

export function EnvSelector({selectedEnv, onEnvChange}: EnvSelectorProps) {
  const t = useTranslations('ops.deploy');

  const environments: {value: DeployEnv; label: string; description: string}[] = [
    {
      value: 'production',
      label: t('env.production'),
      description: t('env.productionDesc'),
    },
    {
      value: 'staging',
      label: t('env.staging'),
      description: t('env.stagingDesc'),
    },
    {
      value: 'preview',
      label: t('env.preview'),
      description: t('env.previewDesc'),
    },
    {
      value: 'custom',
      label: t('env.custom'),
      description: t('env.customDesc'),
    },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        {t('environment')}
      </label>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {environments.map((env) => (
          <button
            key={env.value}
            onClick={() => onEnvChange(env.value)}
            className={`rounded-lg border-2 p-3 text-left transition-all ${
              selectedEnv === env.value
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="font-semibold text-sm">{env.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{env.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

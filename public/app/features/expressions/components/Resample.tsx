import { type ChangeEvent, useId } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import { downsamplingTypes, type ExpressionQuery, upsamplingTypes } from '../types';

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  labelWidth?: number | 'auto';
  onChange: (query: ExpressionQuery) => void;
}

export const Resample = ({ labelWidth = 'auto', onChange, refIds, query }: Props) => {
  const downsampler = downsamplingTypes.find((o) => o.value === query.downsampler);
  const upsampler = upsamplingTypes.find((o) => o.value === query.upsampler);

  const inputId = useId();
  const resampleToId = useId();
  const downsampleId = useId();
  const upsampleId = useId();

  const onWindowChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, window: event.target.value });
  };

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...query, expression: value.value });
  };

  const onSelectDownsampler = (value: SelectableValue<string>) => {
    onChange({ ...query, downsampler: value.value });
  };

  const onSelectUpsampler = (value: SelectableValue<string>) => {
    onChange({ ...query, upsampler: value.value });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label={t('expressions.resample.label-input', 'Input')} labelWidth={labelWidth}>
          <Select inputId={inputId} onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={t('expressions.resample.label-resample-to', 'Resample to')}
          labelWidth={labelWidth}
          tooltip={t('expressions.resample.tooltip-s-m-h', '10s, 1m, 30m, 1h')}
        >
          <Input id={resampleToId} onChange={onWindowChange} value={query.window} width={15} />
        </InlineField>
        <InlineField label={t('expressions.resample.label-downsample', 'Downsample')}>
          <Select
            inputId={downsampleId}
            options={downsamplingTypes}
            value={downsampler}
            onChange={onSelectDownsampler}
            width={25}
          />
        </InlineField>
        <InlineField label={t('expressions.resample.label-upsample', 'Upsample')}>
          <Select
            inputId={upsampleId}
            options={upsamplingTypes}
            value={upsampler}
            onChange={onSelectUpsampler}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

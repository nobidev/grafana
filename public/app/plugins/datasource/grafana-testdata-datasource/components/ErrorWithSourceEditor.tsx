import { useId } from 'react';

import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { type EditorProps } from '../QueryEditor';

const OPTIONS = [
  {
    label: 'Plugin',
    value: 'plugin',
  },
  {
    label: 'Downstream',
    value: 'downstream',
  },
];

const ErrorWithSourceQueryEditor = ({ query, onChange }: EditorProps) => {
  const errorSourceId = useId();
  return (
    <InlineFieldRow>
      <InlineField labelWidth={14} label="Error source">
        <Select
          inputId={errorSourceId}
          options={OPTIONS}
          value={query.errorSource}
          onChange={(v) => {
            onChange({ ...query, errorSource: v.value });
          }}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export default ErrorWithSourceQueryEditor;

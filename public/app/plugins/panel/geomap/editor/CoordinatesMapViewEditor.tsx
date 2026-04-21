import { useId } from 'react';

import { t } from '@grafana/i18n';
import { InlineFieldRow, InlineField } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { type MapViewConfig } from '../panelcfg.gen';

type Props = {
  labelWidth: number;
  value: MapViewConfig;
  onChange: (value?: MapViewConfig | undefined) => void;
};

export const CoordinatesMapViewEditor = ({ labelWidth, value, onChange }: Props) => {
  const latitudeId = useId();
  const longitudeId = useId();

  const onLatitudeChange = (latitude: number | undefined) => {
    onChange({ ...value, lat: latitude });
  };

  const onLongitudeChange = (longitude: number | undefined) => {
    onChange({ ...value, lon: longitude });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('geomap.coordinates-map-view-editor.label-latitude', 'Latitude')}
          labelWidth={labelWidth}
          grow={true}
        >
          <NumberInput id={latitudeId} value={value.lat} min={-90} max={90} step={0.001} onChange={onLatitudeChange} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={t('geomap.coordinates-map-view-editor.label-longitude', 'Longitude')}
          labelWidth={labelWidth}
          grow={true}
        >
          <NumberInput id={longitudeId} value={value.lon} min={-180} max={180} step={0.001} onChange={onLongitudeChange} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

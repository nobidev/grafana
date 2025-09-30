import { useState } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';

import { DashboardEditPane } from './DashboardEditPane';
import { DataSourceButton } from './DataSourceButton';
import { DataSourceSelectPane } from './DataSourceSelectPane';

interface Props {
  editPane: DashboardEditPane;
}

export function DashboardAddPanelPane({ editPane }: Props) {
  // This should probably be the same if this pane is opened again. Also store in dashboard state?
  const [currentDatasource, setCurrentDatasource] = useState<DataSourceInstanceSettings | undefined>(undefined);

  // This defaults to open, but should probably not be open if there is a current datasource.
  const [isDsPickerOpen, setIsDsPickerOpen] = useState(true);

  return (
    <div>
      {!isDsPickerOpen && (
        <DataSourceButton
          current={currentDatasource}
          ariaLabel={t('dashboard.data-source-button.aria-label', 'Change data source')}
          onOpen={() => setIsDsPickerOpen(true)}
        />
      )}
      {/* Metric selector goes here */}
      {isDsPickerOpen && (
        <DataSourceSelectPane
          current={currentDatasource}
          onSelect={(ds) => {
            setCurrentDatasource(ds);
            setIsDsPickerOpen(false);
          }}
          onClose={() => setIsDsPickerOpen(false)}
        />
      )}
    </div>
  );
}

DashboardAddPanelPane.displayName = 'DashboardAddPanelPane';

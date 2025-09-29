import { useState } from 'react';
import { useLocalStorage } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';

import { DashboardEditPane } from './DashboardEditPane';
import { DataSourceButton } from './DataSourceButton';
import { DataSourceSelectPane } from './DataSourceSelectPane';

interface Props {
  editPane: DashboardEditPane;
}

export function DashboardAddPanelPane({ editPane }: Props) {
  const [isDsPickerOpen, setIsDsPickerOpen] = useLocalStorage('grafana.dashboard.edit-pane.ds-picker.open', false);

  const [currentDatasource, setCurrentDatasource] = useState<DataSourceInstanceSettings | undefined>(undefined);

  return (
    <div>
      {!isDsPickerOpen && (
        <DataSourceButton
          current={currentDatasource}
          ariaLabel={t('dashboard.data-source-button.aria-label', 'Change data source')}
          onOpen={() => setIsDsPickerOpen(true)}
        />
      )}
      {isDsPickerOpen && (
        <DataSourceSelectPane
          current={currentDatasource}
          metrics={true}
          logs={true}
          tracing={true}
          dashboard={true}
          variables={true}
          mixed={true}
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

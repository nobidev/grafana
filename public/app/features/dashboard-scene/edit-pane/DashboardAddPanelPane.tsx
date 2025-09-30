import { css } from '@emotion/css';
import { useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

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

  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.title}>
        <Trans i18nKey="dashboard-scene.dashboard-add-panel-pane.add-data-to-dashboard">Add data to dashboard</Trans>
      </div>

      {!isDsPickerOpen && (
        <div>
          <DataSourceButton
            current={currentDatasource}
            ariaLabel={t('dashboard.data-source-button.aria-label', 'Change data source')}
            onOpen={() => setIsDsPickerOpen(true)}
          />
        </div>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    title: css({
      padding: theme.spacing(2),
    }),
  };
}

DashboardAddPanelPane.displayName = 'DashboardAddPanelPane';

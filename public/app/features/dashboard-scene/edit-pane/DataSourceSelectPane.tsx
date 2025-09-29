import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, FilterInput, ScrollContainer, Icon, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { matchDataSourceWithSearch } from 'app/features/datasources/components/picker/utils';
import { useDatasources } from 'app/features/datasources/hooks';

type Props = {
  onSelect: (ds: DataSourceInstanceSettings) => void;
  onClose: () => void;
  current?: DataSourceInstanceSettings | undefined;
};

export function DataSourceSelectPane(props: Props) {
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');

  const dataSources = useDatasources({
    dashboard: true,
    mixed: true,
    all: true,
  });

  const filtered = useMemo(
    () => dataSources.filter((ds) => matchDataSourceWithSearch(ds, searchQuery)),
    [dataSources, searchQuery]
  );

  return (
    <div className={styles.openWrapper}>
      <div className={styles.searchRow}>
        <FilterInput
          value={searchQuery}
          onChange={setSearchQuery}
          autoFocus={true}
          placeholder={t('dashboard.data-source-select-pane.search', 'Search data sources...')}
        />
        <Button
          title={t('dashboard.visualization-select-pane.title-close', 'Close')}
          variant="secondary"
          icon="angle-up"
          className={styles.closeButton}
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          aria-label={t('dashboard.data-source-select-pane.close', 'Close')}
          onClick={props.onClose}
        />
      </div>
      <div className={styles.scrollWrapper}>
        <ScrollContainer>
          <div className={styles.list}>
            {filtered.map((ds) => (
              <button key={ds.uid} type="button" className={styles.listItem} onClick={() => props.onSelect(ds)}>
                <span className={styles.logoWrap}>
                  <DataSourceLogo dataSource={ds} />
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{ds.name}</span>
                  <span className={styles.itemMeta}>
                    <Icon name="plug" /> {ds.type}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </ScrollContainer>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    openWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 100%',
      height: '100%',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1),
    }),
    searchRow: css({
      display: 'flex',
      marginBottom: theme.spacing(1),
    }),
    closeButton: css({
      marginLeft: theme.spacing(1),
    }),
    scrollWrapper: css({
      flexGrow: 1,
      minHeight: 0,
    }),
    list: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    listItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      textAlign: 'left',
      ':hover': {
        background: theme.colors.action.hover,
      },
    }),
    logoWrap: css({
      width: theme.spacing(3),
      height: theme.spacing(3),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    itemText: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    itemName: css({
      fontWeight: theme.typography.weightMedium,
    }),
    itemMeta: css({
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
  };
}

DataSourceSelectPane.displayName = 'DataSourceSelectPane';

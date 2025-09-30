import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, ToolbarButton, ButtonGroup } from '@grafana/ui';
import { dataSourceLabel } from 'app/features/datasources/components/picker/utils';

type Props = {
  ariaLabel?: string;
  onOpen?: () => void;
  current?: DataSourceInstanceSettings | undefined;
};

export function DataSourceButton(props: Props) {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  const label = useMemo(
    () => dataSourceLabel(props.current) || t('dashboard.data-source-button.select', 'Select data source'),
    [props]
  );
  const imgSrc = props.current?.meta?.info?.logos?.small;

  return (
    <div className={styles.wrapper}>
      <ButtonGroup>
        <ToolbarButton
          className={styles.dsButton}
          tooltip={t('dashboard.data-source-button.tooltip', 'Click to change data source')}
          imgSrc={imgSrc}
          isOpen={isOpen}
          onClick={() => {
            setIsOpen(true);
            // Notify parent to open inline pane
            props.onOpen?.();
          }}
          aria-label={props.ariaLabel || t('dashboard.data-source-button.aria-label', 'Change data source')}
          variant="canvas"
          fullWidth
        >
          {label}
        </ToolbarButton>
      </ButtonGroup>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      margin: theme.spacing(1),
    }),
    dsButton: css({
      textAlign: 'left',
    }),
  };
}

DataSourceButton.displayName = 'DataSourceButton';

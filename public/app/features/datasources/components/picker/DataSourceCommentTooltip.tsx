import { css } from '@emotion/css';

import { GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  text: string;
}

export function DataSourceCommentTooltip({ text }: Props) {
  const styles = useStyles2(getStyles);
  const html = renderTextPanelMarkdown(text);
  return <div className={styles.container} dangerouslySetInnerHTML={{ __html: html }} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(1),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxWidth: 360,
    }),
  };
}

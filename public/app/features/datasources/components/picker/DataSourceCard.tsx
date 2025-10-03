import { css, cx } from '@emotion/css';
import { marked } from 'marked';
import { useRef, useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Card, TagList, useTheme2, Icon, Tooltip } from '@grafana/ui';

import { DataSourceCommentTooltip } from './DataSourceCommentTooltip';

interface DataSourceCardProps {
  ds: DataSourceInstanceSettings;
  onClick: () => void;
  selected: boolean;
  description?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (ds: DataSourceInstanceSettings) => void;
}

export function DataSourceCard({
  ds,
  onClick,
  selected,
  description,
  isFavorite = false,
  onToggleFavorite,
  ...htmlProps
}: DataSourceCardProps) {
  const theme = useTheme2();
  const styles = getStyles(theme, ds.meta.builtIn);
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const firstSentence = ds.comment ? getFirstSentenceFromMarkdown(ds.comment) : '';

  const content = (
    <Card
      key={ds.uid}
      onClick={onClick}
      className={cx(styles.card, selected ? styles.selected : undefined)}
      noMargin
      {...htmlProps}
    >
      <Card.Heading className={styles.heading}>
        <div className={styles.headingContent}>
          <span className={styles.name}>
            <span className={styles.titleRow}>
              {ds.name} {ds.isDefault ? <TagList tags={['default']} /> : null}
            </span>
            {firstSentence && <span className={styles.subtext}>{firstSentence}</span>}
          </span>
          <div className={styles.rightSection}>
            <small className={styles.type}>{description || ds.meta.name}</small>
            {onToggleFavorite && !ds.meta.builtIn && (
              <Icon
                name={isFavorite ? 'favorite' : 'star'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(ds);
                }}
                className={styles.favoriteButton}
              />
            )}
          </div>
        </div>
      </Card.Heading>
      <Card.Figure className={styles.logo}>
        <img src={ds.meta.info.logos.small} alt={`${ds.meta.name} Logo`} />
      </Card.Figure>
    </Card>
  );

  if (!ds.comment) {
    return content;
  }

  return (
    <div
      onMouseEnter={() => {
        if (hoverTimer.current) {
          window.clearTimeout(hoverTimer.current);
        }
        hoverTimer.current = window.setTimeout(() => setOpen(true), 1000);
      }}
      onMouseLeave={() => {
        if (hoverTimer.current) {
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = null;
        }
        setOpen(false);
      }}
    >
      <Tooltip content={<DataSourceCommentTooltip text={ds.comment} />} placement="right" show={open}>
        <div>{content}</div>
      </Tooltip>
    </div>
  );
}

// Get styles for the component
function getStyles(theme: GrafanaTheme2, builtIn = false) {
  return {
    card: css({
      cursor: 'pointer',
      backgroundColor: 'transparent',
      // Move to list component
      marginBottom: 0,
      padding: theme.spacing(1),

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    heading: css({
      label: 'heading',
      width: '100%',
      overflow: 'hidden',
      // This is needed to enable ellipsis when text overlfows
      '> button': {
        width: '100%',
      },
    }),
    headingContent: css({
      label: 'headingContent',
      color: theme.colors.text.secondary,
      width: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    rightSection: css({
      label: 'rightSection',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
      flex: 1,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    logo: css({
      width: '32px',
      height: '32px',
      padding: theme.spacing(0, 1),
      display: 'flex',
      alignItems: 'center',

      '> img': {
        maxHeight: '100%',
        minWidth: '24px',
        filter: `invert(${builtIn && theme.isLight ? 1 : 0})`,
      },
    }),
    name: css({
      color: theme.colors.text.primary,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
      minWidth: 0,
    }),
    titleRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      minWidth: 0,
    }),
    subtext: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
      lineHeight: theme.typography.bodySmall.lineHeight,
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    type: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
    }),
    favoriteButton: css({
      flexShrink: 0,
      pointerEvents: 'auto',
      zIndex: 1,
    }),
    separator: css({
      margin: theme.spacing(0, 1),
      color: theme.colors.border.weak,
    }),
    selected: css({
      background: theme.colors.action.selected,

      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        transform: 'translateX(-50%)',
        width: theme.spacing(0.5),
        left: 0,
      },
    }),
    meta: css({
      display: 'block',
      overflowWrap: 'unset',
      whiteSpace: 'nowrap',
      width: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
  };
}

function getFirstSentenceFromMarkdown(md: string): string {
  const blocks = marked.lexer(md || '');
  if (blocks && blocks[0] && ['heading', 'paragraph', 'text'].includes(blocks[0].type)) {
    return ('text' in blocks[0] && blocks[0].text || '').trim();
  }
  return '';
}

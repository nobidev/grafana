import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { QueryEditorTypeConfig } from '../../constants';

import { AddCardButton } from './AddCardButton';

interface SidebarCardProps {
  config: QueryEditorTypeConfig;
  isSelected: boolean;
  id: string;
  children: React.ReactNode;
  onClick: () => void;
}

export const SidebarCard = ({ config, isSelected, id, children, onClick }: SidebarCardProps) => {
  const styles = useStyles2(getStyles, { config, isSelected });
  const typeText = config.getLabel();

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.card}
        onClick={onClick}
        type="button"
        aria-label={t('query-editor-next.sidebar.card-click', 'Select card {{id}}', { id })}
        aria-pressed={isSelected}
      >
        <div className={styles.cardHeader}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon name={config.icon} />
            <Text weight="light" variant="body">
              {typeText}
            </Text>
          </Stack>
        </div>
        <div className={styles.cardContent}>{children}</div>
      </button>
      <AddCardButton afterRefId={id} />
    </div>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  { config, isSelected }: { config: QueryEditorTypeConfig; isSelected?: boolean }
) {
  return {
    wrapper: css({
      position: 'relative',
      marginInline: theme.spacing(2),

      // Two slim pseudo-element strips extend the hover zone to the left and
      // below the card, covering the path to the <AddCardButton /> ("+" icon button)
      // without overlapping the card's own clickable surface (which would interfere
      // with selecting the query card).

      // Left strip: narrow gutter running along the card's left edge and below.
      '&::before': {
        content: '""',
        position: 'absolute',
        top: '0%',
        left: `calc(-1 * ${theme.spacing(1.5)})`,
        width: theme.spacing(1.5),
        height: `calc(100% + ${theme.spacing(1.5)})`,
        // background: 'hsla(333, 83%, 33%, 0.5)', // uncomment to debug hover zone to the left of the card
      },

      // Bottom strip: runs along the card's bottom edge extending to the left.
      '&::after': {
        content: '""',
        position: 'absolute',
        top: '100%',
        left: `calc(-1 * ${theme.spacing(1.5)})`,
        width: `calc(100% + ${theme.spacing(1.5)})`,
        height: theme.spacing(1.5),
        // background: 'hsla(333, 83%, 33%, 0.5)', // uncomment to debug hover zone below the card
      },

      '&:hover': {
        zIndex: 1,
      },

      // Show add button on hover, or when its dropdown menu is open
      '&:hover [data-add-button], [data-menu-open]': {
        opacity: 1,
        pointerEvents: 'auto',
      },
    }),
    card: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      background: isSelected ? theme.colors.action.selected : theme.colors.background.secondary,
      border: `1px solid ${isSelected ? theme.colors.primary.border : theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      padding: 0,
      boxShadow: isSelected ? `0 0 9px 0 rgba(58, 139, 255, 0.3)` : 'none',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: isSelected
          ? theme.colors.action.selected
          : theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        borderColor: isSelected ? theme.colors.primary.border : theme.colors.border.medium,
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
    cardHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
      color: config.color,
      borderTopRightRadius: theme.shape.radius.default,
      borderTopLeftRadius: theme.shape.radius.default,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
  };
}

import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { NavLandingPageCard } from './NavLandingPageCard';

interface Props {
  navId: string;
  header?: React.ReactNode;
}

export function NavLandingPage({ navId, header }: Props) {
  const { node } = useNavModel(navId);
  const styles = useStyles2(getStyles);
  const children = node.children?.filter((child) => !child.hideFromTabs);

  const PluginComponents = useExtensionComponents({
    extensionPoint: `grafana/nav-landing-page/${navId}/v1`,
    context: { navModel: node } // ?? idk
  })

  return (
    <Page navId={node.id}>
      <Page.Contents>
        <div className={styles.content}>
          {header}

          {/*
            If we have PluginComponents for this nav ID, render them at full width (inside the <Page />?).
            Otherwise, use the default cards.
          */}

          {/* {PluginComponents} */}

          {PluginComponents.length > 0 ? (
            PluginComponents.map(Component => <Component />)
          ) : children && children.length > 0 && (
            <section className={styles.grid}>
              {children?.map((child) => (
                <NavLandingPageCard
                  key={child.id}
                  description={child.subTitle}
                  text={child.text}
                  url={child.url ?? ''}
                />
              ))}
            </section>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  grid: css({
    display: 'grid',
    gap: theme.spacing(3),
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gridAutoRows: '138px',
    padding: theme.spacing(2, 0),
  }),
});

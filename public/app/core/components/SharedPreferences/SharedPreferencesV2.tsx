import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { FeatureState, GrafanaTheme2, ThemeRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { PSEUDO_LOCALE, t, Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Button,
  Field,
  FieldSet,
  Label,
  TimeZonePicker,
  WeekStartPicker,
  FeatureBadge,
  Combobox,
  ComboboxOption,
  TextLink,
  WeekStart,
  isWeekStart,
  RadioButtonGroup,
  Card,
  useStyles2,
} from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { LANGUAGES } from 'app/core/internationalization/constants';
import { LOCALES, REGION_FORMAT_CODES } from 'app/core/internationalization/locales';
import { changeTheme } from 'app/core/services/theme';
import {
  PreferencesSpec,
  useGetUserPreferencesQuery,
  useGetTeamPreferencesQuery,
  useGetOrgPreferencesQuery,
  useUpdateUserPreferencesMutation,
  useUpdateTeamPreferencesMutation,
  useUpdateOrgPreferencesMutation,
} from 'app/features/preferences/api';

import { getSelectableThemes } from '../ThemeSelector/getSelectableThemes';

export type PreferencesType = 'user' | 'team' | 'org';

export interface Props {
  disabled?: boolean;
  preferenceType: PreferencesType;
  teamId?: string;
  onConfirm?: () => Promise<boolean>;
}

function getLanguageOptions(): ComboboxOption[] {
  const languageOptions = LANGUAGES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
    if (a.value === PSEUDO_LOCALE) {
      return 1;
    }

    if (b.value === PSEUDO_LOCALE) {
      return -1;
    }

    return a.label.localeCompare(b.label);
  });

  if (process.env.NODE_ENV === 'development') {
    languageOptions.push({
      value: PSEUDO_LOCALE,
      label: 'Pseudo-locale',
    });
  }

  const options = [
    {
      value: '',
      label: t('common.locale.default', 'Default'),
    },
    ...languageOptions,
  ];

  return options;
}

function getRegionalFormatOptions(): ComboboxOption[] {
  const localeOptions = LOCALES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
    // eslint-disable-next-line
    return a.label.localeCompare(b.label);
  });

  const options = [
    {
      value: '',
      label: t('common.locale.default', 'Default'),
    },
    ...localeOptions,
  ];
  return options;
}

function getDateFormatOptions(): ComboboxOption[] {
  return [
    {
      value: '',
      label: t('shared-preferences.fields.date-format-default', 'Default'),
      description: t(
        'shared-preferences.fields.date-format-default-description',
        'Inherit the preference from your team or organization'
      ),
    },
    {
      value: 'localized',
      label: t('shared-preferences.fields.date-format-localized', 'Regional'),
      description: t(
        'shared-preferences.fields.date-format-localized-description',
        "Dates and times follow your region's formatting conventions"
      ),
    },
    {
      value: 'international',
      label: t('shared-preferences.fields.date-format-international', 'International'),
      description: t(
        'shared-preferences.fields.date-format-international-description',
        'Dates and times use standardized formatting (YYYY-MM-DD, 24-hour time)'
      ),
    },
  ];
}

function getTranslatedThemeName(theme: ThemeRegistryItem) {
  switch (theme.id) {
    case 'dark':
      return t('shared.preferences.theme.dark-label', 'Dark');
    case 'light':
      return t('shared.preferences.theme.light-label', 'Light');
    case 'system':
      return t('shared.preferences.theme.system-label', 'System preference');
    default:
      return theme.name;
  }
}

function assertTeamId(type: string, teamId?: string): string {
  if (type === 'team' && !teamId && process.env.NODE_ENV === 'development') {
    throw new Error('Team ID is required for team preferences');
  } else if (type === 'team' && !teamId) {
    console.warn('Team ID is required for team preferences');
  }

  return teamId || '';
}

/**
 * Abstract away user/team/org/server preferences queries, depending on the props
 */
function usePreferencesQuery(type: PreferencesType, teamId: string | undefined) {
  const userQueryResult = useGetUserPreferencesQuery(undefined, { skip: type !== 'user' });
  const teamQueryResult = useGetTeamPreferencesQuery({ teamId: assertTeamId(type, teamId) }, { skip: type !== 'team' });
  const orgQueryResult = useGetOrgPreferencesQuery(undefined, { skip: type !== 'org' });

  switch (type) {
    case 'user':
      return userQueryResult;
    case 'team':
      return teamQueryResult;
    case 'org':
      return orgQueryResult;
  }
}

function usePreferencesMutation(type: PreferencesType) {
  const [userMutation, userResult] = useUpdateUserPreferencesMutation();
  const [teamMutation, teamResult] = useUpdateTeamPreferencesMutation();
  const [orgMutation, orgResult] = useUpdateOrgPreferencesMutation();

  type MutationArg = Parameters<typeof userMutation>[0] &
    Parameters<typeof teamMutation>[0] &
    Parameters<typeof orgMutation>[0];

  const abstractMutation = useCallback(
    (data: MutationArg) => {
      switch (type) {
        case 'user':
          return userMutation(data);
        case 'team':
          return teamMutation(data);
        case 'org':
          return orgMutation(data);
      }
    },
    [type, userMutation, teamMutation, orgMutation]
  );

  switch (type) {
    case 'user':
      return [abstractMutation, userResult] as const;
    case 'team':
      return [abstractMutation, teamResult] as const;
    case 'org':
      return [abstractMutation, orgResult] as const;
  }
}

export function SharedPreferencesV2({ teamId, disabled, preferenceType, onConfirm }: Props) {
  const styles = useStyles2(getStyles);

  const { data: prefs, isLoading } = usePreferencesQuery(preferenceType, teamId);
  const [updatePrefs, { isLoading: isUpdatingPrefs }] = usePreferencesMutation(preferenceType);

  // State for preferences
  const [preferences, setPreferences] = useState<PreferencesSpec>({
    theme: '',
    homeDashboardUID: '',
    timezone: '',
    weekStart: '',
    language: '',
    regionalFormat: '',
    dateFormat: '',
  });

  useEffect(() => {
    if (prefs) {
      setPreferences({
        theme: prefs.theme || '',
        homeDashboardUID: prefs.homeDashboardUID || '',
        timezone: prefs.timezone || '',
        weekStart: prefs.weekStart || '',
        language: prefs.language || '',
        regionalFormat: prefs.regionalFormat || '',
        dateFormat: prefs.dateFormat || '',
      });
    }
  }, [prefs]);

  // Memoized options
  const themeOptions = React.useMemo(() => {
    const themes = getSelectableThemes();
    const options = themes.map((theme) => ({
      value: theme.id,
      label: getTranslatedThemeName(theme),
      group: theme.isExtra ? t('shared-preferences.theme.experimental', 'Experimental') : undefined,
    }));
    // Add default option
    options.unshift({ value: '', label: t('shared-preferences.theme.default-label', 'Default'), group: undefined });
    return options;
  }, []);

  const languageOptions = React.useMemo(() => {
    // [fixme] should use the actual user preference from user object
    const displayNames = new Intl.DisplayNames(preferences.language || undefined, { type: 'language' });

    const baseOptions = getLanguageOptions();

    return baseOptions.map((opt) => {
      return {
        ...opt,
        description: opt.value ? displayNames.of(opt.value) : undefined,
      };
    });
  }, [preferences.language]);

  const regionalFormatOptions = React.useMemo(() => {
    // [fixme] should use the actual user preference from user object
    console.log('making it with', preferences.language || undefined);
    const displayNamesPref = new Intl.DisplayNames(preferences.language || undefined, { type: 'language' });
    const displayNamesPrefStd = new Intl.DisplayNames(preferences.language || undefined, {
      type: 'language',
      languageDisplay: 'standard',
    });
    // const baseOptions = getRegionalFormatOptions();

    return REGION_FORMAT_CODES.map((code) => {
      const displayNameNative = new Intl.DisplayNames(code, { type: 'language' });

      const nativeDisplayName = displayNameNative.of(code) || code;
      const prefDialectDisplayName = displayNamesPref.of(code);
      const prefStandardDisplayName = displayNamesPrefStd.of(code);

      let description = undefined;
      if (prefDialectDisplayName && prefDialectDisplayName !== nativeDisplayName) {
        description = prefDialectDisplayName;
      } else {
        description = prefStandardDisplayName;
      }

      return {
        value: code,
        label: nativeDisplayName,
        description: description,
      };
    });
  }, [preferences.language]);
  const dateFormatOptions = React.useMemo(getDateFormatOptions, []);

  const onSubmitForm = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const confirmationResult = onConfirm ? await onConfirm() : true;

      if (!confirmationResult) {
        return;
      }

      reportInteraction('grafana_preferences_save_button_clicked', {
        preferenceType,
        theme: preferences.theme,
        language: preferences.language,
      });

      const updatePrefsCmd = {
        homeDashboardUID: preferences.homeDashboardUID,
        theme: preferences.theme as 'light' | 'dark' | 'system',
        timezone: preferences.timezone as 'utc' | 'browser',
        weekStart: preferences.weekStart,
        language: preferences.language,
        regionalFormat: preferences.regionalFormat,
        queryHistory: preferences.queryHistory,
        navbar: preferences.navbar,
      };

      try {
        await updatePrefs({ teamId: assertTeamId(preferenceType, teamId), updatePrefsCmd }).unwrap();
        window.location.reload();
      } catch (error) {
        // Error handling is done by RTK Query
      }
    },
    [
      onConfirm,
      preferenceType,
      preferences.theme,
      preferences.language,
      preferences.homeDashboardUID,
      preferences.timezone,
      preferences.weekStart,
      preferences.regionalFormat,
      preferences.queryHistory,
      preferences.navbar,
      updatePrefs,
      teamId,
    ]
  );

  const onThemeChanged = useCallback(
    (value: ComboboxOption<string>) => {
      setPreferences((prev) => ({ ...prev, theme: value.value }));
      reportInteraction('grafana_preferences_theme_changed', {
        toTheme: value.value,
        preferenceType,
      });

      if (value.value) {
        changeTheme(value.value, true);
      }
    },
    [preferenceType]
  );

  const onTimeZoneChanged = useCallback((timezone?: string) => {
    if (typeof timezone === 'string') {
      setPreferences((prev) => ({ ...prev, timezone }));
    }
  }, []);

  const onWeekStartChanged = useCallback((weekStart?: WeekStart) => {
    setPreferences((prev) => ({ ...prev, weekStart: weekStart ?? '' }));
  }, []);

  const onHomeDashboardChanged = useCallback((dashboardUID: string) => {
    setPreferences((prev) => ({ ...prev, homeDashboardUID: dashboardUID }));
  }, []);

  const onLanguageChanged = useCallback(
    (language: string) => {
      setPreferences((prev) => ({ ...prev, language }));
      reportInteraction('grafana_preferences_language_changed', {
        toLanguage: language,
        preferenceType,
      });
    },
    [preferenceType]
  );

  const onLocaleChanged = useCallback(
    (regionalFormat: string) => {
      setPreferences((prev) => ({ ...prev, regionalFormat }));
      reportInteraction('grafana_preferences_regional_format_changed', {
        toRegionalFormat: regionalFormat,
        preferenceType,
      });
    },
    [preferenceType]
  );

  const onDateFormatChanged = useCallback(
    (dateFormat: string) => {
      setPreferences((prev) => ({ ...prev, dateFormat }));
      reportInteraction('grafana_preferences_date_format_changed', {
        toDateFormat: dateFormat,
        preferenceType,
      });
    },
    [preferenceType]
  );

  const currentThemeOption = themeOptions.find((x) => x.value === preferences.theme) ?? themeOptions[0];

  // Determine submitting state based on preference type
  const submitting = isUpdatingPrefs;

  const { fullDatePreview, rangePreview } = React.useMemo(() => {
    const locale = preferences.regionalFormat || undefined;

    const baseOptions: Intl.DateTimeFormatOptions = {
      hour12: preferences.dateFormat === 'international' ? false : undefined,
      calendar: preferences.dateFormat === 'international' ? 'iso8601' : undefined,
    };

    const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
      ...baseOptions,
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const fullDateFormatter = new Intl.DateTimeFormat(locale, {
      ...baseOptions,
      dateStyle: 'full',
    });
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 7);

    const fullDatePreview = fullDateFormatter.format(start);
    const rangePreview = dateTimeFormatter.formatRange(start, today);

    return {
      fullDatePreview,
      rangePreview,
    };
  }, [preferences.regionalFormat, preferences.dateFormat]);

  return (
    <form onSubmit={onSubmitForm} className={styles.form}>
      <FieldSet label={<Trans i18nKey="shared-preferences.title">Preferences</Trans>} disabled={disabled}>
        <Field
          loading={isLoading}
          disabled={isLoading}
          label={t('shared-preferences.fields.theme-label', 'Interface theme')}
          description={
            config.featureToggles.grafanaconThemes && config.feedbackLinksEnabled ? (
              <Trans i18nKey="shared-preferences.fields.theme-description">
                Enjoying the experimental themes? Tell us what you'd like to see{' '}
                <TextLink
                  variant="bodySmall"
                  external
                  href="https://docs.google.com/forms/d/e/1FAIpQLSeRKAY8nUMEVIKSYJ99uOO-dimF6Y69_If1Q1jTLOZRWqK1cw/viewform?usp=dialog"
                >
                  here.
                </TextLink>
              </Trans>
            ) : undefined
          }
        >
          <Combobox
            options={themeOptions}
            value={currentThemeOption.value}
            onChange={onThemeChanged}
            id="shared-preferences-theme-select"
          />
        </Field>

        <Field
          loading={isLoading}
          disabled={isLoading}
          label={
            <Label htmlFor="home-dashboard-select">
              <span className={styles.labelText}>
                <Trans i18nKey="shared-preferences.fields.home-dashboard-label">Home Dashboard</Trans>
              </span>
            </Label>
          }
          data-testid="User preferences home dashboard drop down"
        >
          <DashboardPicker
            value={preferences.homeDashboardUID}
            onChange={(v) => onHomeDashboardChanged(v?.uid ?? '')}
            defaultOptions={true}
            isClearable={true}
            placeholder={t('shared-preferences.fields.home-dashboard-placeholder', 'Default dashboard')}
            inputId="home-dashboard-select"
          />
        </Field>

        <Field
          loading={isLoading}
          disabled={isLoading}
          label={t('shared-dashboard.fields.timezone-label', 'Timezone')}
          data-testid={selectors.components.TimeZonePicker.containerV2}
        >
          <TimeZonePicker
            includeInternal={true}
            value={preferences.timezone}
            onChange={onTimeZoneChanged}
            inputId="shared-preferences-timezone-picker"
          />
        </Field>

        <Field
          loading={isLoading}
          disabled={isLoading}
          label={t('shared-preferences.fields.week-start-label', 'Week start')}
          data-testid={selectors.components.WeekStartPicker.containerV2}
        >
          <WeekStartPicker
            value={preferences.weekStart && isWeekStart(preferences.weekStart) ? preferences.weekStart : undefined}
            onChange={onWeekStartChanged}
            inputId="shared-preferences-week-start-picker"
          />
        </Field>

        <Field
          loading={isLoading}
          disabled={isLoading}
          label={
            <Label htmlFor="language-preference-select">
              <span className={styles.labelText}>
                <Trans i18nKey="shared-preferences.fields.language-preference-label">Language</Trans>
              </span>
              <FeatureBadge featureState={FeatureState.preview} />
            </Label>
          }
          data-testid="User preferences language drop down"
        >
          <Combobox
            value={languageOptions.find((lang) => lang.value === preferences.language)?.value || ''}
            onChange={(lang: ComboboxOption | null) => onLanguageChanged(lang?.value ?? '')}
            options={languageOptions}
            placeholder={t('shared-preferences.fields.language-preference-placeholder', 'Choose language')}
            id="language-preference-select"
          />
        </Field>

        {config.featureToggles.localeFormatPreference && (
          <>
            <Field
              loading={isLoading}
              disabled={isLoading}
              label={
                <Label htmlFor="locale-preference">
                  <span className={styles.labelText}>
                    <Trans i18nKey="shared-preferences.fields.locale-preference-label">Region format</Trans>
                  </span>
                  <FeatureBadge featureState={FeatureState.preview} />
                </Label>
              }
              description={t(
                'shared-preferences.fields.locale-preference-description',
                'Choose your region to see the corresponding date, time, and number format'
              )}
              data-testid="User preferences locale drop down"
            >
              <Combobox
                value={regionalFormatOptions.find((loc) => loc.value === preferences.regionalFormat)?.value || ''}
                onChange={(locale: ComboboxOption | null) => onLocaleChanged(locale?.value ?? '')}
                options={regionalFormatOptions}
                placeholder={t('shared-preferences.fields.locale-preference-placeholder', 'Choose region')}
                id="locale-preference-select"
              />
            </Field>
            <Field
              loading={isLoading}
              disabled={isLoading}
              label={
                <Label htmlFor="date-format-preference">
                  <span className={styles.labelText}>
                    <Trans i18nKey="shared-preferences.fields.date-format-preference-label">Date format style</Trans>
                  </span>
                  <FeatureBadge featureState={FeatureState.preview} />
                </Label>
              }
              data-testid="User preferences date format"
            >
              <RadioButtonGroup
                value={preferences.dateFormat}
                onChange={(value) => onDateFormatChanged(value)}
                options={dateFormatOptions}
                id="date-format-preference"
              />
            </Field>

            <Card>
              <Card.Heading>
                <Trans i18nKey="shared-preferences.region-format-example">Region format example</Trans>
              </Card.Heading>
              <Card.Description>
                {fullDatePreview}
                <br />
                {rangePreview}
              </Card.Description>
            </Card>
          </>
        )}
      </FieldSet>
      <Button
        disabled={submitting}
        type="submit"
        variant="primary"
        data-testid={selectors.components.UserProfile.preferencesSaveButton}
      >
        <Trans i18nKey="common.save">Save</Trans>
      </Button>
    </form>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    labelText: css({
      marginRight: '6px',
    }),
    form: css({
      width: '100%',
      maxWidth: '600px',
    }),
  };
};

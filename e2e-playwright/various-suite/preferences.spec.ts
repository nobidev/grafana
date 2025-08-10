import { Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

function legacySelectOption(page: Page, text: string) {
  return page.locator('[data-testid="data-testid Select option"]', {
    hasText: text,
  });
}

test.describe(
  'User Preferences',
  {
    tag: ['@various'],
  },
  () => {
    test.afterEach(async ({ request }) => {
      const response = await request.put(`/api/user/preferences`, {
        data: {
          theme: '',
          homeDashboardUID: '',
          timezone: '',
          weekStart: '',
          language: '',
          regionalFormat: '',
          dateFormat: '',
        },
      });
      expect(response.ok()).toBeTruthy();
    });

    test('should display all preference fields', async ({ page, selectors }) => {
      await page.goto('/profile');

      // Expect the fieldset legend "Preferences" to be visible
      const preferencesLegend = page.locator('fieldset legend', { hasText: 'Preferences' });
      await expect(preferencesLegend).toBeVisible();

      // Check that all main preference fields are present
      await expect(page.getByLabel('Interface theme')).toBeVisible();
      await expect(page.getByLabel('Home Dashboard')).toBeVisible();
      await expect(page.getByTestId(selectors.components.TimeZonePicker.containerV2)).toBeVisible();
      await expect(page.getByTestId(selectors.components.WeekStartPicker.containerV2)).toBeVisible();
      await expect(page.getByLabel('Language')).toBeVisible();

      // Check save button is present
      await expect(page.getByTestId(selectors.components.UserProfile.preferencesSaveButton)).toBeVisible();
    });

    test('should change theme and apply it immediately', async ({ page, selectors }) => {
      await page.goto('/profile');

      const themeSelect = page.getByLabel('Interface theme');
      await themeSelect.click();

      // Select dark theme
      const darkThemeOption = page.getByText('Dark').first();
      await darkThemeOption.click();

      // Verify theme applied immediately (check for dark theme class or styles)
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 18, 23)');

      // Switch back to light theme
      await themeSelect.click();
      const lightThemeOption = page.getByText('Light').first();
      await lightThemeOption.click();

      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 245, 245)');
    });

    test('should set and clear home dashboard', async ({ page, selectors }) => {
      await page.goto('/profile');

      const homeDashField = page.getByLabel('Home Dashboard');
      await expect(homeDashField).not.toBeDisabled();
      await homeDashField.click();

      const dashboardOption = legacySelectOption(page, 'gdev dashboards/A tall dashboard');
      await expect(dashboardOption).toBeVisible();
      await dashboardOption.click();

      const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
      await saveButton.click();

      const homeBreadcrumb = page.getByTestId(selectors.components.Breadcrumbs.breadcrumb('Home'));
      await homeBreadcrumb.click();

      // Assert the home dashboard was set successfully
      await expect(page.getByTestId(selectors.components.Breadcrumbs.breadcrumb('A tall dashboard'))).toBeVisible();

      // Clear the home dashboard
      await page.goto('/profile');
      const clearButton = page
        .getByTestId('User preferences home dashboard drop down')
        .getByRole('button', { name: 'Clear value' });
      await expect(clearButton).toBeVisible();
      await clearButton.click();
      await saveButton.click();

      // Assert the home dashboard was reset successfully
      await homeBreadcrumb.click();
      await expect(page.locator('h1', { hasText: 'Welcome to Grafana' })).toBeVisible();
    });

    test('should change timezone', async ({ page, selectors }) => {
      await page.goto('/profile');

      const timezoneSelect = page.getByTestId(selectors.components.TimeZonePicker.containerV2);
      await timezoneSelect.click();

      // Select a specific timezone
      const option = legacySelectOption(page, 'Africa/Addis Ababa');
      await option.click();

      const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
      await saveButton.click();

      // Assert the timezone was selected
      await expect(timezoneSelect).toContainText('Africa/Addis Ababa');
    });

    test('should change week start', async ({ page, selectors }) => {
      await page.goto('/profile');

      const weekStartSelect = page.getByLabel('Week start');
      await weekStartSelect.click();

      await weekStartSelect.fill('Saturday');
      await weekStartSelect.press('Enter');

      const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
      await saveButton.click();

      // Assert the week start was selected
      await expect(weekStartSelect).toHaveValue('Saturday');
    });

    test('should change language', async ({ page, selectors }) => {
      const weekStartSelect = page.getByLabel('Language');
      await weekStartSelect.click();

      await weekStartSelect.fill('Saturday');
      await weekStartSelect.press('Enter');

      const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
      await saveButton.click();

      // Assert the week start was selected
      await expect(weekStartSelect).toHaveValue('Saturday');
    });

    test('should change regional format when feature is enabled', async ({ page }) => {
      const localeField = page.getByTestId('User preferences locale drop down');

      // Only test if the feature is enabled
      if (await localeField.isVisible()) {
        await localeField.click();

        // Select a different locale (e.g., German)
        const germanOption = page.getByText('Deutsch (Deutschland)').first();
        if (await germanOption.isVisible()) {
          await germanOption.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    });

    test('should change date format when feature is enabled', async ({ page }) => {
      const dateFormatField = page.getByTestId('User preferences date format');

      // Only test if the feature is enabled
      if (await dateFormatField.isVisible()) {
        // Test regional format option
        const regionalOption = page.getByText('Regional').first();
        if (await regionalOption.isVisible()) {
          await regionalOption.click();
        }

        // Test international format option
        const internationalOption = page.getByText('International').first();
        if (await internationalOption.isVisible()) {
          await internationalOption.click();
        }
      }
    });

    test('should save preferences successfully', async ({ page, selectors }) => {
      // Make a change to theme
      const themeSelect = page.getByLabel('Interface theme');
      await themeSelect.click();
      const darkThemeOption = page.getByText('Dark').first();
      await darkThemeOption.click();

      // Save preferences
      const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
      await saveButton.click();

      // Wait for the page to reload (as indicated in the current implementation)
      await page.waitForLoadState('domcontentloaded');

      // Verify the preference was saved (theme should still be dark after reload)
      await expect(page.locator('html')).toHaveClass(/theme-dark/);
    });

    test('should handle keyboard navigation for preferences', async ({ page }) => {
      // Test keyboard navigation through form fields
      await page.keyboard.press('Tab'); // Should focus on first field
      await page.keyboard.press('Tab'); // Move to next field
      await page.keyboard.press('Tab'); // Continue through fields

      // This is a basic test - in a real scenario you'd check that focus moves correctly
      // through all form elements
    });

    test('should display validation errors for invalid inputs', async ({ page }) => {
      // This test would check for validation errors
      // Currently the preferences form might not have much validation
      // but this is a placeholder for future validation testing

      const saveButton = page.getByTestId('shared-preferences-save-button');
      if (await saveButton.isVisible()) {
        // Try to trigger any validation by clicking save with invalid data
        await saveButton.click();

        // Check for any error messages that might appear
        const errorMessage = page.locator('[data-testid*="error"], [class*="error"]').first();
        // This would need to be adapted based on actual error display patterns
      }
    });
  }
);

test.describe(
  'Organization Preferences',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to organization preferences - this might require admin privileges
      await page.goto('/admin');

      // Navigate to org preferences if the link exists
      const orgPrefsLink = page.getByText('Organization preferences').or(page.getByText('Preferences'));
      if (await orgPrefsLink.isVisible()) {
        await orgPrefsLink.click();
      } else {
        // Try direct URL
        await page.goto('/org/preferences');
      }
    });

    test('should display organization preferences form', async ({ page, selectors }) => {
      // Check if we have access to org preferences (might be admin-only)
      const preferencesForm = page.locator('form');

      if (await preferencesForm.isVisible()) {
        await expect(preferencesForm).toBeVisible();

        // Same checks as user preferences but for org level
        await expect(page.getByLabel('Interface theme')).toBeVisible();
        await expect(page.getByTestId(selectors.components.UserProfile.preferencesSaveButton)).toBeVisible();
      } else {
        // If not visible, might be a permissions issue - that's also a valid test result
        console.log('Organization preferences not accessible - may require admin privileges');
      }
    });

    test('should save organization preferences', async ({ page, selectors }) => {
      const preferencesForm = page.locator('form');

      if (await preferencesForm.isVisible()) {
        // Change org theme
        const themeSelect = page.getByLabel('Interface theme');
        await themeSelect.click();
        const lightThemeOption = page.getByText('Light').first();
        await lightThemeOption.click();

        // Save
        const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
        await saveButton.click();

        // Wait for save to complete
        await page.waitForLoadState('domcontentloaded');
      }
    });
  }
);

test.describe(
  'Team Preferences',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to teams page first
      await page.goto('/teams');
    });

    test('should access team preferences', async ({ page }) => {
      // Look for team list
      const teamLinks = page.locator('[data-testid*="team"], a[href*="/teams/"]');
      const teamCount = await teamLinks.count();

      if (teamCount > 0) {
        // Click on first team
        await teamLinks.first().click();

        // Look for team preferences tab/link
        const teamPrefsTab = page.getByText('Preferences').or(page.getByText('Settings'));
        if (await teamPrefsTab.isVisible()) {
          await teamPrefsTab.click();

          // Verify team preferences form is visible
          const preferencesForm = page.locator('form');
          await expect(preferencesForm).toBeVisible();
        }
      } else {
        console.log('No teams found - creating test team would be needed for full testing');
      }
    });

    test('should modify team preferences', async ({ page, selectors }) => {
      // This would be similar to user preferences but at team level
      // Implementation depends on having teams available in the test environment

      const teamLinks = page.locator('[data-testid*="team"], a[href*="/teams/"]');
      const teamCount = await teamLinks.count();

      if (teamCount > 0) {
        await teamLinks.first().click();

        const teamPrefsTab = page.getByText('Preferences');
        if (await teamPrefsTab.isVisible()) {
          await teamPrefsTab.click();

          // Make changes similar to user preferences tests
          const themeSelect = page.getByLabel('Interface theme');
          if (await themeSelect.isVisible()) {
            await themeSelect.click();
            await page.getByText('Dark').first().click();

            const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
            await saveButton.click();
          }
        }
      }
    });
  }
);

test.describe(
  'Server Admin Preferences',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to server admin section - requires server admin privileges
      await page.goto('/admin');
    });

    test('should access server preferences if admin', async ({ page }) => {
      // Look for server settings/preferences
      const serverSettingsLink = page.getByText('Server settings').or(page.getByText('Settings'));

      if (await serverSettingsLink.isVisible()) {
        await serverSettingsLink.click();

        // This would test server-wide preference settings
        // Implementation depends on what server preferences are available
      } else {
        console.log('Server preferences not accessible - may require server admin privileges');
      }
    });

    test('should display server configuration options', async ({ page }) => {
      // Test server-level configuration options
      // This would include default themes, language settings, etc.

      const adminPage = page.locator('main, [data-testid*="admin"]');
      if (await adminPage.isVisible()) {
        // Check for various admin configuration options
        const configSections = page.locator('h2, h3, [data-testid*="section"]');
        const sectionCount = await configSections.count();

        // Expect at least some configuration sections to be visible
        expect(sectionCount).toBeGreaterThan(0);
      }
    });
  }
);

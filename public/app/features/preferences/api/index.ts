import { generatedAPI } from './user/endpoints.gen';

export type { PreferencesSpec } from './user/endpoints.gen';
export const {
  useGetUserPreferencesQuery,
  useGetTeamPreferencesQuery,
  useGetOrgPreferencesQuery,

  usePatchUserPreferencesMutation,
  usePatchOrgPreferencesMutation,

  useUpdateUserPreferencesMutation,
  useUpdateTeamPreferencesMutation,
  useUpdateOrgPreferencesMutation,
} = generatedAPI;

export const userPreferencesAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['UserPreferences'],
  endpoints: {
    getUserPreferences: {
      providesTags: ['UserPreferences'],
    },
    updateUserPreferences: {
      invalidatesTags: ['UserPreferences'],
    },
    patchUserPreferences: {
      invalidatesTags: ['UserPreferences'],
    },
  },
});

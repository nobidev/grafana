import { AlertingApiExtraOptions } from 'app/features/alerting/unified/api/alertingApi';
import { generatedReceiversApi } from 'app/features/alerting/unified/openapi/receiversApi.gen';

export const receiversApi = generatedReceiversApi.enhanceEndpoints({
  endpoints: {
    createReceiver: {
      invalidatesTags: ['Receiver', 'ContactPoint', 'ContactPointsStatus', 'AlertmanagerConfiguration'],
    },
    // Add the content-type header, as otherwise the inner workings of
    // backend_srv will not realise the body is supposed to be JSON
    // and will incorrectly serialise the body as URLSearchParams
    deleteReceiver: (endpoint) => {
      const originalQuery = endpoint.query;
      endpoint.query = (...args) => {
        const baseQuery = originalQuery!(...args);
        baseQuery.headers = {
          'content-type': 'application/json',
        };
        return baseQuery;
      };
    },
    getReceiver: (endpoint) => {
      const extraOptions: AlertingApiExtraOptions = { hideErrorMessage: true };
      endpoint.extraOptions = extraOptions;
    },
  },
});

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { useLogListContext } from './LogListContext';
import { store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

export interface LogListSearchContextData {
  caseSensitive: boolean;
  hideSearch: () => void;
  filterLogs: boolean;
  matchingUids: string[] | null;
  search?: string;
  searchVisible?: boolean;
  setCaseSensitivity: (state: boolean) => void;
  setMatchingUids: (matches: string[] | null) => void;
  setSearch: (search: string | undefined) => void;
  showSearch: () => void;
  toggleFilterLogs: () => void;
}

export const LogListSearchContext = createContext<LogListSearchContextData>({
  caseSensitive: false,
  hideSearch: () => {},
  filterLogs: false,
  matchingUids: null,
  searchVisible: false,
  setCaseSensitivity: () => {},
  setMatchingUids: () => {},
  setSearch: () => {},
  showSearch: () => {},
  toggleFilterLogs: () => {},
});

export const useLogListSearchContextData = (key: keyof LogListSearchContextData) => {
  const data: LogListSearchContextData = useContext(LogListSearchContext);
  return data[key];
};

export const useLogListSearchContext = (): LogListSearchContextData => {
  return useContext(LogListSearchContext);
};

export const LogListSearchContextProvider = ({ children }: { children: ReactNode }) => {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [searchVisible, setSearchVisible] = useState(false);
  const [matchingUids, setMatchingUids] = useState<string[] | null>(null);
  const [filterLogs, setFilterLogs] = useState(false);
  const { logOptionsStorageKey } = useLogListContext();
  const [caseSensitive, setCaseSensitive] = useState(
    store.getBool(`${logOptionsStorageKey}.search.caseSensitive`, false)
  );

  const hideSearch = useCallback(() => {
    setSearchVisible(false);
  }, []);

  const setCaseSensitivity = useCallback(
    (state: boolean) => {
      reportInteraction('logs_log_list_search_case_sensitivity_toggled', {
        state,
      });
      setCaseSensitive(state);
      store.set(`${logOptionsStorageKey}.search.caseSensitive`, state);
    },
    [logOptionsStorageKey]
  );

  const showSearch = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const toggleFilterLogs = useCallback(() => {
    setFilterLogs((filterLogs) => !filterLogs);
  }, []);

  return (
    <LogListSearchContext.Provider
      value={{
        caseSensitive,
        hideSearch,
        filterLogs,
        matchingUids,
        search,
        searchVisible,
        setCaseSensitivity,
        setMatchingUids,
        setSearch,
        showSearch,
        toggleFilterLogs,
      }}
    >
      {children}
    </LogListSearchContext.Provider>
  );
};

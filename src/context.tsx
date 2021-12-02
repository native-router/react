import {createContext, ReactNode, useContext} from 'react';

const ViewContext = createContext<ReactNode>(null);

export function ViewProvider(props: {children: ReactNode; value: ReactNode}) {
  return <ViewContext.Provider {...props} />;
}

export function useView() {
  return useContext(ViewContext);
}

export function View() {
  const view = useView();
  return <>{view}</>;
}

const DataContext = createContext<[any, Record<string, any>]>([undefined, {}]);

export function useDataContext() {
  return useContext(DataContext);
}

export function useNamedData() {
  return useDataContext()[1];
}

export function DataProvider({
  children,
  name,
  data
}: {
  children: ReactNode;
  data: any;
  name?: string;
}) {
  const namedData = useNamedData();
  return (
    <DataContext.Provider
      value={[data, name ? {...namedData, [name]: data} : namedData]}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(name?: string) {
  const [data, namedData] = useDataContext();
  return name ? namedData[name] : data;
}

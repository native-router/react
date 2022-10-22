import {createContext, ReactNode, useContext, useState} from 'react';
import type {StateContext} from './types';

export function createStateContext<S>(
  initialState: S | (() => S)
): StateContext<S>;
export function createStateContext<S = undefined>(): StateContext<
  S | undefined
>;
export function createStateContext<S = undefined>(
  ...params: [] | [S | (() => S)]
): StateContext<S> | StateContext<S | undefined> {
  const ValueContext = createContext<S | undefined>(undefined);
  const SetterContext = createContext<((value: S) => void) | undefined>(
    undefined
  );

  function Provider({children}: {children: ReactNode}) {
    const [value, setValue] = useState<S>(...(params as []));
    return (
      <SetterContext.Provider value={setValue}>
        <ValueContext.Provider value={value}>{children}</ValueContext.Provider>
      </SetterContext.Provider>
    );
  }

  return {SetterContext, ValueContext, Provider};
}

export function useValueContext<S>(Ctx: StateContext<S>): S {
  return useContext(Ctx.ValueContext)!;
}

export function useSetterContext<S>(Ctx: StateContext<S>): (v: S) => void {
  return useContext(Ctx.SetterContext)!;
}

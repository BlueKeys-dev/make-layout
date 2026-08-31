import { useState, useCallback, useRef } from 'react';

export function useHistory<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<T[]>([initialState]);
  const currentIndexRef = useRef<number>(0);

  const setWithHistory = useCallback((newStateOrUpdater: T | ((prev: T) => T), shouldPush = true) => {
    setState((prev) => {
      const nextState = typeof newStateOrUpdater === 'function' 
        ? (newStateOrUpdater as (prev: T) => T)(prev) 
        : newStateOrUpdater;

      if (shouldPush && JSON.stringify(prev) !== JSON.stringify(nextState)) {
        const newHistory = historyRef.current.slice(0, currentIndexRef.current + 1);
        newHistory.push(nextState);
        
        // Limit history to 50 steps
        if (newHistory.length > 50) {
          newHistory.shift();
        } else {
          currentIndexRef.current++;
        }
        
        historyRef.current = newHistory;
      }
      
      return nextState;
    });
  }, []);

  const undo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current--;
      const prevState = historyRef.current[currentIndexRef.current];
      setState(prevState);
      return prevState;
    }
    return null;
  }, []);

  const redo = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current++;
      const nextState = historyRef.current[currentIndexRef.current];
      setState(nextState);
      return nextState;
    }
    return null;
  }, []);

  return {
    state,
    setState: setWithHistory,
    undo,
    redo,
    canUndo: currentIndexRef.current > 0,
    canRedo: currentIndexRef.current < historyRef.current.length - 1,
  };
}

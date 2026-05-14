import { createContext, useContext } from 'react';

export const PagesContext = createContext([]);
export const usePagesContext = () => useContext(PagesContext);

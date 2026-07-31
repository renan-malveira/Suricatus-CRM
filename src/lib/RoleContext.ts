import { createContext, useContext } from 'react';
import type { Role } from './types';

export const RoleContext = createContext<Role>('editor');

export const useRole = (): Role => useContext(RoleContext);

/** Editores e admins podem escrever; leitores só visualizam. */
export const usePodeEscrever = (): boolean => useRole() !== 'leitor';

import { useQuery } from "@tanstack/react-query";
import { Action, App } from "../lib/access";
import { Context, Services } from "../lib/tabs";
import { http } from "./http";

export interface Me {
  userId: string;
  structureIds: string[];
  structureNames: string[];
  actions: Action[];
  apps: App[];
  superAdmin: boolean;
}

interface UserInfo {
  userId: string;
  structures?: string[];
  structureNames?: string[];
  authorizedActions?: Action[];
  apps?: App[];
  functions?: Record<string, unknown>;
}

/** Identité, établissements, droits et applications de l'usager connecté. */
export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    staleTime: Infinity,
    queryFn: async (): Promise<Me> => {
      const u = await http().get<UserInfo>("/auth/oauth2/userinfo");
      return {
        userId: u.userId,
        structureIds: u.structures ?? [],
        structureNames: u.structureNames ?? [],
        actions: u.authorizedActions ?? [],
        apps: u.apps ?? [],
        superAdmin: !!u.functions && "SUPER_ADMIN" in u.functions,
      };
    },
  });

/** Services activés sur la plateforme, posés par la vue (`window.vscoServices`). */
export const platformServices = (): Services =>
  (window as unknown as { vscoServices?: Services }).vscoServices ?? {};

export const contextOf = (me: Me | undefined): Context => ({
  actions: me?.actions,
  apps: me?.apps,
  superAdmin: me?.superAdmin,
  services: platformServices(),
});

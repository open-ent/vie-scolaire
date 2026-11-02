import { odeServices } from "@open-ent/client";

export const http = () => odeServices.http();

/** Entête JSON explicite : sans lui, certaines routes de la plateforme refusent le corps. */
export const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

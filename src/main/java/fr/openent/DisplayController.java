/*
 * Copyright (c) Région Hauts-de-France, Département de la Seine-et-Marne, Région Nouvelle Aquitaine, Mairie de Paris, CGI, 2016.
 * This file is part of OPEN ENT NG. OPEN ENT NG is a versatile ENT Project based on the JVM and ENT Core Project.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation (version 3 of the License).
 * For the sake of explanation, any module that communicate over native
 * Web protocols, such as HTTP, with OPEN ENT NG is outside the scope of this
 * license and could be license under its own terms. This is merely considered
 * normal use of OPEN ENT NG, and does not fall under the heading of "covered work".
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

package fr.openent;

import fr.wseduc.rs.ApiDoc;
import fr.wseduc.rs.Get;
import fr.wseduc.security.SecuredAction;
import io.vertx.core.json.JsonObject;
import org.entcore.common.controller.ControllerHelper;
import io.vertx.core.http.HttpServerRequest;

import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import org.entcore.common.neo4j.Neo4j;
import org.entcore.common.user.UserUtils;
import org.entcore.common.events.EventHelper;
import org.entcore.common.events.EventStore;
import org.entcore.common.events.EventStoreFactory;

public class DisplayController extends ControllerHelper {

    private EventHelper eventHelper;

    public DisplayController(){
        pathPrefix = "";
        final EventStore eventStore = EventStoreFactory.getFactory().getEventStore(Viescolaire.class.getSimpleName());
		this.eventHelper =  new EventHelper(eventStore);
    }

    @Get(Viescolaire.VSCO_PATHPREFIX)
    @ApiDoc("Get Vie Scolaire HTML view")
    @SecuredAction(value = "Viescolaire.view")
    public void view(final HttpServerRequest request) {
        JsonObject services = config.getJsonObject("services", new JsonObject());
        JsonObject params = new JsonObject()
                .put("ENABLE_COMPETENCES", services.getBoolean("competences", false))
                .put("ENABLE_PRESENCES", services.getBoolean("presences", false))
                .put("ENABLE_DIARY", services.getBoolean("diary", false))
                .put("ENABLE_EDT", services.getBoolean("edt", false))
                .put("ENABLE_MASSMAILING", services.getBoolean("massmailing", false))
                .put("ENABLE_INCIDENTS", services.getBoolean("incidents", false));
        withUi(request, ui -> {
            if ("react".equals(ui)) {
                renderView(request, params, "viescolaire/vsco_react.html", null);
            } else {
                renderView(request, params, "viescolaire/vsco_personnel.html", null);
            }
        });
        eventHelper.onAccess(request);
    }

    /**
     * IHM servie par défaut, en l'absence de choix de l'usager : React, sauf si la plateforme demande {@code frontend-ui: angular}.
     * L'ancienne interface s'obtient par {@code ?ui=angular} ou par la préférence de l'usager.
     */
    static String platformUi(final JsonObject config) {
        return "angular".equals(config.getString("frontend-ui")) ? "angular" : "react";
    }

    /** Clé de préférence usager portant le choix d'IHM. */
    private static final String UI_PREFERENCE = "viescolaireUi";

    /** `?ui=react|angular` dans l'adresse, sinon la préférence de l'usager, sinon le défaut de la plateforme. */
    private void withUi(final HttpServerRequest request, final Handler<String> handler) {
        final String platform = platformUi(config);
        final String forced = request.getParam("ui");
        if ("react".equals(forced) || "angular".equals(forced)) {
            handler.handle(forced);
            return;
        }
        UserUtils.getUserInfos(eb, request, user -> {
            if (user == null) {
                handler.handle(platform);
                return;
            }
            // Syntaxe OpenCypher (`$userId`, ArcadeDB) d'abord ; un Neo4j épinglé en Cypher 2.3 la refuse : on retente avec l'ancienne.
            final String tail = "-[:PREFERS]->(uac:UserAppConf) RETURN uac." + UI_PREFERENCE + " AS preference";
            final JsonObject queryParams = new JsonObject().put("userId", user.getUserId());
            try {
                final Neo4j neo4j = Neo4j.getInstance();
                neo4j.execute("MATCH (:User {id: $userId})" + tail, queryParams, message -> {
                    if (isOk(message.body())) {
                        handler.handle(readUi(message.body(), platform));
                    } else {
                        neo4j.execute("MATCH (:User {id:{userId}})" + tail, queryParams, legacy -> handler.handle(readUi(legacy.body(), platform)));
                    }
                });
            } catch (Exception e) {
                handler.handle(platform);
            }
        });
    }

    /** Une réponse Neo4j réussie porte « status: ok ». */
    static boolean isOk(JsonObject body) {
        return body != null && "ok".equals(body.getString("status"));
    }

    /** Extrait le choix d'IHM du résultat Neo4j — la préférence y est rangée en CHAÎNE JSON, ex. {"ui":"react"}. */
    static String readUi(JsonObject body, String platformUi) {
        try {
            final JsonArray rows = body.getJsonArray("result", new JsonArray());
            if (rows.isEmpty()) return platformUi;
            final String raw = rows.getJsonObject(0).getString("preference");
            if (raw == null || raw.trim().isEmpty()) return platformUi;
            final String ui = new JsonObject(raw).getString("ui");
            return ("react".equals(ui) || "angular".equals(ui)) ? ui : platformUi;
        } catch (Exception e) {
            return platformUi;
        }
    }
}
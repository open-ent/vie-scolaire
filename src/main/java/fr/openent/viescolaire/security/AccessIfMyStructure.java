package fr.openent.viescolaire.security;

import fr.wseduc.webutils.http.Binding;
import io.vertx.core.Handler;
import io.vertx.core.http.HttpServerRequest;
import org.entcore.common.http.filter.ResourcesProvider;
import org.entcore.common.user.UserInfos;

/**
 * Autorise l'accès si la structure demandée fait partie des établissements de rattachement de
 * l'utilisateur ({@link UserInfos#getStructures()}), OU si elle est comprise dans le périmètre
 * (scope) d'une de ses fonctions transversales (ex. ADMIN_INSPECTION, ADMIN_COLLECTIVITE).
 *
 * Sans ce second cas, un inspecteur rattaché académiquement au rectorat (et non membre de
 * l'établissement inspecté) ne pourrait jamais consulter les périodes/classes de cet
 * établissement, alors que sa fonction lui donne précisément ce droit transversal
 * (cf. `creer_fonctions_transversales_sdet.py`).
 */
public class AccessIfMyStructure implements ResourcesProvider {
    @Override
    public void authorize(HttpServerRequest request, Binding binding, UserInfos user, Handler<Boolean> handler) {
        String structureId = WorkflowActionUtils.getParamStructure(request);
        if (structureId == null) {
            handler.handle(false);
            return;
        }
        if (user.getStructures() != null && user.getStructures().contains(structureId)) {
            handler.handle(true);
            return;
        }
        if (user.getFunctions() != null) {
            for (UserInfos.Function function : user.getFunctions().values()) {
                if (function.getScope() != null && function.getScope().contains(structureId)) {
                    handler.handle(true);
                    return;
                }
            }
        }
        handler.handle(false);
    }
}

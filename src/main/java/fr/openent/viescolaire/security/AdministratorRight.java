package fr.openent.viescolaire.security;

import fr.wseduc.webutils.http.Binding;
import io.vertx.core.Handler;
import io.vertx.core.http.HttpServerRequest;
import org.entcore.common.http.filter.ResourcesProvider;
import org.entcore.common.user.UserInfos;

import static org.entcore.common.user.DefaultFunctions.SUPER_ADMIN;

/**
 * Concerne uniquement les droits pour viescolaire et competences
 */
public class AdministratorRight implements ResourcesProvider {
    @Override
    public void authorize(HttpServerRequest resourceRequest, Binding binding, UserInfos user, Handler<Boolean> handler) {
        // Un super-admin (ADMC) n'est pas nécessairement rattaché à la structure ciblée
        // (user.getStructures() ne le liste pas forcément) — même contournement que
        // modules/statistics/.../StatsResourceProvider.java, pattern standard entcore.
        if (user.getFunctions().containsKey(SUPER_ADMIN)) {
            handler.handle(true);
            return;
        }
        String structureId = WorkflowActionUtils.getParamStructure(resourceRequest);
        boolean allowViesco = WorkflowActionUtils.hasRight(user, WorkflowActions.ADMIN_RIGHT.toString());
        handler.handle( structureId != null && user.getStructures().contains(structureId) && allowViesco);
    }
}

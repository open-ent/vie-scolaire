package fr.openent.viescolaire.security;

import fr.openent.Viescolaire;
import fr.wseduc.webutils.http.Binding;
import io.vertx.core.Handler;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.http.filter.ResourcesProvider;
import org.entcore.common.sql.Sql;
import org.entcore.common.sql.SqlResult;
import org.entcore.common.user.UserInfos;

import static org.entcore.common.user.DefaultFunctions.ADMIN_LOCAL;
import static org.entcore.common.user.DefaultFunctions.SUPER_ADMIN;

/**
 * Modifier une période désignée par son identifiant (`:id`) : réservé à qui administre
 * l'établissement de la période — le droit d'administration de la vie scolaire, comme
 * `PUT /periodes` ({@link AdminRightStructure}), ou la fonction ADML sur cet établissement (les
 * utilisateurs du tableau de bord) —, et au super-admin. L'établissement est lu sur la période.
 */
public class AdminRightPeriode implements ResourcesProvider {
    private static final Logger log = LoggerFactory.getLogger(AdminRightPeriode.class);

    @Override
    public void authorize(final HttpServerRequest request, Binding binding, final UserInfos user, final Handler<Boolean> handler) {
        if (user.getFunctions() != null && user.getFunctions().containsKey(SUPER_ADMIN)) {
            handler.handle(true);
            return;
        }
        final long idPeriode;
        try {
            idPeriode = Long.parseLong(request.params().get("id"));
        } catch (NumberFormatException e) {
            handler.handle(false);
            return;
        }
        request.pause();
        String query = "SELECT id_etablissement FROM " + Viescolaire.VSCO_SCHEMA + ".periode WHERE id = ?";
        Sql.getInstance().prepared(query, new JsonArray().add(idPeriode), SqlResult.validUniqueResultHandler(result -> {
            request.resume();
            if (result.isLeft()) {
                log.error("[Viescolaire@AdminRightPeriode] " + result.left().getValue());
                handler.handle(false);
                return;
            }
            JsonObject periode = result.right().getValue();
            String structureId = periode == null ? null : periode.getString("id_etablissement");
            handler.handle(structureId != null && (isViescoAdmin(user, structureId) || isLocalAdmin(user, structureId)));
        }));
    }

    private static boolean isViescoAdmin(UserInfos user, String structureId) {
        return user.getStructures().contains(structureId) && WorkflowActionUtils.hasRight(user, WorkflowActionUtils.ADMIN_RIGHT);
    }

    private static boolean isLocalAdmin(UserInfos user, String structureId) {
        if (user.getFunctions() == null) return false;
        UserInfos.Function adml = user.getFunctions().get(ADMIN_LOCAL);
        return adml != null && adml.getScope() != null && adml.getScope().contains(structureId);
    }
}

package fr.openent.viescolaire.service;

import io.vertx.core.Future;
import io.vertx.core.buffer.Buffer;

public interface TrombinoscopeExportService {

    /**
     * Export the trombinoscope pictures grid.
     *
     * @param structureId    Structure identifier
     * @param scope          "structure", "classe" or "groupe"
     * @param scopeId        Class or group identifier (ignored when scope is "structure")
     * @param scopeName      Display name of the class/group, used for titles and file names (optional)
     * @param format         "html" or "pdf"
     * @param tempFolderRoot Root folder used to build the temporary directory needed for the "structure" scope
     * @return {@link Future} of the exported content: HTML/PDF bytes for "classe"/"groupe" scope,
     * a ZIP archive (one file per class) for "structure" scope
     */
    Future<Buffer> export(String structureId, String scope, String scopeId, String scopeName, String format, String tempFolderRoot);
}

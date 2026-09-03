package fr.openent.viescolaire.service.impl;

import fr.openent.viescolaire.service.ClasseService;
import fr.openent.viescolaire.service.TrombinoscopeExportService;
import fr.openent.viescolaire.service.TrombinoscopeService;
import fr.wseduc.webutils.template.FileTemplateProcessor;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.pdf.PdfGenerator;
import org.entcore.common.storage.Storage;
import org.entcore.common.utils.Zip;

import java.io.File;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.Deflater;

public class DefaultTrombinoscopeExportService implements TrombinoscopeExportService {

    private static final Logger log = LoggerFactory.getLogger(DefaultTrombinoscopeExportService.class);

    private final Vertx vertx;
    private final Storage storage;
    private final ClasseService classeService;
    private final TrombinoscopeService trombinoscopeService;
    private final PdfGenerator pdfGenerator;
    private final FileTemplateProcessor templateProcessor;

    private static final String EXPORT_TEMPLATE = "trombinoscope/export/trombinoscope-export.txt";

    public DefaultTrombinoscopeExportService(Vertx vertx, Storage storage, ClasseService classeService,
                                             TrombinoscopeService trombinoscopeService, PdfGenerator pdfGenerator) {
        this.vertx = vertx;
        this.storage = storage;
        this.classeService = classeService;
        this.trombinoscopeService = trombinoscopeService;
        this.pdfGenerator = pdfGenerator;
        this.templateProcessor = new FileTemplateProcessor(vertx, "template/", false);
        this.templateProcessor.escapeHTML(false);
    }

    @Override
    public Future<Buffer> export(String structureId, String scope, String scopeId, String scopeName, String format,
                                 String tempFolderRoot) {
        if ("structure".equals(scope)) {
            return exportStructureZip(structureId, format, tempFolderRoot);
        }

        String title = (scopeName != null && !scopeName.isEmpty()) ? scopeName : scopeId;
        return resolveStudents(scopeId)
                .compose(students -> renderAudienceHtml(structureId, title, students))
                .compose(html -> "pdf".equals(format) ? toPdf(title, html) : Future.succeededFuture(Buffer.buffer(html, "UTF-8")));
    }

    /**
     * Fetch students of a class or a group, agnostic of the audience type (Class / FunctionalGroup / ManualGroup).
     */
    private Future<JsonArray> resolveStudents(String scopeId) {
        Promise<JsonArray> promise = Promise.promise();
        classeService.getEleveClasse(scopeId, null, either -> {
            if (either.isLeft()) {
                promise.fail(either.left().getValue());
            } else {
                promise.complete(either.right().getValue());
            }
        });
        return promise.future();
    }

    /**
     * Render the photo grid (title + students) as HTML, embedding each picture inline as a base64 data URI
     * since the external PDF rendering service has no access to the ENT storage/session.
     */
    private Future<String> renderAudienceHtml(String structureId, String title, JsonArray students) {
        List<String> studentIds = new ArrayList<>();
        for (Object o : students) {
            studentIds.add(((JsonObject) o).getString("id"));
        }

        Promise<Map<String, String>> picturesPromise = Promise.promise();
        trombinoscopeService.getPicturesByStudentIds(structureId, studentIds, picturesPromise);

        return picturesPromise.future().compose(pictures -> {
            JsonArray studentViews = new JsonArray();
            List<Future<Void>> photoFutures = new ArrayList<>();

            for (Object o : students) {
                JsonObject student = (JsonObject) o;
                String firstName = student.getString("firstName");
                String lastName = student.getString("lastName");
                String pictureId = pictures.get(student.getString("id"));

                JsonObject view = new JsonObject()
                        .put("firstName", firstName)
                        .put("lastName", lastName)
                        .put("initial", initials(firstName, lastName));
                studentViews.add(view);

                if (pictureId != null) {
                    Promise<Void> photoPromise = Promise.promise();
                    photoFutures.add(photoPromise.future());
                    storage.readFile(pictureId, buffer -> {
                        if (buffer != null && buffer.length() > 0) {
                            view.put("photoBase64Uri", toDataUri(buffer));
                        }
                        photoPromise.complete();
                    });
                }
            }

            return Future.join(photoFutures).compose(done -> {
                JsonObject params = new JsonObject().put("title", title).put("students", studentViews);
                Promise<String> htmlPromise = Promise.promise();
                templateProcessor.processTemplate(EXPORT_TEMPLATE, params, html -> {
                    if (html == null) {
                        htmlPromise.fail("[Viescolaire@DefaultTrombinoscopeExportService::renderAudienceHtml] failed to render template");
                    } else {
                        htmlPromise.complete(html);
                    }
                });
                return htmlPromise.future();
            });
        });
    }

    private Future<Buffer> toPdf(String name, String html) {
        Promise<Buffer> promise = Promise.promise();
        if (pdfGenerator == null) {
            promise.fail("[Viescolaire@DefaultTrombinoscopeExportService::toPdf] pdf generator unavailable");
            return promise.future();
        }
        pdfGenerator.generatePdfFromTemplate(sanitizeFilename(name) + ".pdf", html, ar -> {
            if (ar.succeeded()) {
                promise.complete(ar.result().getContent());
            } else {
                promise.fail(ar.cause());
            }
        });
        return promise.future();
    }

    /**
     * Export every class of the structure, one HTML/PDF file per class, zipped into a single archive.
     */
    private Future<Buffer> exportStructureZip(String structureId, String format, String tempFolderRoot) {
        Promise<JsonArray> classesPromise = Promise.promise();
        classeService.listClasses(structureId, true, null, null, false, either -> {
            if (either.isLeft()) {
                classesPromise.fail(either.left().getValue());
            } else {
                classesPromise.complete(either.right().getValue());
            }
        }, false);

        return classesPromise.future().compose(rawClasses -> {
            List<JsonObject> classes = new ArrayList<>();
            for (Object o : rawClasses) {
                JsonObject node = ((JsonObject) o).getJsonObject("m");
                if (node != null && node.getJsonObject("data") != null) {
                    classes.add(node.getJsonObject("data"));
                }
            }

            String extension = "pdf".equals(format) ? ".pdf" : ".html";
            String tempDir = tempFolderRoot + File.separator + "trombinoscope-export-" + UUID.randomUUID();

            List<Future<Void>> writeFutures = new ArrayList<>();
            for (JsonObject classe : classes) {
                String className = classe.getString("name");
                writeFutures.add(
                        resolveStudents(classe.getString("id"))
                                .compose(students -> renderAudienceHtml(structureId, className, students))
                                .compose(html -> "pdf".equals(format) ? toPdf(className, html) : Future.succeededFuture(Buffer.buffer(html, "UTF-8")))
                                .compose(content -> writeExportFile(tempDir, sanitizeFilename(className) + extension, content))
                );
            }

            return Future.join(writeFutures)
                    .compose(done -> zipFolder(tempDir))
                    .compose(this::readAndCleanupZip);
        });
    }

    private Future<Void> writeExportFile(String dir, String filename, Buffer content) {
        Promise<Void> promise = Promise.promise();
        vertx.fileSystem().mkdirs(dir, mkdir -> {
            if (mkdir.failed()) {
                promise.fail(mkdir.cause());
                return;
            }
            vertx.fileSystem().writeFile(dir + File.separator + filename, content, write -> {
                if (write.failed()) {
                    promise.fail(write.cause());
                } else {
                    promise.complete();
                }
            });
        });
        return promise.future();
    }

    private Future<String> zipFolder(String tempDir) {
        Promise<String> promise = Promise.promise();
        String zipPath = tempDir + ".zip";
        Zip.getInstance().zipFolder(tempDir, zipPath, true, Deflater.BEST_COMPRESSION, message -> {
            if (message.body() != null && "ok".equals(message.body().getString("status"))) {
                promise.complete(message.body().getString("destZip", zipPath));
            } else {
                String error = message.body() != null ? message.body().getString("message", "zip failed") : "zip failed";
                promise.fail("[Viescolaire@DefaultTrombinoscopeExportService::zipFolder] " + error);
            }
        });
        return promise.future();
    }

    private Future<Buffer> readAndCleanupZip(String zipPath) {
        Promise<Buffer> promise = Promise.promise();
        vertx.fileSystem().readFile(zipPath, read -> {
            vertx.fileSystem().delete(zipPath, del -> {
                if (del.failed()) {
                    log.error("[Viescolaire@DefaultTrombinoscopeExportService::readAndCleanupZip] Failed to delete temp zip file", del.cause());
                }
            });
            if (read.failed()) {
                promise.fail(read.cause());
            } else {
                promise.complete(read.result());
            }
        });
        return promise.future();
    }

    private String toDataUri(Buffer buffer) {
        byte[] bytes = buffer.getBytes();
        return "data:" + sniffMimeType(bytes) + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    private String sniffMimeType(byte[] bytes) {
        if (bytes.length >= 2 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) {
            return "image/jpeg";
        }
        if (bytes.length >= 4 && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') {
            return "image/png";
        }
        if (bytes.length >= 2 && bytes[0] == 'B' && bytes[1] == 'M') {
            return "image/bmp";
        }
        return "image/jpeg";
    }

    private String initials(String firstName, String lastName) {
        StringBuilder sb = new StringBuilder();
        if (firstName != null && !firstName.isEmpty()) {
            sb.append(Character.toUpperCase(firstName.charAt(0)));
        }
        if (lastName != null && !lastName.isEmpty()) {
            sb.append(Character.toUpperCase(lastName.charAt(0)));
        }
        return sb.toString();
    }

    private String sanitizeFilename(String name) {
        if (name == null || name.isEmpty()) {
            return "trombinoscope";
        }
        return name.replaceAll("[^a-zA-Z0-9-_. ]", "_");
    }
}

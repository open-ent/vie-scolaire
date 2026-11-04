/*
 * Copyright (c) Région Hauts-de-France, Département 77, CGI, 2016.
 *
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
 *
 */

var gulp = require("gulp");
var webpack = require("webpack-stream");
var rev = require("gulp-rev");
const replace = require("gulp-replace");
var clean = require("gulp-clean");
var sourcemaps = require("gulp-sourcemaps");
var fs = require("fs");
var path = require("path");
var Transform = require("stream").Transform;

var paths = {
  infra: "./bower_components/entcore",
  toolkit: "../toolkit",
};

var DIST = "./src/main/resources/public/dist/";

gulp.task("drop-cache", function () {
  return gulp
    .src(["./src/main/resources/public/dist", "./manifests/*"], { read: false, allowEmpty: true })
    .pipe(clean());
});

// Polices binaires : sans encoding:false, gulp 5 les relit en UTF-8 et les corrompt en silence.
gulp.task("copy-mdi-font", gulp.series("drop-cache", function () {
  return gulp
    .src("./node_modules/@mdi/font/fonts/*", { encoding: false })
    .pipe(gulp.dest("./src/main/resources/public/font/material-design/fonts"));
}));

// Appel direct du webpack embarqué par webpack-stream (webpack 1, celui qui a toujours produit
// les bundles) : ses flux « through » ne se raccordent pas à ceux de gulp 5. Les erreurs de
// typage restent signalées sans interrompre le build, comme sous gulp 3.
function webpackVsco(done) {
  var config = require("./src/main/resources/public/modules/viescolaire/webpack.config.vsco.js");
  config.output.path = path.resolve(__dirname, DIST);
  webpack.webpack(config, function (err, stats) {
    if (stats) console.log(stats.toString({ colors: false, chunks: false }));
    done(err);
  });
}

// Empreintes gulp-rev rejouées sur les sorties de webpack (bundles ET cartes, comme le flux
// webpack-stream d'avant) : mêmes fichiers empreintés dans dist/ et même manifests/vsco.json.
// Sous webpack-stream, les fichiers portaient le chemin de output.path (/src/..., inexistant) :
// loadMaps ne trouvait jamais la carte de webpack et gulp-sourcemaps produisait une carte vide
// dont sourcesContent est le bundle privé de son commentaire sourceMappingURL. On reproduit ce
// résultat sans loadMaps (qui, la carte étant cette fois trouvée, changerait les empreintes).
function stripMapCommentFromSourcesContent() {
  return new Transform({
    objectMode: true,
    transform: function (file, enc, cb) {
      if (file.sourceMap && file.sourceMap.sourcesContent) {
        file.sourceMap.sourcesContent = file.sourceMap.sourcesContent.map(function (c) {
          return c && c.replace(/\/\/# sourceMappingURL=\S+$/, "");
        });
      }
      cb(null, file);
    },
  });
}

function revVsco() {
  return gulp
    .src(DIST + "*.+(js|map)")
    .pipe(sourcemaps.init())
    .pipe(stripMapCommentFromSourcesContent())
    .pipe(rev())
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest(DIST))
    .pipe(rev.manifest({ path: "./manifests/vsco.json" }))
    .pipe(gulp.dest("./"));
}

gulp.task("webpack", gulp.series("copy-mdi-font", webpackVsco, revVsco));

function copyBehaviours() {
  return gulp
    .src("./src/main/resources/public/dist/behaviours.js")
    .pipe(gulp.dest("./src/main/resources/public/js"));
}

gulp.task("copyBehaviours", gulp.series("webpack", copyBehaviours));

function notifyViews() {
  return gulp
    .src("./src/main/resources/view-src/notify/**/*.html")
    .pipe(replace("@@VERSION", Date.now()))
    .pipe(gulp.dest("./src/main/resources/view/notify"));
}

function otherViews() {
  return gulp
    .src([
      "./src/main/resources/view-src/**/*.html",
      "!./src/main/resources/view-src/notify/**/*.html",
    ])
    .pipe(replace("@@VERSION", Date.now()))
    .pipe(gulp.dest("./src/main/resources/view/viescolaire"));
}

gulp.task("build", gulp.series("copyBehaviours", gulp.parallel(notifyViews, otherViews)));

gulp.task("removeTemp", function () {
  return gulp
    .src(["./src/main/resources/public/temp"], { read: false, allowEmpty: true })
    .pipe(clean());
});

function getModName(fileContent) {
  var getProp = function (prop) {
    return fileContent.split(prop + "=")[1].split(/\r?\n/)[0];
  };
  return (
    getProp("modowner") + "~" + getProp("modname") + "~" + getProp("version")
  );
}

// --springboard=<chemin> (yargs n'était qu'une dépendance transitive de gulp 3).
function argValue(name) {
  var prefix = "--" + name + "=";
  var arg = process.argv.find(function (a) { return a.indexOf(prefix) === 0; });
  return arg ? arg.substring(prefix.length) : undefined;
}

gulp.task("watch", () => {
  var springboard = argValue("springboard");
  if (!springboard) {
    springboard = "../springboard-ent77/";
  }
  if (springboard[springboard.length - 1] !== "/") {
    springboard += "/";
  }

  gulp.watch("./src/main/resources/public/modules/**/*.ts", gulp.series("build"));

  fs.readFile("./gradle.properties", "utf8", function (error, content) {
    var modName = getModName(content);
    function copyToSpringboard() {
      console.log("Copying resources to " + springboard + "mods/" + modName);
      return gulp
        .src("./src/main/resources/**/*", { encoding: false })
        .pipe(gulp.dest(springboard + "mods/" + modName));
    }
    gulp.watch(
      [
        "./src/main/resources/public/template/**/*.html",
        "!./src/main/resources/public/template/entcore/*.html",
      ],
      copyToSpringboard
    );
    gulp.watch("./src/main/resources/view/**/*.html", copyToSpringboard);
  });
});

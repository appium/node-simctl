"use strict";

var gulp = require('gulp')
  , merge = require('merge-stream')
  , sourcemaps = require('gulp-sourcemaps')
  , traceur = require('gulp-traceur');

var traceurOpts = {
  asyncFunctions: true,
  blockBinding: true,
  modules: 'commonjs',
  annotations: true,
  arrayComprehension: true,
  sourceMaps: true,
  types: true
};

var getTraceurStream = function (src, dest) {
  return gulp.src(src)
              .pipe(sourcemaps.init())
              .pipe(traceur(traceurOpts))
              .pipe(sourcemaps.write())
              .pipe(gulp.dest(dest));
};

var build = function () {
  var lib = getTraceurStream('lib/es6/**/*.js', 'lib/es5');
  var test = getTraceurStream('test/es6/**/*.js', 'test/es5');
  return merge(lib, test);
};

gulp.task('default', function () {
  traceurOpts.typeAssertions = true;
  traceurOpts.typeAssertionModule = 'rtts-assert';
  build();
});


gulp.task('prod', function () {
  build();
});


'use strict';

var express = require('express');
var browserify = require('browserify-middleware');
var app = express();

app.set('views', __dirname);

app.get('/', function (req, res, next) {
  res.render('index.jade');
});
app.get('/client.js', browserify(__dirname + '/index.js', {transform: require('react-jade'), cache: false}));

app.listen(3000);

'use strict';

var utils = require('util');
var React = require('react');
var jade = require('react-jade');
var app = jade.compileFile(__dirname + '/app.jade');

var MemoryStore = require('moped-sync-store-memory');
var Client = require('../');

var server = new MemoryStore();
server.getInitial({cars: {}}).done(function (state) {
  var collections = ['cars'];
  var clients = {
    'left-client': new Client(collections, state),
    'right-client': new Client(collections, state)
  };
  var log = [];


  function render() {
    React.renderComponent(app({
      inspect: utils.inspect,
      run: function (id) {
        var value = document.getElementById(id).value;
        try {
          Function ('db', value)(clients[id]);
        } catch (ex) {
          alert(ex.message);
        }
        log.push('run:' + id + ' ' + JSON.stringify(value));
        render();
      },
      sendChanges: function (id) {
        var changes = clients[id].getLocalChanges();
        server.writeChanges(changes).done(function () {
          clients[id].setLocalChangesHandled(changes.length);
          log.push('send:' + id);
          render();
        });
      },
      getChanges: function (id) {
        server.getChanges(clients[id].next, {cars: {}}).done(function (change) {
          clients[id].writeChanges(change);
          log.push('get:' + id);
          render();
        });
      },
      collections: collections,
      server: server,
      clients: clients,
      log: log
    }), document.getElementById('content'));
  }

  render();
});

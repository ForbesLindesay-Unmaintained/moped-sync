'use strict';

var utils = require('util');
var React = require('react');
var jade = require('react-jade');
var app = jade.compileFile(__dirname + '/app.jade');

var MemoryServer = require('../memory-server.js');
var Client = require('../client.js');

var server = new MemoryServer();
server.getInitial().done(function (state) {
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
      sendChange: function (id) {
        server.writeUpdate(clients[id].getFirstLocalChange());
        clients[id].setFirstLocalChangeHandled();
        log.push('send:' + id);
        render();
      },
      getChange: function (id) {
        server.getUpdate(clients[id].next).done(function (change) {
          clients[id].writeUpdate(change);
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

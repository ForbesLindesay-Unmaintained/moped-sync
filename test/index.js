'use strict';

var assert = require('assert');
var Promise = require('promise');
var Server = require('moped-sync-store-memory');
var Client = require('../');

var server = new Server();
server.getInitial({cars: {}}).done(function (initial) {
  var left = new Client(['cars'], initial);
  var right = new Client(['cars'], initial);

  left.name = 'left';
  right.name = 'right';

  left.cars.insert({make: 'subaru'});
  assert(left.cars.find().length === 1);
  assert(left.cars.find()[0].make === 'subaru');

  right.cars.insert({make: 'honda'});
  assert(right.cars.find().length === 1);
  assert(right.cars.find()[0].make === 'honda');

  function syncDown(client) {
    if (server.changes.length <= client.next) return Promise.resolve(null);
    return server.getChanges(client.next, {cars: {}}).then(function (changes) {
      client.writeChanges(changes);
    });
  }
  function syncUp(client) {
    var changes = client.getLocalChanges();
    return server.writeChanges(changes).then(function () {
      client.setLocalChangesHandled(changes.length);
    });
  }
  function sync(client) {
    return syncUp(client).then(syncDown.bind(null, client));
  }
  sync(left).then(function () {
    return sync(right);
  }).then(function () {
    assert(left.cars.find().length === 1);
    assert(left.cars.find()[0].make === 'subaru');
    assert(right.cars.find().length === 2);
    left.cars.update({make: 'subaru'}, {seats: 'leather'});
    right.cars.update({make: 'subaru'}, {color: 'red'});
    return sync(right);
  }).then(function () {
    return syncDown(left);
  }).then(function () {
    return sync(right);
  }).done(function () {
    assert(left.cars.find({make: 'subaru'})[0].seats === 'leather');
    assert(left.cars.find({make: 'subaru'})[0].color === 'red');
    assert(right.cars.find({make: 'subaru'})[0].color === 'red');
    console.log('tests passed');
  });
});

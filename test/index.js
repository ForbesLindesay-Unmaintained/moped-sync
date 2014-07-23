'use strict';

var assert = require('assert');
var Promise = require('promise');
var Server = require('../memory-server.js');
var Client = require('../client.js');

var server = new Server();
server.getInitial().done(function (initial) {
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
    if (server.updates.length <= client.next) return Promise.resolve(null);
    return server.getUpdate(client.next).then(function (update) {
      client.writeUpdate(update);
      return syncDown(client);
    });
  }
  function syncUp(client) {
    if (client.getNumberOfLocalChanges() === 0) return Promise.resolve(null);
    return server.writeUpdate(client.getFirstLocalChange()).then(function () {
      client.setFirstLocalChangeHandled();
      return syncUp(client);
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
  });
});

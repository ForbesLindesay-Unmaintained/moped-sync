'use strict';

var Promise = require('promise');
var ObjectId = require('./lib/object-id');
var applyUpdate = require('./lib/apply-update.js');

module.exports = MemoryServer;
function MemoryServer() {
  this.state = {};
  this.updates = [];
  this.waiting = [];
}

MemoryServer.prototype.applyUpdate = function (update) {
  var collection = this.state[update.collection] = this.state[update.collection] || [];
  applyUpdate(collection, update);
};
MemoryServer.prototype.writeUpdate = function (update) {
  if (this.updates.some(function (u) { return ObjectId.equal(u.guid, update.guid); })) return;
  update._id = this.updates.length;
  update.next = this.updates.length + 1;
  this.applyUpdate(update);
  this.updates.push(update);
  this.waiting.forEach(function (waiting) {
    waiting(update);
  });
  return Promise.resolve(null);
};


MemoryServer.prototype.getInitial = function () {
  return Promise.resolve({
    action: 'initialize',
    next: this.updates.length,
    state: this.state
  });
};
MemoryServer.prototype.getItem = function (collection, id) {
  var collection = this.state[collection] || [];
  for (var i = 0; i < collection.length; i++) {
    if (ObjectId.equal(collection[i]._id, id)) {
      return Promise.resolve(collection[i]);
    }
  }
  return Promise.resolve(null);
};
MemoryServer.prototype.getUpdate = function (id) {
  if (this.updates.length > id) return Promise.resolve(this.updates[id]);
  var waiting = this.waiting;
  return new Promise(function (resolve) {
    var timeout;
    function onComplete(value) {
      clearTimeout(timeout);
      resolve(value);
    }
    this.waiting.push(onComplete);
    timeout = setTimeout(function () {
      if (waiting.indexOf(onComplete) !== -1) {
        waiting.splice(waiting.indexOf(onComplete), 1);
      }
      resolve({action: 'noop', next: id});
    }, 30000);
  }.bind(this));
};

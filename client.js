'use strict';

var assert = require('assert');
var clone = require('clone');
var match = require('mongomatch');
var manip = require('manip');
var uid = require('uid');

module.exports = Client;
function Client(collections) {
  for (var i = 0; i < collections.length; i++) {
    this[collections[i]] = new ClientCollection(collections[i], this._emitUpdate.bind(this), this._addedUpdate.bind(this));
  }
  this._updateHandlers = [];
  this._pendingChanges = [];
  this._localChangeHandlers = [];
}
Client.prototype._addedUpdate = function (update) {
  this._pendingChanges.push(update);
  var firstError;
  for (var i = 0; i < this._localChangeHandlers.length; i++) {
    try {
      this._localChangeHandlers[i]();
    } catch (ex) {
      firstError = firstError || ex;
    }
  }
  if (firstError) {
    setTimeout(function () {
      throw firstError;
    }, 0);
  }
};
Client.prototype._emitUpdate = function () {
  var firstError;
  for (var i = 0; i < this._updateHandlers.length; i++) {
    try {
      this._updateHandlers[i]();
    } catch (ex) {
      firstError = firstError || ex;
    }
  }
  if (firstError) {
    setTimeout(function () {
      throw firstError;
    }, 0);
  }
};
Client.prototype.onUpdate = function (fn) {
  assert(typeof fn === 'function', 'fn should be a function but was ' + typeof fn);
  this._updateHandlers.push(fn);
};
Client.prototype.onLocalChange = function (fn) {
  assert(typeof fn === 'function', 'fn should be a function but was ' + typeof fn);
  this._localChangeHandlers.push(fn);
};
Client.prototype.writeUpdate = function (update) {
  this[update.collection].writeUpdate(update, '_remote');
};
Client.prototype.getFirstLocalChange = function () {
  if (this._pendingChanges.length === 0) {
    throw new Error('No changes are pending');
  }
  return this._pendingChanges[0];
};
Client.prototype.setFirstLocalChangeHandled = function () {
  if (this._pendingChanges.length === 0) {
    throw new Error('No changes are pending');
  }
  this._pendingChanges.shift();
};
Client.prototype.getNumberOfLocalChanges = function () {
  return this._pendingChanges.length;
};

function ClientCollection(name, emitUpdate, addedUpdate) {
  this._name = name;
  this._emitUpdate = emitUpdate;
  this._addedUpdate = addedUpdate;
  this._remote = [];
  this._local = [];
  this._updates = [];
}
ClientCollection.prototype.find = function (query) {
  if (!query) return clone(this._local);
  return clone(this._local.filter(match.bind(null, query)));
};
ClientCollection.prototype.applyUpdate = function (update, store) {
  if (update.action === 'update') {
    var updated = false;
    for (var i = 0; i < this[store].length && !updated; i++) {
      if (this[store][i]._id === update._id) {
        this[store][i] = apply(this[store][i], update.update);
        updated = true;
      }
    }
    if (!updated) {
      this[store].push(apply({_id: update._id}, update.update));
    }
  } else if (update.action === 'remove') {
     this[store] = this[store].filter(function (obj) { return obj._id !== update._id; });
  }
};
ClientCollection.prototype.writeUpdate = function (update, store) {
  update.guid = update.guid || uid();
  update.collection = this._name;
  if (store === '_local') {
    this._updates.push(update);
  } else {
    this._updates = this._updates.filter(function (u) { return u.guid !== update.guid; });
  }
  this.applyUpdate(update, store);
  if (store === '_local') {
    this._updates.push(update);
    this._addedUpdate(update);
  } else {
    this._local = clone(this._remote);
    for (var i = 0; i < this._updates.length; i++) {
      this.applyUpdate(this._updates[i], '_local');
    }
  }
  this._emitUpdate();
};
ClientCollection.prototype.update = function (_id, update) {
  this.writeUpdate({
    action: 'update',
    _id: _id,
    update: update
  }, '_local');
};
ClientCollection.prototype.remove = function (_id) {
  this.writeUpdate({
    action: 'remove',
    _id: _id
  }, '_local');
};

function apply(obj, update) {
  if (Object.keys(update).some(function (key) { return key[0] === '$'; })) {
    return manip(obj, update);
  } else {
    update._id = obj._id;
    return update;
  }
}

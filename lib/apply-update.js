'use strict';

var clone = require('clone');
var ObjectId = require('./object-id.js');

module.exports = applyUpdate;

function applyUpdate(data, update) {
  if (update.action === 'insert') {
    for (var i = 0; i < data.length; i++) {
      if (ObjectId.equal(data[i]._id, update.item._id)) {
        return;
      }
    }
    data.push(update.item);
  } else if (update.action === 'update') {
    for (var i = 0; i < data.length; i++) {
      if (ObjectId.equal(data[i]._id, update.itemId)) {
        data[i] = apply(data[i], update.update);
        return;
      }
    }
  } else if (update.action === 'remove') {
    var index = -1;
    data.some(function (obj, i) {
      if (ObjectId.equal(obj._id, update.itemId)) {
        index = i;
        return true;
      }
    });
    data.splice(index, 1);
  }
}

function apply(obj, update) {
  obj = clone(obj);
  Object.keys(update).forEach(function (key) {
    if (key === '_id') return;
    obj[key] = update[key];
  });
  return obj;
}

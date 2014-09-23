var Q = require('q');
var debug = require('debug')('query-v1');
var _ = require('lodash');
var userService = require('../lib/userService');
var v1Query = require('../lib/v1Query');

/*
 * GET users listing.
 */

exports.list = function(req, res){
  var flaggedOidsP = userService.getFlaggedOids();
  
  v1Query(req, {
      from: 'Member',
      select: [
        'Name', 'Nickname'
      ]
    })
    .end(function (queryRes) {
      if (queryRes.ok) {
        var allUsers = queryRes.body[0];
        var _oidIndex = _.indexBy(allUsers, '_oid');

        flaggedOidsP.then(function (flaggedOids) {
          var updatePromises = [];
          flaggedOids.forEach(function (_oid) {
            var current = _oidIndex[_oid];

            debug('updating %s with %s', _oid, JSON.stringify(current));
            updatePromises.push(userService.updateNameAndNickByOid(current));
          });
          return Q.allSettled(updatePromises).then(function (states) {
            debug('Update promises settled: %s', JSON.stringify(states, null, ' '));
            res.render('users', { 
              title: 'All Users', 
              users: allUsers, 
              isChecked: function(oid) {
                if (_.contains(flaggedOids, oid)) return 'checked';
                return '';
              }
            });
          });
        });
      } else {
        res.send('failure :-(\n' + queryRes.text);
      }
    });
};

exports.listFlagged = function (req, res) {
  debug('listFlagged>');
  userService.getFlaggedOids().then(function (flaggedOids) {
    debug('getFlaggedOids.then>');
    var query = flaggedOids.map(function (oid) {
      return {
        from: 'Member',
        select: [
          'Name', 'Nickname'
        ],
        where: {
          ID: oid
        }
      };
    });

    v1Query(req, query).end(function (queryRes) {
      var userData;

      if (queryRes.ok) {
        userData = _.flatten(queryRes.body)
        res.render('users', { 
          title: 'Flagged Users', 
          users: userData, 
          isChecked: function(oid) { // TODO sort out whether to show check boxes on both pages
            if (_.contains(flaggedOids, oid)) return 'checked';
            return '';
          }
        });
      } else {
        res.send('failure. :-(' + queryRes.text);
      }
    });
    debug('getFlaggedOids.then<');
  });
  debug('listFlagged<');
}

exports.postList = function (req, res) {
  userService.flagUserIffOidInSet(req.body.selectedUsers)
    .then(function (states) {
      debug('upsertsDone %s', JSON.stringify(states, null, ' '));
      res.redirect('/users');
    });
};
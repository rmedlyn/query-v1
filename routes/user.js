var request = require('superagent');
var secrets = require('../client_secrets'); // TODO shouldn't have to require this again, already in v1oauth
var serverBaseUri = secrets.web.server_base_uri; // TODO shouldn't have to look this up. Use v1oauth.
var DataStore = require('nedb');
var path = require('path');
var Q = require('q');
var debug = require('debug')('query-v1');


/*\
 * Set up data store
\*/

var users = new DataStore({
  filename: path.join(__dirname, '..', 'cache', 'users.nedb'),
  autoload: true,
  onload: function (err) {
    if (err) console.log('error loading user database', err);
  }
});

function indexReporter(indexName) {
  return function (err) {
    if (err) {
      debug('err adding index %s', indexName, err);
    } else {
      debug('success adding index %s', indexName);
    }
  };
}

users.ensureIndex({fieldName: '_oid', unique: true}, indexReporter('_oid'));
users.ensureIndex({fieldName: 'flagged', unique: false, sparse: true}, indexReporter('flagged'));

/*
 * GET users listing.
 */

exports.list = function(req, res){
  var query = {
    from: 'Member',
    select: [
      'Name', 'Nickname'
    ]
  };
  var token = req.cookies.v1accessToken; // TODO shouldn't read off of the cookie, let v1oauth know that stuff.  
  request
    .get(serverBaseUri + '/query.v1') // TODO v1oauth should help with this url
    .set('Authorization', 'Bearer ' + token) // TODO v1oauth should help with setting this header
    .send(query)
    .end(function (queryRes) {
      if (queryRes.ok) {
        // TODO read flagged users and set their check-boxes
        res.render('users', { title: 'All Users', users: queryRes.body[0]});
      } else {
        res.send('failure :-(\n' + queryRes.text);
      }
    });
};

exports.postList = function (req, res) {
  // TODO unflag those flagged in the DB and not in this post.
  var upsertPromises = [];
  req.body.selectedUsers.forEach(function (userOid) {
    upsertPromises.push(Q.ninvoke(users, "update", {_oid: userOid}, {$set: {flagged: true, _oid: userOid}}, {upsert: true}));
  });
  Q.allSettled(upsertPromises).then(function (states) {
    debug('upsertsDone %s', JSON.stringify(states, null, ' '));
    res.redirect('/users');
  });
};
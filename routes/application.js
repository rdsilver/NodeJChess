var mongoose    = require('mongoose'),
    User = require('../models/User');

/*
 * application
 */

exports.login = function (req, res) {
  res.render('login', { title: 'NodeChess - Login' });
};

exports.attempt_login = function (req, res) {
  var post = req.body;
  User.findOne({name: post.user}, function(err, user) {
    if (user != undefined) {
      user.comparePassword(post.password, function(err, isMatch) {
        if (isMatch) {
          req.session.user_id = user._id;
          res.redirect('/games/');
        }
        else
          res.send('Bad Password');
      });
    } else {
      res.send('Bad username');
    }
  })
};

exports.create_account = function(req, res) {
  var post = req.body;
  var user = new User({name: post.user, password: post.password});
  user.save(function (err, user) {
    if (err)
      res.send('Username already taken');
    else {
      req.session.user_id = user._id;
      res.redirect('/');
    }
  });
}

exports.logout = function (req, res) {
  delete req.session.user_id;
  res.redirect('/login');
};
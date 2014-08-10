#!/bin/env node

var express = require('express'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	mongoStore = require('connect-mongo')(session),
	passport = require('passport'),
	passportFB = require('passport-facebook').Strategy,
	request = require('request'),
	bodyParser = require('body-parser'),
	path = require('path'),
	Mailgun = require('mailgun-js'),
	MongoClient = require('mongodb').MongoClient;

var mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME;
console.log('Connecting to db at ' + mongoURL);

MongoClient.connect(mongoURL, function (err, db) {
	if (err) {
		throw err;
	}

	function enforceAuthenticated(req, res, next) {
		if (req.isAuthenticated()) {
			next();
		} else {
			res.redirect('/login/fb');
		}
	}

	function checkAuthorizationForId (userId, done) {
		db.collection('authorizedpersonnel').find({userId: userId}).toArray(function (err, results) {
			if (err) throw err;
			if (results.length == 1) {
				done(null, userId);
			} else {
				done('not found: ' + userId);
			}
		});
	}

	passport.serializeUser(function (user, done) {
		done(null, user);
	});

	passport.deserializeUser(checkAuthorizationForId);

	function loginFacebookUser (accessToken, refreshToken, profile, done) {
		request({url: 'https://graph.facebook.com/me', qs: {fields: 'id', access_token: accessToken}}, function (error, response, body) {
			console.log(body);
		});
		checkAuthorizationForId("fb:" + profile.id, done);
	}

	function statusSender(req, res) {
		return function (err, data) {
			if (err) {
				res.send(500, {error: err});
			} else {
				res.send({status: 'OK'});
			}
		};
	}

	function setJsonUtf8ContentType(req, res, next) {
		res.set('Content-type', 'application/json;charset=utf8');
		next();
	}

	function storageMiddleware(config) {
		var list = new Mailgun({apiKey: config.mailgunKey, domain: config.mailgunDomain}).lists(config.mailingList);
		return express()
		.get("/recipients", setJsonUtf8ContentType, function (req, res) {
			list.members().list()
			.then(function (members) { res.end(JSON.stringify({recipients: members.items}));},
			function (err) { res.send(500, err); });
		})
		.put("/recipients/:email", setJsonUtf8ContentType, function (req, res) {
			list.members(req.params.email).update({name: req.body.recipient.name}, function (err, data) {
				if (err) {
					res.send(500, {error: err});
				} else {
					res.send({
						"recipients": [{
							address: req.params.email,
							name: req.body.recipient.name
						}]
					});
				}
			});
		})
		.post("/recipients", function (req, res) {
			list.members().create(req.body.recipient, function (err, data) {
				if (err) {
					res.send(500, {error: err});
				} else {
					res.send({
						"recipients": [{
							address: req.body.recipient.address,
							name: req.body.recipient.name
						}]
					});
				}
			});

		})
		.delete("/recipients/:email", function (req, res) {
			list.members(req.params.email).delete(statusSender(req, res));
		})
		.get("/information/current", setJsonUtf8ContentType, function (req, res) {
			res.end(JSON.stringify({
				"informations": [{
					"id" : "current",
					"mailingList" : config.mailingList
				}]
			}));
		});
	}

	function profilePicSender () {
		return express()
			.get("/profilepic", function (req, res) {
				res.redirect('https://graph.facebook.com/' + req.user.substr(3) + "/picture");
			});
	}


	db.collection('config').find({id: 'current'}).toArray(function (err, results) {
		if (err) throw err;
		var config = results[0];
		console.log("CONFIG: ", results);

		passport.use(new passportFB({ clientID: config.fbId, clientSecret: config.fbSecret, callbackURL : config.fbCallbackUrl }, loginFacebookUser));

		var app = express()
			.get("/status", function (req, res) {
				res.send('healthy');
			})
			.use(cookieParser())
			.use(bodyParser())
			.use(session({secret: config.secret, store: new mongoStore({db: db})}))
			.use(passport.initialize())
			.use(passport.session())
			.get("/login/fb", passport.authenticate('facebook'))
			.get("/auth/cb", passport.authenticate('facebook', {successRedirect: '/', failureRedirect: '/'}))
			.use(enforceAuthenticated)
			.use(storageMiddleware(config))
			.use(profilePicSender())
			.use(express.static(path.join(__dirname, "public")));

		app.listen(process.env.OPENSHIFT_NODEJS_PORT || 12345, process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0');
		console.log("Server up and running on port " + (process.env.OPENSHIFT_NODEJS_PORT || 12345));
	});
});

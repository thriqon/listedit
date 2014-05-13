#!/bin/env node

var express = require('express'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	redisStore = require('connect-redis')(session),
	passport = require('passport'),
	passportFB = require('passport-facebook').Strategy,
	redis = require('then-redis'),
	request = require('request'),
	bodyParser = require('body-parser'),
	path = require('path'),
	Mailgun = require('mailgun-js');

function enforceAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		next();
	} else {
		res.redirect('/login/fb');
	}
}

var redisOptions = {
	password: process.env.REDIS_PASSWORD || '',
	pass: process.env.REDIS_PASSWORD || '',
	host: process.env.OPENSHIFT_REDIS_HOST || '127.0.0.1',
	port: process.env.OPENSHIFT_REDIS_PORT || 6379
};

var db = redis.createClient(redisOptions);

function checkAuthorizationForId (userId, done) {
	db.connect()
		.then(function () { return db.sismember("mvh:authorizedpersonnel", userId) })
		.then(function (value) { if (value == 1) { done(null, userId); } else { done('not found: ' + userId); }});
}

passport.serializeUser(function (user, done) {
	done(null, user);
});

passport.deserializeUser(checkAuthorizationForId);

function loginFacebookUser (accessToken, refreshToken, profile, done) {
	checkAuthorizationForId("fb:" + profile.id, done);
}

function statusSender(req, res) {
	return function (err, data) {
		if (err) {
			res.send(500, err);
		} else {
			res.send({status: 'OK'});
		}
	}
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
	.put("/recipients/:email", function (req, res) {
		list.members(req.params.email).update({name: req.body.name}, statusSender(req, res));
	})
	.post("/recipients", function (req, res) {
		list.members().create(req.body, statusSender(req, res));
	})
	.delete("/recipients/:email", function (req, res) {
		list.members(req.params.email).delete(statusSender(req, res));
	});
}

function profilePicSender () {
	return express()
		.get("/profilepic", function (req, res) {
			res.redirect('https://graph.facebook.com/' + req.user.substr(3) + "/picture");
		});
}


db.connect()
.then(function () { return db.hgetall("mvh:config"); })
.then(function (config) {

	passport.use(new passportFB({ clientID: config.fbId, clientSecret: config.fbSecret, callbackURL : config.fbCallbackUrl }, loginFacebookUser));

	var app = express()
		.get("/status", function (req, res) {
			res.send('healthy');
		})
		.use(cookieParser())
		.use(bodyParser())
		.use(session({secret: config.secret, store: new redisStore(redisOptions)}))
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


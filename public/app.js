App = Ember.Application.create();

Ember.libraries.register('ListEdit', '0.0.2');

App.ApplicationAdapter = DS.RESTAdapter.extend();
App.RecipientSerializer = DS.RESTSerializer.extend({
	normalizeId : function (hash) {
		hash.id = hash.address;
	}
});

App.Router.reopen({
	location: 'none'
});

App.Recipient = DS.Model.extend({
	name: DS.attr('string'),
	address: DS.attr('string')
});

App.Information = DS.Model.extend({
	mailingList: DS.attr('string')
});

App.ApplicationRoute = Ember.Route.extend({
	model : function () {
		return this.get('store').find('information', 'current');
	}
});

App.IndexRoute = Ember.Route.extend({
	model: function() {
		return this.get('store').find('recipient');
	}
});

App.IndexController = Ember.ArrayController.extend({
	actions : {
		'addNewTop' : function () {
			this.send('addNew');
			$('html, body').animate({
				scrollTop: $("#bottom").offset().top
			}, 500);
		},
		'addNew' : function () {
			this.get('store').createRecord('recipient', {name: '', adress: ''});
		}
	}
});

App.RecipientController = Ember.ObjectController.extend({
	actions: {
		successMessage : function (text) {
			$.bootstrapGrowl(text, {type: 'success'});
		},
		failureMessage : function (text) {
			$.bootstrapGrowl(text, {type: 'danger'});
		},
		'save' : function () {
			var self = this;
			self.get('model').save().then(function () { 
				self.send('successMessage', 'Saved ' + self.get('name'))
			}, function () {
				self.send('failureMessage', 'Failed saving ' + self.get('name')) 
			});
		},
		'delete' : function () {
			if (this.get('isNew')) {
				this.get('model').destroyRecord();
			} else {
				var self = this;
				bootbox.confirm('Really delete ' + self.get('name') + '?', function (result) {
					if (result) {
						self.get('model').destroyRecord()
					.then(function () { self.send('successMessage', 'Deleted ' + self.get('name'))},
						function () { self.send('failureMessage', 'Failed deleting ' + self.get('name')) });
					}
				});
			}
		}
	}
});

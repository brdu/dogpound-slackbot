var dynamo = require('dynamodb')
var Joi    = require('joi')
var AWS    = dynamo.AWS
var _      = require('lodash')

dynamo.AWS.config.update({region: "us-east-1"})
dynamo.createTables.bind(dynamo)

const USER_MODEL = Joi.object().keys({
    name: Joi.string(),
    id: Joi.string()
})

const CHANNEL_MODEL = Joi.object().keys({
    id : Joi.string(),
    name  : Joi.string(),
    readonly   : Joi.boolean().allow(null),
    whitelist : Joi.array().items(USER_MODEL).allow(null),
    createdAt : Joi.string().allow(null)
})

var DogpoundSlack = dynamo.define('DogpoundSlack', {
  hashKey : 'id',
  timestamps : true,
  schema : CHANNEL_MODEL
});


DogpoundSlack.config({tableName: 'dogpoundchannels'});

function fetch(callback, getAsJson = true) {
	DogpoundSlack
		.scan()
		.exec(function(err, data) {
			if (err) {
				callback(err, null)
			} else {
				if (getAsJson) {
					callback(err, _.map(data.Items, function (item) {
						return item.attrs
					}))
				} else {
					callback(err, data.Items)
				}
				
			}
	})
}

function update(id, change, callback) {
	var update = {
		id: id,
	}
	for (var key in change) {
		update[key] = change[key]
	}

	DogpoundSlack.update(update, function(err, res) {
		callback(err, res)
	})
}

function getByName(name, callback) {
	fetch(function(err, channels) {
		if (err) {
			callback(err, null)
		} else {
			var channel
			for (var i = 0; i < channels.length; i++) {
				if (channels[i].name.toLowerCase() === name.toLowerCase()) {
					channel = channels[i]
					break
				}
			}
			callback(null, channel)
		}
	})
}

function get(id, callback) {
	DogpoundSlack
		.query(id)
		.exec(function(err, res) {
			if (err) {
				callback(err, null)
			} else {
				if (res && res.Items && res.Items[0]) {
					callback(null, res.Items[0].attrs)
				} else {
					callback(null, null)
				}
			}
		})
}

function createChannel(id, name, readonly = false, whitelist = [], callback) {
	var modelValid = true
	if (whitelist) {
		_.forEach(whitelist, function(user) {
			modelValid = Joi.validate(user, CHANNEL_MODEL)
		})
	}

	var channel = {
		name: name,
		id: id,
		readonly: readonly,
		whitelist: whitelist
	}
	modelValid = Joi.validate(channel, CHANNEL_MODEL)

	if (!modelValid) {
		callback({
			message: "Create channel failed due to invalid model",
			error: channel
		}, null)
	} else {
		DogpoundSlack.create(channel, function (err, res) {
			callback(err, res)
		});
	}
}

module.exports = {
	fetch: fetch,
	update: update,
	get: get,
	getByName: getByName,
	createChannel: createChannel,
	update: update
}
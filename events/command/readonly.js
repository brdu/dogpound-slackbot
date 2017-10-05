var async = require('async')
var usage = require('./usage.json')
var slack = require('../../utils/slack')
var dogpounddb = require('../../utils/dogpounddb')

const ADMIN_USERS = ['brdu', 'thecryptodog']

module.exports = function(slackEvent, callback) {
	if (!ADMIN_USERS.includes(slackEvent.user_name)) {
		callback(null, {
			message: "User " + slackEvent.user_name + " not authorized to use " + slackEvent.command + " command."
		})
		return
	}

	let validation = parseAndValidate(slackEvent)
	let commands = validation.commands
	if (validation.error) {
		callback(null, {
			message: "Incorrect usage of /readonly command. Usage:\n" + usage.readonly
		})
		return
	}

	if (commands[0] === "help") {
		callback(null, {
			message: "Usage:\n" + usage.readonly
		})
		return
	}

	if (commands[0] === "list") {
		postReadonlyList(slackEvent, callback)
		return
	}

	setReadonly(commands[0], commands[1], slackEvent, callback)
}

function setReadonly(channel, readonly, slackEvent, callback) {
	if (readonly.toLowerCase() !== "true" && readonly.toLowerCase() !== "false") {
		slack.post("Incorrect usage of /readonly <channel> <bool>. Spelling error? Ex.. /readonly exchangeupdates true", slackEvent.channel_id)
		callback(null, {
			message: "[readonly] no op. invalid command or spelling error in boolean",
			body: "/readonly " + channel + " " + readonly
		})
		return
	}

	readonly = readonly.toLowerCase() === "true" ? true : false
	async.parallel([
		function(dbCallback) {
			dogpounddb.getByName(channel, function(err, channel) {
				dbCallback(err, channel)
			})
		},
		function(findChannelCallback) {
			slack.findChannel(channel, function(err, channel) {
				findChannelCallback(err, channel)
			})
		}
	], function (err, res) {
		if (err) {
			var dateString = new Date(Date.now())
			slack.post("Something went wrong", slackEvent.channel_id)
			callback({
				message: "Error removing " + user + " from whitelist",
				error: err
			}, null)
		}

		var dbItem = res[0]
		var channelItem = res[1]

		if (!channelItem) {
			callback(null, {
				message: "Channel " + channel + " doesn't exist. Spelling error? Usage error? Ex. /readonly exchangeupdates true"
			})
			return
		}

		if (!dbItem) {
			dogpounddb.createChannel(channelItem.id, channelItem.name, readonly, [], function(err, res) {
				if (err) {
					slack.post("Something went wrong creating DB item", slackEvent.channel_id)
					callback(err, null)
				} else {
					var msg
					if (readonly) {
						msg = "Successfully set channel " + channel + " to readonly"
					} else {
						msg = "Successfully disabled readonly on " + channel
					}
					slack.post(msg, slackEvent.channel_id)
					callback(null, {
						message: "Created channel for readonly"
					})
				}
			})
		} else {
			dogpounddb.update(dbItem.id, { readonly: readonly }, function(err, res) {
				if (err) {
					slack.post("Something went wrong updating DB item", slackEvent.channel_id)
					callback(err, null)
				} else {
					var msg
					if (readonly) {
						msg = "Successfully set channel " + channel + " to readonly"
					} else {
						msg = "Successfully disabled readonly on " + channel
					}
					callback(null, {
						message: msg
					})
				}
			})
		}
	})
}

function postReadonlyList(slackEvent, callback) {
	dogpounddb.fetch(function(err, res) {
		if (err) {
			slack.post("Error fetching from DB", slackEvent.channel_id)
			callback({
				message: "error posting readonly",
				error: error
			}, null)
		} else {
			var channels = []
			for (var i = 0; i < res.length; i++) {
				if (res[i].readonly) {
					channels.push({
						name: res[i].name,
						whitelist: (res[i].whitelist ? res[i].whitelist : []).map(function(user) {
							return user.name
						})
					})
				}
			}

			var msg
			if (!channels.length) {
				msg = "No readonly channels implemented yet. Use /readonly <channel> <boolean> to set"
			} else {
				msg = "Read only channels:\n"
				var maxChars = channels.sort(function(a, b) {
					return b.name.length - a.name.length
				})[0].name.length

				for (var i = 0; i < channels.length; i++) {
					var cn = channels[i].name
					var wl = channels[i].whitelist
					while (cn.length <= maxChars) {
						cn = cn + " "
					}
					cn = "  " + cn + "- whitelist [" + wl + "]"
					msg = msg + cn + "\n"
				}
			}

			callback(null, {
				message: msg
			})
		}
	})
}

function parseAndValidate(slackEvent) {
	var validation = {
		success: false,
		commands: null,
		error: null,
		usage: null
	}

	let commands = slackEvent.text ? slackEvent.text.split(/[ ,]+/) : null
	if (!commands || !commands.length) {
		validation.error = "No args provided"
		validation.usage = usage.readonly
		return validation
	}

	if (commands[0] == "list" || commands[0] == "help") {
		validation.success = true
		validation.commands = commands
		return validation
	}

	if (commands.length == 2 && (commands[1] === "true" || commands[1] === "false")) {
		validation.success = true
		validation.commands = commands
		return validation
	}

	validation.error = "Error"
	validation.usage = usage.readonly
	return validation
}
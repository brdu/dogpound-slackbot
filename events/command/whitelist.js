var admin_users = require('../../utils/admin_users')
var async = require('async')
var usage = require('./usage.json')
var slack = require('../../utils/slack')
var dogpounddb = require('../../utils/dogpounddb')

const ADMIN_USERS = ['brdu', 'thecryptodog']

module.exports = function(slackEvent, callback) {
	if (!admin_users || !admin_users.includes(slackEvent.user_name)) {
		callback(null, {
			message: "User " + slackEvent.user_name + " not authorized to use " + slackEvent.command + " command."
		})
		return
	}

	let validation = parseAndValidate(slackEvent)
	let commands = validation.commands
	if (validation.error) {
		postValidationError(slackEvent, validation, callback)
		return
	}

	if (commands[0] === "help") {
		postHelp(slackEvent, callback)
		return
	}

	if (commands[0] === "list") {
		postWhitelist(slackEvent, callback)
		return
	}

	if (commands[0] === "remove") {
		removeFromWhitelist(commands[1], commands[2], slackEvent, callback)
		return
	}

	addToWhitelist(commands[0], commands[1], slackEvent, callback)
}

function addToWhitelist(userName, channelName, slackEvent, callback) {
	async.parallel([
		function(dbCallback) {
			dogpounddb.getByName(channelName, function(err, channel) {
				dbCallback(err, channel)
			})
		},
		function(findChannelCallback) {
			slack.findChannel(channelName, function(err, channel) {
				findChannelCallback(err, channel)
			})
		},
		function(userInfoCallback) {
			slack.userInfo(userName, function(err, user) {
				userInfoCallback(err, user)
			})
		}
	], function (err, res) {
		if (err) {
			var dateString = new Date(Date.now()).toLocaleString()
			slack.post("An unkown error occured. Check logs at time " + dateString + " for more info.", slackEvent.channel_id)
			callback({
				message: "Something went wrong",
				error: err
			}, null)
			return
		}

		var dbChannel = res[0]
		var channelItem = res[1]
		var user = res[2]

		var errorMsg
		if (!channelItem && !user) {
			errorMsg = "Both channel \'" + channelName + "\' and user \'" + userName + "\' do not exist."
		} else if (!channelItem) {
			errorMsg = "Channel \'" + channelName + "\' does not exist."
		} else if (!user) {
			errorMsg = "User \'" + userName + "\' does not exist."
		} 

		if (errorMsg) {
			callback(null, {
				message: errorMsg
			})
			return
		}

		if (dbChannel) {
			var whitelist = dbChannel.whitelist ? dbChannel.whitelist : []
			var isUserWhitelisted = false
			for (var i = 0; i < whitelist.length; i++) {
				if (whitelist[i].name === userName) {
					isUserWhitelisted = true
					break
				}
			}

			if (isUserWhitelisted) {
				callback(null, {
					message: "User " + userName + " already whitelist for channel " + channelName
				})
			} else {
				whitelist.push({
					id: user.id,
					name: user.name
				})

				var update = {
					whitelist: whitelist
				}

				dogpounddb.update(dbChannel.id, update, function(err, res) {
					if (err) {
						slack.post("Error occured updating database for command /whitelist " + userName + " " + channelName + ". Try again", slackEvent.channel_id)
						callback(err, null)
					} else {
						callback(null, {
							message: "Succesfully added user " + userName + " to " + channelName + " whitelist"
						})
					}
				})
			}
		} else {
			var user = { 
				id: user.id,
				name: user.name
			}

			dogpounddb.createChannel(channelItem.id, channelItem.name, false, [user], function(err, res) {
				if (err) {
					slack.post("Error occured updating database for command /whitelist " + userName + " " + channelName + ". Try again", slackEvent.channel_id)
					callback({
							message: "Error occured updating database for command /whitelist " + userName + " " + channelName,
							error: err
						}, null)
				} else {
					var msg = "Added " + userName + " to " + channelName + " whitelist."
					msg = msg + "\n\nNote that channel " + channelName + " is not readonly. User the /readonly <channel> <boolean> command to make readonly."
					callback(null, {
						message: msg
					})
				}
			})
		}	
	})
}

function removeFromWhitelist(user, channel, slackEvent, callback) {
	async.parallel([
		function(dbCallback) {
			dogpounddb.getByName(channel, function(err, channel) {
				dbCallback(err, channel)
			})
		},
		function(userInfoCallback) {
			slack.userInfo(user, function(err, user) {
				userInfoCallback(err, user)
			})
		}
	], function (err, res) {
		if (err) {
			var dateString = new Date(Date.now()).toLocaleString()
			slack.post("An unkown error occured. Check logs at time " + dateString + " for more info.", slackEvent.channel_id)
			callback( {
				message: "Something went wrong",
				error: err
			}, null)
			return
		}

		if (err) {
			slack.post("Something went wrong", slackEvent.channel_id)
			callback({
				message: "Error removing " + user + " from whitelist",
				error: err
			}, null)
		} else {
			var dbChannel = res[0]
			var slackUser = res[1]

			if (!dbChannel) {
				callback(null, {
					message: "User " + user + " not whitelisted for channel " + channel + "."
				})
				return
			}
			if (!slackUser) {
				callback(null, {
					message: "No user " + user + " exists in this slack group. Is spelling correct?"
				})
				return
			}

			var whitelist = dbChannel ? dbChannel.whitelist : []
			var newWhitelist = []
			for (var i = 0; i < whitelist.length; i++) {
				if (whitelist[i].name !== user) {
					newWhitelist.push(whitelist[i])
				}
			}
	
			if (newWhitelist.length == whitelist.length) {
				callback(null, {
					message: "User " + user + " is not whitelisted for channel " + channel
				})
				return
			}

			dogpounddb.update(dbChannel.id, { whitelist: newWhitelist }, function(err, res) {
				if (err) {
					slack.post("Error updating DB", slackEvent.channel_id)
					callback({
						message: "Error updating DB",
						error: err
					}, null)
				} else {
					callback(null, {
						message: "User " + user + " removed from " + channel + " whitelist"
					})
				}
			})
		}
	})
}

function postValidationError(slackEvent, validation, callback) {
	var message = validation.error + ". Usage:\n" + validation.usage
	callback(null, {
			message: "Invalid usage of /whitelist. Use /whitelist help for proper usage." + slackEvent.channel_name
		})
}

function postHelp(slackEvent, callback) {
	callback(null, {
		message: "Usage:\n" + usage.whitelist.summary
	})
}

function postWhitelist(slackEvent, callback) {
	dogpounddb.fetch(function(err, res) {
		if (err) {
			callback({
				"message": "Error fetching from DB. Command /whitelist list"
			}, null)
		} else {
			var channels = []
			for (var i = 0; i < res.length; i++) {
				if (res[i].whitelist) {
					channels.push({
						name: res[i].name,
						whitelist: res[i].whitelist.map(function(user) {
							return user.name
						})
					})
				}
			}

			var msg
			if (!channels.length) {
				msg = "No whitelists set. Use /whitelist <user> <channel> to set."
			} else {
				msg = "Active whitelists:\n\n"
				var maxChars = channels.sort(function(a, b) {
					return b.name.length - a.name.length
				})[0].name.length

				for (var i = 0; i < channels.length; i++) {
					var cn = channels[i].name
					var wl = channels[i].whitelist
					while (cn.length <= maxChars) {
						cn = cn + " "
					}
					cn = "   " + cn + "- whitelist [" + wl + "]"
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
		validation.usage = usage.whitelist.summary
		return validation
	}

	if (commands[0] === "help") {
		validation.success = true
		validation.commands = commands
		return validation
	}

	if (commands[0] === "list") {
		validation.success = true
		validation.commands = commands
		return validation
	}

	if (commands[0] === "remove") {
		if (commands.length != 3) {
			validation.error = "Invalid arguments for remove command."
			validation.usage = usage.whitelist.remove
			return validation
		}  else {
			validation.success = true
			validation.commands = commands
			return validation
		}
	}

	if (commands.length != 2) {
		validation.error = "Invalid arguments - unknown command."
		validation.usage = usage.whitelist.add
		return validation
	}

	validation.success = true
	validation.commands = commands
	return validation
}
const ts = require('tinyspeck')
let slack = ts.instance({ token: process.env.SLACK_OAUTH_BOT });

const CHANNEL_ID_STRING_LENGTH = 9

const DELETE_WHITELIST_CHANNELS = process.env.SLACK_DELETE_WHITELIST_CHANNELS
const POST_WHITELIST_CHANNELS = process.env.SLACK_POST_WHITELIST_CHANNELS

function deletePost(event, callback) {
	if (DELETE_WHITELIST_CHANNELS && DELETE_WHITELIST_CHANNELS.length >= CHANNEL_ID_STRING_LENGTH) {
		let whitelist = DELETE_WHITELIST_CHANNELS.split(",")
		var channelInWhitelist = false
		for (var i = 0; i < whitelist.length; i++) {
			if (whitelist[i].toLowerCase() === event.channel.toLowerCase()) {
				channelInWhitelist = true
				break
			}
		}

		if (!channelInWhitelist) {
			if (callback) {
				callback(null, {
					message: "Aborting deleted because DELETE_WHITELIST_CHANNELS is present and doesn't contain " + event.channel 
				})
			}
			return
		}
	}

	var data = {
		token: process.env.SLACK_OAUTH_ADMIN,
		channel: event.channel,
		ts: event.event_ts
	}

	slack.send('chat.delete', data).then(data => {
		if (callback) {
			callback(null, {
				message: "Deleted message",
				body: event
			})
		}
	})
}

function post(message, channel, callback) {
	if (!channel) {
		throw new Error("No channel provided to slack#post")
	}
	if (POST_WHITELIST_CHANNELS && POST_WHITELIST_CHANNELS.length >= CHANNEL_ID_STRING_LENGTH) {
		let whitelist = POST_WHITELIST_CHANNELS.split(",")
		var channelInWhitelist = false
		for (var i = 0; i < whitelist.length; i++) {
			if (whitelist[i].toLowerCase() === channel.toLowerCase()) {
				channelInWhitelist = true
				break
			}
		}

		if (!channelInWhitelist) {
			callback(null, {
				message: "Aborting post because POST_WHITELIST_CHANNELS is present and doesn't contain " + channel 
			})
			return
		}
	}

	let data = {
	  unfurl_links: true,
	  channel: channel,
	  text: message,
	  as_user: false
	}

	slack.send(data).then(data => {
		if (callback) {
			callback(null, {
		 		message: data
		 	})
		}
	})
}

function findChannel(channelName, callback) {
	channels(function(err, data) {
		if (err) {
			callback(err, null)
		} else {
			var channelItem
			for (var i = 0; i < data.length; i++) {
				if (data[i].name.toLowerCase() === channelName.toLowerCase()) {
					channelItem = data[i]
					break
				}
			}

			if (!channelItem) {
				groups(function(err, data) {
					for (var i = 0; i < data.length; i++) {
						if (data[i].name.toLowerCase() === channelName.toLowerCase()) {
							channelItem = data[i]
							break
						}
					}
					callback(err, channelItem)
				})
			} else {
				callback(null, channelItem)
			}
		}
	})
}


function groups(callback) {
	var data = {
		token: process.env.SLACK_OAUTH_ADMIN
	}
	slack.send('groups.list', data).then(data => {
		if (data.ok) {
			callback(null, data.groups)
		} else {
			callback(data.error, null)
		}
	})
}

function channels(callback) {
	slack.send('channels.list').then(data => {
		if (data.ok) {
			callback(null, data.channels)
		} else {
			callback(data.error, null)
		}
	})
}

function userInfo(name, callback) {
	slack.send('users.list').then(data => {
		if (data.ok) {
			var user
			for (var i = 0; i < data.members.length; i++) {
				if (data.members[i].name.toLowerCase() === name.toLowerCase()) {
					user = {
						id: data.members[i].id,
						name: data.members[i].name
					}
					break
				}
			}
			callback(null, user)
		} else {
			callback(data.error, null)
		}
	})
}

module.exports = {
	deletePost: deletePost,
	post: post,
	findChannel: findChannel,
	groups: groups,
	channels: channels,
	userInfo: userInfo
}
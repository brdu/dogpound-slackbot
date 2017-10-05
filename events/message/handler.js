var dogpounddb = require('../../utils/dogpounddb')
var slack = require('../../utils/slack')

module.exports = function(event, callback) {
    var whitelisted_user
    var db_channel
	dogpounddb.get(event.channel, function(err, channel) {
        db_channel = channel
        if (err) {
        	callback({
        		message: "Error fetching from DB",
        		error: err
        	}, null)
        } else if (channel) {
            if (channel.readonly) {
                var whitelist = channel.whitelist ? channel.whitelist : []
                for (var i = 0; i < whitelist.length; i++) {
                    if (event.user === whitelist[i].id) {
                        whitelisted_user = whitelist[i].name
                    }
                }
                if (whitelisted_user) {
                    callback(null, {
                        message: "Allowing post to channel: " + channel.name + " from whitelisted user: " + whitelisted_user
                    })
                } else {
                    slack.deletePost(event)
                    callback(null, {
                        message: "delete"
                    })
                }
            } else {
                callback(null, {
                    message: "Channel not readonly. Dont do anything."
                })
            }
        } else {
            callback(null, {
            	message: "Channel: " + event.channel + " does not exist in dogpounddb. Treating as whitelisted."
            })
        }
    })
}
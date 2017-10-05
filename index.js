var messageHandler = require('./events/message/handler')
var commandHandler = require('./events/command/handler')

const EVENT_TYPE_MESSAGE = "message"
const EVENT_TYPE_COMMAND = "command"

const EVENT_SUBTYPE_BOT_MESSAGE = "bot_message"

module.exports.handler = function(event, context, callback) {
    console.log(event)
    if (event[EVENT_TYPE_COMMAND]) {
        commandHandler(event, function(err, res) {
            if (err) {
                callback(err, null)
            } else {
                callback(null, {
                   "response_type": "in_channel",
                   "text": res.message
                })
            }
        })
    } else if (event.event.subtype === EVENT_SUBTYPE_BOT_MESSAGE) {
        callback(null, {
            body: "Ignoring bot message"
        })
    } else if (event.event.type === EVENT_TYPE_MESSAGE) {
        messageHandler(event.event, function(err, res) {
            if (err) {
                callback(err, null)
            } else {
                callback(null, {
                    statusCode: 200,
                    body: res
                })
            }
        })
    } else {
        callback(null, null)
    }
}
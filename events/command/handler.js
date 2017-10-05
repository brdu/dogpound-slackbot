var readonlyHandler = require('./readonly')
var whitelistHandler = require('./whitelist')

const COMMAND_READONLY = "/readonly"
const COMMAND_WHITELIST = "/whitelist"

module.exports = function(event, callback) {
	if (event.command === COMMAND_READONLY) {
		readonlyHandler(event, callback)
    } else if (event.command == COMMAND_WHITELIST) {
    	whitelistHandler(event, callback)
    } else {
    	callback({
    		message: "Unknown command " + event.command
    	}, null)
    }
}
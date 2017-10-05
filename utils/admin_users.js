const ADMINS = process.env.ADMIN_USERS

module.exports = function() {
	if (ADMINS && ADMINS.length) {
		return ADMINS.split(",")
	}
	return null
}
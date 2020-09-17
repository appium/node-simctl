const commands = {};

async function execPrivacyCommand (context, bundleId, permissionVerb, perm) {
  await context.exec('privacy', {
    args: [context.requireUdid(`privacy ${permissionVerb}`), permissionVerb, perm, bundleId],
  });
  // Changing a permission causes the app to be background'ed. Re-open the app
  await context.launchApp(bundleId);
}

/**
 * Grants the given permission on the app with the given bundle identifier
 *
 * @since Xcode 11.4 SDK
 * @param {string} bundleId the identifier of the application whose
 * privacy settings are going to be changed
 * @param {string} perm one of possible permission values:
 * - all: Apply the action to all services.
 * - calendar: Allow access to calendar.
 * - contacts-limited: Allow access to basic contact info.
 * - contacts: Allow access to full contact details.
 * - location: Allow access to location services when app is in use.
 * - location-always: Allow access to location services at all times.
 * - photos-add: Allow adding photos to the photo library.
 * - photos: Allow full access to the photo library.
 * - media-library: Allow access to the media library.
 * - microphone: Allow access to audio input.
 * - motion: Allow access to motion and fitness data.
 * - reminders: Allow access to reminders.
 * - siri: Allow use of the app with Siri.
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while granting the permission
 * @throws {Error} If the `udid` instance property is unset
 */
commands.grantPermission = async function grantPermission (bundleId, perm) {
  return await execPrivacyCommand(this, bundleId, 'grant', perm);
};

/**
 * Revokes the given permission on the app with the given bundle identifier
 * after it has been granted
 *
 * @since Xcode 11.4 SDK
 * @param {string} bundleId the identifier of the application whose
 * privacy settings are going to be changed
 * @param {string} perm one of possible permission values (see `grantPermission`)
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while revoking the permission
 * @throws {Error} If the `udid` instance property is unset
 */
commands.revokePermission = async function revokePermission (bundleId, perm) {
  return await execPrivacyCommand(this, bundleId, 'revoke', perm);
};

/**
 * Resets the given permission on the app with the given bundle identifier
 * to its default state
 *
 * @since Xcode 11.4 SDK
 * @param {string} bundleId the identifier of the application whose
 * privacy settings are going to be changed
 * @param {string} perm one of possible permission values (see `grantPermission`)
 * @throws {Error} if the current SDK version does not support the command
 * or there was an error while resetting the permission
 * @throws {Error} If the `udid` instance property is unset
 */
commands.resetPermission = async function resetPermission (bundleId, perm) {
  return await execPrivacyCommand(this, bundleId, 'reset', perm);
};

export default commands;

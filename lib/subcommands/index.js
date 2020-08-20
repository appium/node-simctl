import addmediaCommands from './addmedia';
import appinfoCommands from './appinfo';
import bootCommands from './boot';
import bootstatusCommands from './bootstatus';
import createCommands from './create';
import deleteCommands from './delete';
import eraseCommands from './erase';
import getappcontainerCommands from './get_app_container';
import installCommands from './install';
import ioCommands from './io';
import keychainCommands from './keychain';
import launchCommands from './launch';
import listCommands from './list';
import openurlCommands from './openurl';
import pbcopyCommands from './pbcopy';
import pbpasteCommands from './pbpaste';
import privacyCommands from './privacy';
import pushCommands from './push';
import envCommands from './getenv';
import shutdownCommands from './shutdown';
import spawnCommands from './spawn';
import terminateCommands from './terminate';
import uiCommands from './ui';
import uninstallCommands from './uninstall';

// xcrun simctl --help
const subcommands = Object.assign({},
    addmediaCommands,
    appinfoCommands,
    bootCommands,
    bootstatusCommands,
    createCommands,
    deleteCommands,
    eraseCommands,
    getappcontainerCommands,
    installCommands,
    ioCommands,
    keychainCommands,
    launchCommands,
    listCommands,
    openurlCommands,
    pbcopyCommands,
    pbpasteCommands,
    privacyCommands,
    pushCommands,
    envCommands,
    shutdownCommands,
    spawnCommands,
    terminateCommands,
    uiCommands,
    uninstallCommands,
);

export default subcommands;

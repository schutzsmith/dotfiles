"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const channels = {};
class OutputChannelLogger {
    constructor(channelName, lazy = false, preserveFocus = false) {
        this.channelName = channelName;
        this.preserveFocus = preserveFocus;
        if (!lazy) {
            this.channel = vscode.window.createOutputChannel(this.channelName);
            this.channel.show(this.preserveFocus);
        }
    }
    static disposeChannel(channelName) {
        if (channels[channelName]) {
            channels[channelName].getOutputChannel().dispose();
            delete channels[channelName];
        }
    }
    static getMainChannel() {
        return this.getChannel(this.MAIN_CHANNEL_NAME, true);
    }
    static getChannel(channelName, lazy, preserveFocus) {
        if (!channels[channelName]) {
            channels[channelName] = new OutputChannelLogger(channelName, lazy, preserveFocus);
        }
        return channels[channelName];
    }
    static purify(message) {
        return message
            .toString()
            .replace(/\u001b/g, "")
            .replace(/\[2K\[G/g, "") // Erasing `[2K[G` artifacts from output
            .replace(/\[\d+m/g, ""); // Erasing "colors" from output
    }
    log(message) {
        this.channel.appendLine(OutputChannelLogger.purify(message));
    }
    append(message) {
        this.channel.append(OutputChannelLogger.purify(message));
    }
    getOutputChannel() {
        return this.channel;
    }
    clear() {
        this.channel.clear();
    }
    get channel() {
        if (this.outputChannel) {
            return this.outputChannel;
        }
        else {
            this.outputChannel = vscode.window.createOutputChannel(this.channelName);
            this.outputChannel.show(this.preserveFocus);
            return this.outputChannel;
        }
    }
    set channel(channel) {
        this.outputChannel = channel;
    }
}
OutputChannelLogger.MAIN_CHANNEL_NAME = "Cordova Tools";
exports.OutputChannelLogger = OutputChannelLogger;

//# sourceMappingURL=outputChannelLogger.js.map

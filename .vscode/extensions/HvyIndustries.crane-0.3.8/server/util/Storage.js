/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const zlib = require('zlib');
const util = require('util');
/**
 * This class can handle cache
 */
class Storage {
    constructor() {
        this.isProcessing = false;
        this.waitProcessing = null;
        this.waitInterval = 5000;
        this.errHandler = null;
        this.pendingCb = [];
    }
    /**
     * Requests to flush the specified tree structure
     */
    onError(cb) {
        this.errHandler = cb;
    }
    ;
    /**
     * Raise an error
     */
    raiseError(err) {
        if (this.errHandler) {
            this.errHandler(err);
        }
        else {
            console.error(err.stack ? err.stack : err);
        }
    }
    ;
    /**
     * Reads the specified filename
     */
    read(filename, cb) {
        if (this.isProcessing) {
            // bad things may happen, so delay it by 1 sec
            setTimeout(() => {
                this.read(filename, cb);
            }, 250);
        }
        else {
            // reads the file
            fs.readFile(filename, (err, data) => {
                if (err) {
                    this.raiseError(err);
                    cb(err, null);
                }
                else {
                    var treeStream = new Buffer(data);
                    zlib.gunzip(treeStream, (err, buffer) => {
                        if (err) {
                            this.raiseError(err);
                            cb(err, null);
                        }
                        else {
                            try {
                                var tree = JSON.parse(buffer.toString());
                            }
                            catch (e) {
                                this.raiseError(e);
                                return cb(e, null);
                            }
                            cb(null, tree);
                        }
                    });
                }
            });
        }
    }
    ;
    /**
     * Requests to flush the specified tree structure
     */
    save(filename, tree, cb) {
        if (this.waitProcessing) {
            clearTimeout(this.waitProcessing);
        }
        if (cb && this.pendingCb.indexOf(cb) === -1) {
            this.pendingCb.push(cb);
        }
        this.waitProcessing = setTimeout(this.processSave.bind(this, filename, tree), this.waitInterval);
    }
    ;
    /**
     * Flushing the error state
     */
    processSaveResult(result) {
        this.isProcessing = false;
        if (result instanceof Error) {
            this.raiseError(result);
        }
        this.pendingCb.forEach((item) => {
            item(result);
        });
        this.pendingCb = [];
    }
    /**
     * The real function that writes file
     */
    processSave(filename, tree) {
        if (this.isProcessing) {
            // wait until current flush is finished
            return this.save(filename, tree);
        }
        this.isProcessing = true;
        try {
            var output = JSON.stringify(tree);
            fs.writeFile(filename + '.tmp', output, (err) => {
                if (err) {
                    this.processSaveResult(err);
                }
                else {
                    try {
                        var gzip = zlib.createGzip();
                        var inp = fs.createReadStream(filename + '.tmp');
                        var out = fs.createWriteStream(filename);
                        inp.pipe(gzip).pipe(out).on('close', () => {
                            try {
                                fs.unlinkSync(filename + '.tmp');
                                this.processSaveResult(true);
                            }
                            catch (e) {
                                this.processSaveResult(e);
                            }
                        });
                    }
                    catch (e) {
                        this.processSaveResult(e);
                    }
                }
            });
        }
        catch (e) {
            this.processSaveResult(e);
        }
    }
}
exports.default = Storage;
//# sourceMappingURL=Storage.js.map
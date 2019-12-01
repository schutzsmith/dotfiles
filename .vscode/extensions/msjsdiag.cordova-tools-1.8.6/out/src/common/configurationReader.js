"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
class ConfigurationReader {
    static readArray(value) {
        if (this.isArray(value)) {
            return value;
        }
        else {
            throw `Expected an array. Couldn't read ${value}`;
        }
    }
    static isArray(value) {
        return Array.isArray(value);
    }
}
exports.ConfigurationReader = ConfigurationReader;

//# sourceMappingURL=configurationReader.js.map

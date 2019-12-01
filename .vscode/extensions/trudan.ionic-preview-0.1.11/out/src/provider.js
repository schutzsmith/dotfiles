"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
class Provider {
    constructor() {
        this._onDidChange = new vscode.EventEmitter();
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    getPreview(platform) {
        this.loadConfiguration();
        var html = Provider.htmlTemplateDevice;
        if (!platform) {
            platform = "undefined";
            html = Provider.htmlTemplate;
        }
        html = html.replace("{{basepath}}", path.dirname(__filename));
        html = html.replace("{{ionicHost}}", this._ionicHost);
        html = html.replace("{{ionicPort}}", this._ionicPort.toString());
        html = html.replace("{{platform}}", platform);
        return html;
    }
    loadConfiguration() {
        let config = vscode.workspace.getConfiguration("ionic-preview");
        let host = this._ionicHost, port = this._ionicPort;
        this._ionicHost = config.get("host", "127.0.0.1");
        this._ionicPort = config.get("port", 8100);
        if (host != this._ionicHost || port != this._ionicPort) {
            this._onDidChange.fire();
        }
    }
    createUrl(platform) {
        var uri = "{{scheme}}://authority/{{path}}";
        uri = uri.replace("{{scheme}}", Provider.scheme);
        //uri = uri.replace("{{host}}", this._ionicHost);
        //uri = uri.replace("{{port}}", this._ionicPort.toString());
        if (platform) {
            uri = uri.replace("{{path}}", platform);
        }
        else {
            uri = uri.replace("{{path}}", "");
        }
        return uri;
    }
    provideTextDocumentContent(uri, token) {
        return this.getPreview(uri.path.substring(1));
    }
}
Provider.scheme = "ionic-preview";
Provider.htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title></title>
          <meta charset="UTF-8">
          <link rel="stylesheet" type="text/css" href="{{basepath}}/styles.css">
        </head>
        <body class="ionic-preview ionic-preview-undefined">
            <iframe id="t1" src="http://{{ionicHost}}:{{ionicPort}}/"
                    width="360"
                    height="640"
                    frameborder="0"
                    scrolling="no"
                    style="pointer-events: auto;"></iframe>
        </body>
      </html>`;
Provider.htmlTemplateDevice = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title></title>
          <meta charset="UTF-8">
          <link rel="stylesheet" type="text/css" href="{{basepath}}/styles.css">
        </head>
        <body class="ionic-preview ionic-preview-{{platform}}">
          <aside id="platform-preview-2" class="platform-preview-2">
            <div id="demo-device-{{platform}}" class="{{platform}}">
              <iframe src="http://{{ionicHost}}:{{ionicPort}}/?ionicplatform={{platform}}"
                      width="360"
                      height="640"
                      frameborder="0"
                      scrolling="no"
                      style="pointer-events: auto;"></iframe>
            </div>
          </aside>
        </body>
      </html>`;
exports.default = Provider;
//# sourceMappingURL=provider.js.map
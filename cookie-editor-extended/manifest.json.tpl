{
  "name": "Cookie Editor - Extended",
  "version": "2.4.0",
  "manifest_version": 2,
  "description": "Simple yet powerful Cookie Editor that allow you to quickly create, edit and delete cookies without leaving your tab.",
  "icons": {
    "16": "icons/cookie-16-filled.png",
    "19": "icons/cookie-19-filled.png",
    "32": "icons/cookie-32-filled.png",
    "48": "icons/cookie-48-filled.png",
    "128": "icons/cookie-128-filled.png"
  },
  "offline_enabled": true,
  "incognito": "split",
  "background": {
    "scripts": [
      "interface/lib/browserDetector.js",
      "cookie-editor.js"
    ],
    "persistent": false
  },
  "browser_action": {
    "default_title": "Cookie-Editor",
    "default_popup": "interface/popup/cookie-list.html",
    "default_icon": {
      "16": "icons/cookie-16-filled.png",
      "19": "icons/cookie-19-filled.png",
      "32": "icons/cookie-32-filled.png",
      "48": "icons/cookie-48-filled.png"
    }
  },
  "devtools_page": "interface/devtools/devtool.html",
  "permissions": [
    "<all_urls>",
    "clipboardWrite",
    "cookies",
    "storage",
    "tabs"
  ],
  "browser_specific_settings": {
    "gecko": {
      "id": "crx-cookie-editor@warren-bank.github.io",
      "strict_min_version": "58.0"
    }
  }
}

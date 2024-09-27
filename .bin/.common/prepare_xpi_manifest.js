const fs = require('fs')

const manifest_filepath = process.argv[2]
const manifest          = require(manifest_filepath)

delete manifest.offline_enabled
delete manifest.incognito

for (let icons of [manifest.icons, manifest.browser_action.default_icon]) {
  icons[ '16'] = 'icons/cookie-filled-small.svg'
  icons[ '19'] = 'icons/cookie-filled-small.svg'
  icons[ '32'] = 'icons/cookie-filled-small.svg'
  icons[ '48'] = 'icons/cookie-filled.svg'
  icons['128'] = 'icons/cookie-filled.svg'
}

manifest.browser_action.theme_icons = [
  {
    "light": "icons/cookie-light-small.svg",
    "dark": "icons/cookie-small.svg",
    "size": 16
  },
  {
    "light": "icons/cookie-light-small.svg",
    "dark": "icons/cookie-small.svg",
    "size": 32
  },
  {
    "light": "icons/cookie-light.svg",
    "dark": "icons/cookie.svg",
    "size": 128
  }
]

fs.writeFileSync(
  manifest_filepath,
  JSON.stringify(manifest, null, 2),
  {encoding: 'utf8'}
)

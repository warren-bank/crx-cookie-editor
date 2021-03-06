function BrowserDetector() {
    'use strict';
    let namespace = window.browser || window.chrome;
    let browserName;
    let doesSupportSameSiteCookie = null;

    if (namespace === window.chrome) {
        browserName = 'chrome';
    }
    else if (namespace === window.browser) {
        let supportPromises = false;
        try {
            supportPromises = namespace.runtime.getPlatformInfo() instanceof Promise;
        }
        catch (e) {
        }

        if (supportPromises) {
            browserName = 'firefox';
        }
        else {
            browserName = 'edge';
        }
    }

    console.log(browserName);

    this.getApi = function () {
        return namespace;
    };

    this.isFirefox = function () {
        return browserName === 'firefox';
    };

    this.isChrome = function () {
        return browserName === 'chrome';
    };

    this.isEdge = function () {
        return browserName === 'edge';
    };

    this.supportSameSiteCookie = function () {
        return doesSupportSameSiteCookie;
    }

    this.runCapabilityDetectionTest_SameSiteCookie = function () {
        const newCookie = {
            url: 'https://example.com/',
            name: 'testSameSite',
            value: 'someValue',
            sameSite: 'strict',
        };

        try {
            if (this.isFirefox()) {
                this.getApi().cookies.set(newCookie).then(cookie => {
                    doesSupportSameSiteCookie = true;
                    this.cleanupCapabilityDetectionTest_SameSiteCookie(newCookie);
                }, error => {
                    console.error('Failed to create cookie', error);
                    doesSupportSameSiteCookie = false;
                });
            } else {
                this.getApi().cookies.set(newCookie, (cookieResponse) => {
                    let error = this.getApi().runtime.lastError;
                    if (!cookieResponse || error) {
                        console.error('Failed to create cookie', error);
                        doesSupportSameSiteCookie = false;
                        return;
                    }
                    doesSupportSameSiteCookie = true;
                    this.cleanupCapabilityDetectionTest_SameSiteCookie(newCookie);
                });
            }
        } catch(e) {
            doesSupportSameSiteCookie = false;
        }
    }

    this.cleanupCapabilityDetectionTest_SameSiteCookie = function(newCookie) {
        if (doesSupportSameSiteCookie) {
            try {
                if (this.isFirefox()) {
                    this.getApi().cookies.remove(newCookie).catch(() => {});
                } else {
                    this.getApi().cookies.remove(newCookie, () => {});
                }
            } catch(e) {}
        }
    };

    // initialize the value of doesSupportSameSiteCookie
    this.runCapabilityDetectionTest_SameSiteCookie();
}

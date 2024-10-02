(function () {
    'use strict';

    let containerCookie;
    let cookiesListHtml;
    let pageTitleContainer;
    let searchContainer;
    let notificationElement;
    let loadedCookies = {};
    let filteredCookiesRegex = null;
    let disableButtons = false;

    let showAllAdvanced;

    let notificationQueue = [];
    let notificationTimeout;
    const browserDetector = new BrowserDetector();

    const cookieHandler = new CookieHandler();

    document.addEventListener('DOMContentLoaded', function () {
        containerCookie = document.getElementById('cookie-container');
        notificationElement = document.getElementById('notification');
        pageTitleContainer = document.getElementById('pageTitle');
        searchContainer = document.getElementById('searchContainer');

        function expandCookie(e) {
            const parent = e.target.closest('li');
            Animate.toggleSlide(parent.querySelector('.expando'));
            parent.querySelector('.header').classList.toggle('active');
        }

        function copyButton(e) {
            e.preventDefault();
            console.log('copying cookie value to clipboard...');
            const listElement = e.target.closest('li');
            copyCookie(listElement.id);
            return false;
        }

        function deleteButton(e) {
            e.preventDefault();
            console.log('removing cookie...');
            const listElement = e.target.closest('li');
            removeCookie(listElement.id);
            return false;
        }

        function saveCookieForm(form) {
            let isCreateForm = form.classList.contains('create');

            const id = form.dataset.id;
            const name = form.querySelector('input[name="name"]').value;
            const value = form.querySelector('textarea[name="value"]').value;

            let domain;
            let path;
            let expiration;
            let sameSite;
            let hostOnly;
            let session;
            let secure;
            let httpOnly;

            if (!isCreateForm) {
                domain = form.querySelector('input[name="domain"]').value;
                path = form.querySelector('input[name="path"]').value;
                expiration = form.querySelector('input[name="expiration"]').value;
                sameSite = form.querySelector('select[name="sameSite"]').value;
                hostOnly = form.querySelector('input[name="hostOnly"]').checked;
                session = form.querySelector('input[name="session"]').checked;
                secure = form.querySelector('input[name="secure"]').checked;
                httpOnly = form.querySelector('input[name="httpOnly"]').checked;
            }

            saveCookie(
                id,
                {
                    name,
                    value,
                    domain,
                    path,
                    expiration,
                    sameSite,
                    hostOnly,
                    session,
                    secure,
                    httpOnly
                }
            );

            return false;
        }

        function saveCookie(oldCookieId, newCookie) {
            console.log('saving cookie...');

            if (newCookie.session) {
                newCookie.expirationDate = null;
            } else {
                let expirationDate
                expirationDate = !!newCookie.expiration
                    ? new Date(newCookie.expiration).getTime()
                    : NaN;
                expirationDate = isNaN(expirationDate) ? null : (expirationDate / 1000);

                newCookie.expirationDate = expirationDate;
                if (!expirationDate) {
                    newCookie.session = true;
                }
            }
            delete newCookie.expiration;

            const url = getCurrentTabUrl();
            {
                const error = Cookie.validate(newCookie, url);

                if (error) {
                    sendNotification(error);
                    return;
                }
            }

            const allCookieKeys = Object.keys(newCookie);
            const newCookieId = Cookie.hashCode(newCookie);
            const oldCookieContainer = oldCookieId ? loadedCookies[oldCookieId] : null;
            const oldCookie = oldCookieContainer ? oldCookieContainer.cookie : null;

            const onSaveCallback = function(error, cookie) {
                if (error) {
                    sendNotification(error);
                    return;
                }
                if (browserDetector.isEdge()) {
                    onCookiesChanged();
                }
                if ((oldCookieId === newCookieId) && oldCookieContainer) {
                    oldCookieContainer.showSuccessAnimation();
                } else {
                    showCookiesForTab();
                }
            };

            const doSave = function() {
                cookieHandler.saveCookie(newCookie, url, onSaveCallback);
            };

            const onRemoveCallback = doSave;

            const doRemove = function() {
                cookieHandler.removeCookie(oldCookie.name, url, onRemoveCallback);
            }

            let isUpdated = false;
            for (let key of allCookieKeys) {
                // remove undefined keys
                if (newCookie.hasOwnProperty(key) && (newCookie[key] === undefined)) {
                    delete newCookie[key];
                }

                // detect update
                if (oldCookie && !isUpdated && (newCookie[key] !== oldCookie[key])) {
                    isUpdated = true;
                }
            }

            if (oldCookie) {
                // edit pre-existing cookie

                if (!isUpdated) {
                    return;
                }

                if (oldCookieId === newCookieId) {
                    doSave();
                }
                else {
                    doRemove();
                }
            } else {
                // add new cookie

                // TODO: prevent duplication?

                doSave();
            }
        }

        function getExportedCookies(export_scope) {
            return new Promise((resolve, reject) => {
                switch(export_scope) {
                    case 'browser-all':
                        if (browserDetector.isFirefox()) {
                            browserDetector.getApi().cookies.getAllCookieStores()
                            .then(cookieStores => {
                                const cookiePromises = cookieStores.map(cookieStore => browserDetector.getApi().cookies.getAll({storeId: cookieStore.id}));

                                return Promise.all(cookiePromises)
                            })
                            .then(cookieArrays => {
                                const exportedCookies = [].concat.apply([], cookieArrays);

                                resolve(exportedCookies);
                            })
                            .catch(reject);
                        } else {
                            browserDetector.getApi().cookies.getAllCookieStores((cookieStores) => {
                                const exportedCookies = [];
                                let remaining = cookieStores.length;

                                const cookieCallback = (cookieArray) => {
                                    exportedCookies.push.apply(exportedCookies, cookieArray);

                                    remaining--;
                                    if (remaining <= 0) {
                                        resolve(exportedCookies);
                                    }
                                }

                                for (let cookieStore of cookieStores) {
                                    browserDetector.getApi().cookies.getAll({storeId: cookieStore.id}, cookieCallback);
                                }
                            });
                        }
                        break;
                    case 'tab-all':
                        resolve(
                            getUnfilteredCookiesForExport()
                        );
                        break;
                    case 'tab-filtered':
                        resolve(
                            getFilteredCookiesForExport()
                        );
                        break;
                    default:
                        reject(new Error('invalid export scope: ' + export_scope));
                }
            });
        }

        if (containerCookie) {
            containerCookie.addEventListener('click', e => {
                let target = e.target;
                if (target.nodeName === 'path') {
                    target = target.parentNode;
                }
                if (target.nodeName === 'svg') {
                    target = target.parentNode;
                }

                if (target.classList.contains('header')) {
                    return expandCookie(e);
                }
                if (target.classList.contains('copy')) {
                    return copyButton(e);
                }
                if (target.classList.contains('delete')) {
                    return deleteButton(e);
                }
                if (target.classList.contains('save')) {
                    return saveCookieForm(e.target.closest('li').querySelector('form'));
                }
            });
        }

        document.getElementById('searchField').addEventListener('keyup', e => {
          const filterText = e.target.value;
          updateFilteredCookiesRegex(filterText);
          filterCookies();
        });

        document.getElementById('create-cookie').addEventListener('click', () => {
            if (disableButtons) {
                return;
            }

            setPageTitle('Cookie Editor - Create a Cookie');

            disableButtons = true;
            console.log('strart transition');
            Animate.transitionPage(containerCookie, containerCookie.firstChild, createHtmlFormCookie(), 'left', () => {
                disableButtons = false;
            });
            console.log('after transition');

            document.getElementById('button-bar-default').classList.remove('active');
            document.getElementById('button-bar-add').classList.add('active');
            document.getElementById('name-create').focus();
            return false;
        });

        document.getElementById('delete-all-cookies').addEventListener('click', () => {
            if (areNoCookies()) {
                sendNotification('There are no cookies to delete');
                return;
            }

            let buttonIcon = document.getElementById('delete-all-cookies').querySelector('use');
            if (buttonIcon.getAttribute("href") === "../sprites/solid.svg#check") {
                return;
            }
            buttonIcon.setAttribute("href", "../sprites/solid.svg#check");
            setTimeout(() => {
                buttonIcon.setAttribute("href", "../sprites/solid.svg#trash");
            }, 1500);

            const filteredCookieIds = getFilteredCookieIds();
            const isFiltered = (filteredCookieIds.length < getUnfilteredCookiesCount());

            let remaining = filteredCookieIds.length;
            const onRemoveCallback = () => {
                remaining--;

                if (remaining <= 0) {
                    sendNotification('All ' + (isFiltered ? 'filtered ' : '') + 'cookies were deleted');

                    // Remove the search filter if all matching cookies were deleted
                    if (filteredCookiesRegex) {
                        const visibleCookiesCount = getFilteredCookiesCount(/* skipSearchFilter */ false, /* skipCheckboxFilter */ true);
                        if (!visibleCookiesCount) {
                            document.getElementById('searchField').value = '';
                            filteredCookiesRegex = null;
                            filterCookies();
                        }
                    }
                }
            };

            for (let cookieId of filteredCookieIds) {
                removeCookie(cookieId, onRemoveCallback);
            }
        });

        document.getElementById('import-cookies').addEventListener('click', () => {
            if (disableButtons) {
                return;
            }

            setPageTitle('Cookie Editor - Import Cookies');

            disableButtons = true;
            Animate.transitionPage(containerCookie, containerCookie.firstChild, createHtmlFormImport(), 'left', () => {
                disableButtons = false;
            });

            document.getElementById('button-bar-default').classList.remove('active');
            document.getElementById('button-bar-import').classList.add('active');
            return false;
        });

        document.getElementById('export-cookies').addEventListener('click', () => {
            if (disableButtons) {
                return;
            }

            setPageTitle('Cookie Editor - Export Cookies');

            disableButtons = true;
            Animate.transitionPage(containerCookie, containerCookie.firstChild, createHtmlFormExport(), 'left', () => {
                disableButtons = false;
            });

            document.getElementById('button-bar-default').classList.remove('active');
            document.getElementById('button-bar-export').classList.add('active');
            return false;
        });

        document.getElementById('return-list-add').addEventListener('click', () => {
            showCookiesForTab(true);
        });
        document.getElementById('return-list-import').addEventListener('click', () => {
            showCookiesForTab(true);
        });
        document.getElementById('return-list-export').addEventListener('click', () => {
            showCookiesForTab(true);
        });

        containerCookie.addEventListener('submit', e => {
            e.preventDefault();
            saveCookieForm(e.target);
            return false;
        });

        document.getElementById('save-create-cookie').addEventListener('click', () => {
            saveCookieForm(document.querySelector('form'));
        });

        document.getElementById('save-import-cookie').addEventListener('click', async (e) => {
            let buttonIcon = document.getElementById('save-import-cookie').querySelector('use');
            if (buttonIcon.getAttribute("href") !== "../sprites/solid.svg#file-import") {
                return;
            }

            const showErrorIcon = () => {
                buttonIcon.setAttribute("href", "../sprites/solid.svg#times");
                setTimeout(() => {
                    buttonIcon.setAttribute("href", "../sprites/solid.svg#file-import");
                }, 1500);
            };

            const import_scope  = document.querySelector('input[type="radio"][name="import-scope"]:checked').value;
            const import_format = document.querySelector('input[type="radio"][name="import-format"]:checked').value;
            const import_from   = document.querySelector('input[type="radio"][name="import-from"]:checked').value;
            let importedCookies;

            switch(import_from) {
                case 'clipboard':
                    importedCookies = document.querySelector('textarea.clipboard').value;
                    break;
                case 'file':
                    const el = document.querySelector('input[type="file"]');
                    if (el.files && el.files.length) {
                        try {
                            importedCookies = await new Promise((resolve, reject) => {
                                const file   = el.files[0];
                                const reader = new FileReader();

                                reader.addEventListener('load',  () => {resolve(reader.result);});
                                reader.addEventListener('error', () => {reject(new Error('Could not read the file'));});
                                reader.readAsText(file);
                            });
                        }
                        catch(error) {
                            sendNotification(e.message);
                        }
                    }
                    else {
                        sendNotification("Please select a file");
                    }
                    break;
            }

            if (!importedCookies) {
                return;
            }

            switch(import_format) {
                case 'json':
                    try {
                        importedCookies = JSON.parse(importedCookies);
                    } catch (error) {
                        console.log("Error parsing JSON value:", importedCookies, error);
                        sendNotification("Could not parse the JSON value");
                        showErrorIcon();
                        return;
                    }
                    break;
            }

            if (!isArray(importedCookies)) {
                console.log("Invalid JSON:", importedCookies);
                sendNotification("The JSON is not valid");
                showErrorIcon();
                return;
            }

            const url_scope = (import_scope === 'tab')
                ? getCurrentTabUrl()
                : null;

            let remaining = importedCookies.length;
            let created   = 0;

            const onImportComplete = (success) => {
                if (success) created++;

                remaining--;
                if (remaining <= 0) {
                    const message = created + ' ' + ((created === 1) ? 'cookie was' : 'cookies were') + ' created';
                    sendNotification(message);
                    showCookiesForTab();
                }
            };

            importedCookies.forEach(cookie => {
                // Make sure we are using the right store ID. This is in case we are importing from a basic store ID and the
                // current user is using custom containers
                cookie.storeId = cookieHandler.currentTab.cookieStoreId;

                if (cookie.sameSite && cookie.sameSite === 'unspecified') {
                    cookie.sameSite = null;
                }

                if (import_scope === 'tab') {
                    const error = Cookie.validate(cookie, url_scope);

                    if (error) {
                        const message = JSON.stringify({domain: cookie.domain, name: cookie.name}) + "\n\n" + error;
                        sendNotification(message);
                        onImportComplete(false);
                        return;
                    }
                }

                const url = url_scope || Cookie.getValidUrl(cookie);

                cookieHandler.saveCookie(cookie, url, function(error, cookie) {
                    if (error) {
                        const message = JSON.stringify({domain: cookie.domain, name: cookie.name}) + "\n\n" + error;
                        sendNotification(message);
                    }
                    onImportComplete(!error);
                });
            });
        });

        document.getElementById('save-export-cookie').addEventListener('click', async (e) => {
            const buttonIcon = document.getElementById('save-export-cookie').querySelector('use');
            if (buttonIcon.getAttribute("href") !== "../sprites/solid.svg#file-export") {
                return;
            }

            const export_scope  = document.querySelector('input[type="radio"][name="export-scope"]:checked').value;
            const export_format = document.querySelector('input[type="radio"][name="export-format"]:checked').value;
            const export_to     = document.querySelector('input[type="radio"][name="export-to"]:checked').value;
            let exportedCookies;

            // sanity check: this should never happen
            switch(export_scope) {
                case 'tab-all':
                case 'tab-filtered':
                    if (areNoCookies()) {
                        sendNotification('There are no cookies to export');
                        return;
                    }
                    break;
            }

            exportedCookies = await getExportedCookies(export_scope);

            if (!exportedCookies || !exportedCookies.length) {
                sendNotification('There are no cookies to export');
                return;
            }

            switch(export_format) {
                case 'json':
                    exportedCookies = JSON.stringify(exportedCookies, null, 4);
                    break;
                case 'request-header':
                    exportedCookies = formatExportedCookiesInRequestHeader(exportedCookies);
                    break;
                case 'netscape':
                    exportedCookies = formatExportedCookiesInNetscape(exportedCookies);
                    break;
            }

            switch(export_to) {
                case 'clipboard':
                    copyText(exportedCookies);
                    sendNotification('Cookies exported to clipboard');
                    break;
                case 'file':
                    saveText(exportedCookies);
                    break;
            }

            showCookiesForTab(true);
        });

        document.querySelector('#advanced-toggle-all input').addEventListener('change', function() {
            showAllAdvanced = this.checked;
            browserDetector.getApi().storage.local.set({showAllAdvanced: showAllAdvanced});
            for (let cookieId in loadedCookies) {
                loadedCookies[cookieId].updateShowAdvancedForm(showAllAdvanced);
            }
            showCookiesForTab(true);
        });

        document.querySelector('#select-toggle-all input').addEventListener('change', function() {
            const selectAll = this.checked;
            for (let cookieId in loadedCookies) {
                loadedCookies[cookieId].updateFilterInclude(selectAll);
            }
            showCookiesForTab(true);
        });

        notificationElement.addEventListener('animationend', e => {
            if (notificationElement.classList.contains('fadeInUp')) {
                return;
            }

            triggerNotification();
        });

        document.getElementById('notification-dismiss').addEventListener('click', e => {
            hideNotification();
        });

        initWindow();
        showCookiesForTab();
        adjustWidthIfSmaller();

        if (chrome && chrome.runtime && chrome.runtime.getBrowserInfo) {
            chrome.runtime.getBrowserInfo(function (info) {
                const mainVersion = info.version.split('.')[0];
                if (mainVersion < 57) {
                    containerCookie.style.height = '600px';
                }
            });
        }

        // Bugfix/hotfix for Chrome 84. Let's remove this once Chrome 90 or later is released
        if (browserDetector.isChrome()) {
            console.log('chrome 84 hotfix');
            document.querySelectorAll('svg').forEach(x => {x.innerHTML = x.innerHTML});
        }
    });

    // == End document ready == //
    // == Start loadedCookies filters == //

    function areNoCookies() {
        return !getUnfilteredCookiesCount();
    }

    function getFilteredCookieIds(skipSearchFilter, skipCheckboxFilter) {
        const filteredCookieIds = [];
        let cookieContainer, passesFilter;

        for (let cookieId in loadedCookies) {
            cookieContainer = loadedCookies[cookieId];
            passesFilter = true
                && (
                    skipSearchFilter ||
                    !filteredCookiesRegex ||
                    cookieContainer.cookie.name.match(filteredCookiesRegex)
                )
                && (
                    skipCheckboxFilter ||
                    cookieContainer.filterInclude
                );

            if (passesFilter) {
                filteredCookieIds.push(cookieId);
            }
        }
        return filteredCookieIds;
    }

    function getFilteredCookies(skipSearchFilter, skipCheckboxFilter) {
        const filteredCookies = [];
        const filteredCookieIds = getFilteredCookieIds(skipSearchFilter, skipCheckboxFilter);
        let cookieContainer, filteredCookie;

        for (let cookieId of filteredCookieIds) {
            cookieContainer = loadedCookies[cookieId];

            filteredCookie = Object.assign({}, cookieContainer.cookie);
            filteredCookies.push(filteredCookie);
        }
        return filteredCookies;
    }

    function getFilteredCookiesCount(skipSearchFilter, skipCheckboxFilter) {
        const filteredCookies = getFilteredCookies(skipSearchFilter, skipCheckboxFilter);
        return filteredCookies.length;
    }

    function getFilteredCookiesForExport(skipSearchFilter, skipCheckboxFilter) {
        const filteredCookies = getFilteredCookies(skipSearchFilter, skipCheckboxFilter);
        for (let filteredCookie of filteredCookies) {
            filteredCookie.storeId = null;

            if (filteredCookie.sameSite === 'unspecified') {
                filteredCookie.sameSite = null;
            }
        }
        return filteredCookies;
    }

    function getUnfilteredCookies() {
        const unfilteredCookies = getFilteredCookies(true, true);
        return unfilteredCookies;
    }

    function getUnfilteredCookiesCount() {
        return Object.keys(loadedCookies).length;
    }

    function getUnfilteredCookiesForExport() {
        const unfilteredCookies = getFilteredCookiesForExport(true, true);
        return unfilteredCookies;
    }

    // == End loadedCookies filters == //

    function showCookiesForTab(skipReload) {
        if (!cookieHandler.currentTab) {
            return;
        }
        if (disableButtons) {
            return;
        }
        if (showAllAdvanced === undefined) {
            if (browserDetector.isFirefox()) {
                browserDetector.getApi().storage.local.get('showAllAdvanced').then(function (onGot) {
                    showAllAdvanced = onGot.showAllAdvanced || false;
                    document.querySelector('#advanced-toggle-all input').checked = showAllAdvanced;
                    return showCookiesForTab(skipReload);
                });
            } else {
                browserDetector.getApi().storage.local.get('showAllAdvanced', function (onGot) {
                    showAllAdvanced = onGot.showAllAdvanced || false;
                    document.querySelector('#advanced-toggle-all input').checked = showAllAdvanced;
                    return showCookiesForTab(skipReload);
                });
            }
            return;
        }

        const onReload = () => {
            setPageTitle('Cookie Editor', /* showSearchFilter */ true);

            const subtitleLine = document.querySelector('.titles h2');
            if (subtitleLine) {
                const domain = getDomainFromUrl(cookieHandler.currentTab.url);
                subtitleLine.textContent = domain || cookieHandler.currentTab.url;
            }

            document.getElementById('button-bar-add').classList.remove('active');
            document.getElementById('button-bar-import').classList.remove('active');
            document.getElementById('button-bar-export').classList.remove('active');
            document.getElementById('button-bar-default').classList.add('active');

            if (areNoCookies()) {
                showNoCookies();
            }
            else {
                cookiesListHtml = document.createElement('ul');

                const cookieContainers = Object.values(loadedCookies);
                cookieContainers.sort(sortCookieContainersByCookieName);

                for (let cookieContainer of cookieContainers) {
                    cookiesListHtml.appendChild(cookieContainer.html);
                }

                if (containerCookie.firstChild) {
                    disableButtons = true;
                    Animate.transitionPage(containerCookie, containerCookie.firstChild, cookiesListHtml, 'right', () => {
                        filterCookies();
                        disableButtons = false;
                    });
                } else {
                    containerCookie.appendChild(cookiesListHtml);
                    filterCookies();
                }
            }

            // Bugfix/hotfix for Chrome 84. Let's remove this once Chrome 90 or later is released
            if (browserDetector.isChrome()) {
                console.log('chrome 84 hotfix');
                document.querySelectorAll('svg').forEach(x => {x.innerHTML = x.innerHTML});
            }
        };

        if (skipReload) {
            onReload();
        }
        else {
            cookieHandler.getAllCookies(function (cookies) {
                loadedCookies = {};
                if (cookies.length > 0) {
                    cookies.forEach(function (cookie) {
                        let id = Cookie.hashCode(cookie);
                        loadedCookies[id] = new Cookie(id, cookie, showAllAdvanced);
                    });
                }
                onReload();
            });
        }
    }

    function showNoCookies() {
        if (disableButtons) {
            return;
        }
        cookiesListHtml = null;
        let html = document.importNode(document.getElementById('tmp-empty').content, true).querySelector('p');
        if (containerCookie.firstChild) {
            if (containerCookie.firstChild.id === 'no-cookie') {
                return;
            }
            disableButtons = true;
            Animate.transitionPage(containerCookie, containerCookie.firstChild, html, 'right', () => {
                disableButtons = false;
            });
        } else {
            containerCookie.appendChild(html);
        }
    }

    function createHtmlForCookie(name, value, id) {
        const cookie = new Cookie(id, {
            'name': name,
            'value': value
        });

        return cookie.html;
    }

    function createHtmlFormCookie_basic() {
        let template = document.importNode(document.getElementById('tmp-create').content, true);
        return template.querySelector('form');
    }

    function createHtmlFormCookie_advanced() {
        const cookieContainer = new Cookie(null, null, showAllAdvanced);
        const form = cookieContainer.html.querySelector('form');
        form.classList.remove('create');
        return form;
    }

    function createHtmlFormCookie() {
        return createHtmlFormCookie_advanced();
    }

    function createHtmlFormImport() {
        const template = document.importNode(document.getElementById('tmp-import').content, true);
        const form = template.querySelector('form');

        // conditionally show input elements
        const onChange_import_from = function() {
            const expando_clipboard = form.querySelector('.expando.clipboard');
            const expando_file      = form.querySelector('.expando.file');
            const import_from       = form.querySelector('input[type="radio"][name="import-from"]:checked').value;

            switch(import_from) {
                case 'clipboard':
                    Animate.closeSlide(expando_file, function() {
                        Animate.openSlide(expando_clipboard);
                    });
                    break;
                case 'file':
                    Animate.closeSlide(expando_clipboard, function() {
                        Animate.openSlide(expando_file);
                    });
                    break;
            }
        }

        form.querySelectorAll('input[type="radio"][name="import-from"]').forEach(el => {
            el.addEventListener('change', onChange_import_from);
        });

        containerCookie.addEventListener('transitionend', onChange_import_from, {
            'passive': true,
            'once': true
        });

        return form;
    }

    function createHtmlFormExport() {
        const template = document.importNode(document.getElementById('tmp-export').content, true);
        const form = template.querySelector('form');
        const noCookies = areNoCookies();
        let radio, listitem;

        // conditionally hide tab scope when tab has no cookies
        if (noCookies) {
            radio = form.querySelector('input[type="radio"][name="export-scope"][value="tab-all"]');
            if (radio) {
                radio.checked = false;
                listitem = radio.parentElement;
                listitem.classList.add('hide');
            }
        }

        // conditionally hide filtered scope when tab has no cookies, all cookies in tab are filtered, or no filter is active
        const filteredCookiesCount = getFilteredCookiesCount();
        if (noCookies || !filteredCookiesCount || (getUnfilteredCookiesCount() === filteredCookiesCount)) {
            radio = form.querySelector('input[type="radio"][name="export-scope"][value="tab-filtered"]');
            if (radio) {
                radio.checked = false;
                listitem = radio.parentElement;
                listitem.classList.add('hide');
            }
        }

        // conditionally update the scope option selected by default
        if (noCookies) {
            radio = form.querySelector('input[type="radio"][name="export-scope"][value="browser-all"]');
            if (radio) {
                radio.checked = true;
            }
        }

        return form;
    }

    function copyCookie(cookieId) {
        const cookieContainer = loadedCookies[cookieId];
        if (!cookieContainer) {
            return;
        }

        const value = cookieContainer.cookie.value;
        copyText(value);
        sendNotification('Cookie value copied to clipboard');
    }

    function removeCookie(cookieId, callback) {
        const cookieContainer = loadedCookies[cookieId];
        const doCallback = () => {
            if (callback) {
                callback();
            }
        };

        if (!cookieContainer) {
            doCallback();
            return;
        }

        const name = cookieContainer.cookie.name;
        const url  = getCurrentTabUrl();

        cookieHandler.removeCookie(name, url, function (errorMessage, cookieResponse) {
            if (errorMessage) {
                console.log('error removing cookie', {name, url}, errorMessage);
                doCallback();
                return;
            }

            console.log('removed successfully', {name, url});

            cookieContainer.removeHtml(() => {
                if (areNoCookies()) {
                    showNoCookies();
                }
            });
            delete loadedCookies[cookieId];

            if (browserDetector.isEdge()) {
                onCookiesChanged();
            }

            doCallback();
        });
    }

    function onCookiesChanged(changeInfo) {
        if (!changeInfo) {
            showCookiesForTab();
            return;
        }

        console.log('Cookies have changed!', changeInfo.removed, changeInfo.cause);
        const id = Cookie.hashCode(changeInfo.cookie);

        if (changeInfo.cause === 'overwrite') {
            return;
        }

        if (changeInfo.removed) {
            if (loadedCookies[id]) {
                loadedCookies[id].removeHtml(() => {
                    if (areNoCookies()) {
                        showNoCookies();
                    }
                });
                delete loadedCookies[id];
            }
            return;
        }

        if (loadedCookies[id]) {
            loadedCookies[id].updateHtml(changeInfo.cookie);
            return;
        }

        const newCookie = new Cookie(id, changeInfo.cookie);
        loadedCookies[id] = newCookie;

        if (!cookiesListHtml && document.getElementById('no-cookies')) {
            clearChildren(containerCookie);
            cookiesListHtml = document.createElement('ul');
            containerCookie.appendChild(cookiesListHtml);
        }

        if (cookiesListHtml) {
            cookiesListHtml.appendChild(newCookie.html);
        }

        filterCookies();
    }

    function onCookieHandlerReady() {
        showCookiesForTab();
    }

    function sortCookieContainersByCookieName(a, b) {
        const aName = a.cookie.name.toLowerCase();
        const bName = b.cookie.name.toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    }

    function initWindow(tab) {
        cookieHandler.on('cookiesChanged', onCookiesChanged);
        cookieHandler.on('ready', onCookieHandlerReady);
    }

    function getCurrentTabUrl() {
        if (cookieHandler.currentTab) {
            return cookieHandler.currentTab.url;
        }
        return '';
    }

    function getDomainFromUrl(url) {
        const matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
        return matches && matches[1];
    }

    function sendNotification(message) {
        notificationQueue.push(message);
        triggerNotification();
    }

    function triggerNotification() {
        if (!notificationQueue || !notificationQueue.length) {
            return;
        }
        if (notificationTimeout) {
            return;
        }
        if (notificationElement.classList.contains('fadeInUp')) {
            return;
        }

        showNotification();
    }

    function showNotification() {
        if (notificationTimeout) {
            return;
        }

        notificationElement.querySelector('span').textContent = notificationQueue.shift();
        notificationElement.classList.add('fadeInUp');
        notificationElement.classList.remove('fadeOutDown');

        notificationTimeout = setTimeout(() => {
            hideNotification();
        }, 2500);
    }

    function hideNotification() {
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
            notificationTimeout = null;
        }
        notificationElement.classList.remove('fadeInUp');
        notificationElement.classList.add('fadeOutDown');
    }

    function setPageTitle(title, showSearchFilter) {
        if (pageTitleContainer) {
            pageTitleContainer.querySelector('h1').textContent = title;
        }
        if (searchContainer) {
            if (showSearchFilter) {
                searchContainer.classList.remove('hide');
            } else {
                searchContainer.classList.add('hide');
            }
        }
    }

    function copyText(text) {
        navigator.clipboard.writeText(text)
        .catch(e => {
            copyText_fallbackStrategy(text);
        });
    }

    function copyText_fallbackStrategy(text) {
        const fakeText = document.createElement('textarea');
        fakeText.classList.add('clipboardCopier');
        fakeText.textContent = text;
        document.body.appendChild(fakeText);
        fakeText.focus();
        fakeText.select();
        document.execCommand('Copy');
        document.body.removeChild(fakeText);
    }

    function saveText(text) {
        let url;
        try {
            const blob = new Blob([text], {type: 'octet/stream'});
            url = window.URL.createObjectURL(blob);
        }
        catch(error) {
            url = 'data:application/octet-stream;base64,' + btoa(text);
        }

        const filename = 'cookies.txt';
        const anchor   = document.createElement('a');
        anchor.setAttribute('href', url);
        anchor.setAttribute('download', filename);
        anchor.click();
    }

    function formatExportedCookiesInRequestHeader(exportedCookies) {
        const pairs = [];

        exportedCookies.map(cookie => {
            if (cookie && cookie.name && cookie.value)
                pairs.push(`${cookie.name}=${cookie.value};`);
        });
        pairs.sort();

        const header = 'Cookie: ' + pairs.join(" ");

        return header;
    }

    function formatExportedCookiesInNetscape(exportedCookies) {
        // https://github.com/daftano/cookies.txt/blob/master/src/popup.js
        // http://www.cookiecentral.com/faq/#3.5

        const tabUrl = cookieHandler.currentTab.url;
        const domain = getDomainFromUrl(tabUrl);

        let text = '';

        text += '# HTTP Cookie File for domains related to: "' + escapeForPre(domain) + '"' + "\n";
        text += '# Example: wget --load-cookies cookies.txt "' + escapeForPre(tabUrl) + '"' + "\n";
        text += '#' + "\n";

        let cookie;
        for (let i=0; i < exportedCookies.length; i++) {
            cookie = exportedCookies[i];

            text += escapeForPre(cookie.domain);
            text += "\t";
            text += escapeForPre((!cookie.hostOnly).toString().toUpperCase());
            text += "\t";
            text += escapeForPre(cookie.path);
            text += "\t";
            text += escapeForPre(cookie.secure.toString().toUpperCase());
            text += "\t";
            text += escapeForPre(cookie.expirationDate ? Math.round(cookie.expirationDate) : "0");
            text += "\t";
            text += escapeForPre(cookie.name);
            text += "\t";
            text += escapeForPre(cookie.value);
            text += "\n";
        }

        return text
    }

    function escapeForPre(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function isArray(value) {
        return value && typeof value === 'object' && value.constructor === Array;
    }

    function clearChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function adjustWidthIfSmaller() {
        // Firefox can have the window smaller if it is in the overflow menu
        if (!browserDetector.isFirefox()) {
            return;
        }

        let realWidth = document.documentElement.clientWidth;
        if (realWidth < 500) {
            console.log('Editor is smaller than 500px!');
            document.body.style.minWidth = '100%';
            document.body.style.width = realWidth + 'px';
        }
    }

    function updateFilteredCookiesRegex(filterText) {
      try {
        filteredCookiesRegex = filterText
          ? new RegExp(filterText, 'i')
          : null;
      }
      catch(error) {
        // silently ignore problems with regex pattern
      }
    }

    function filterCookies() {
        Array.from(document.getElementById('cookie-container').children[0].children)
        .map(cookieElement => {
            const cookieName = cookieElement.children[0].getElementsByTagName('span')[0].textContent.toLocaleLowerCase();
            if (!filteredCookiesRegex || cookieName.match(filteredCookiesRegex)) {
                cookieElement.classList.remove('hide');
            } else {
                cookieElement.classList.add('hide');
            }
        });
    }
}());

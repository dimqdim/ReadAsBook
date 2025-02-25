// // (c) @Mikhalych
let script;
let deepLtabId = null;
let translatedIndex = 0;
let translateProvider;
let needClose = false;

if (chrome) {
    if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            console.log("Слушаем сообщение: " + request.action + ".");
            if (request.action == "set-fullscreen") {
                if (request.value)
                    chrome.windows.update(sender.tab.windowId, { state: "fullscreen" });
                else {
                    if (request.origWindowState != null && request.origWindowState != "")
                        chrome.windows.update(sender.tab.windowId, { state: request.origWindowState });
                    else
                        chrome.windows.update(sender.tab.windowId, { state: "maximized" });
                }
                sendResponse();
            }

            if (request.action == "translate") {
                needClose = false;
                translate(request, function (provider, index, langFrom, langTo, orig, translated, error) {
                    sendResponse({
                        provider: provider,
                        index: index,
                        langFrom: langFrom,
                        langTo: langTo,
                        orig: orig,
                        translated: translated,
                        error: error
                    });
                });
                return true; // Signifies that we want to use sendResponse asynchronously
            }
            if (request.action == "stop-translate") {
                needClose = true;
                return true; // Signifies that we want to use sendResponse asynchronously
            }


            if (request.action === 'get-window-state') {
                chrome.windows.get(sender.tab.windowId, function (chromeWindow) {
                    // "normal", "minimized", "maximized" or "fullscreen"
                    sendResponse(chromeWindow.state);
                });
                return true; // Signifies that we want to use sendResponse asynchronously
            }

            if (request.action === 'get-script-src') {
                fetch(request.src)
                    .then(
                        function (response) {
                            if (response.ok) {

                                response.text().then(function (txt) {
                                    // console.log('get-script-src', txt);
                                    sendResponse(txt);
                                });
                            }
                        }
                    )
                    .catch(function (err) {
                        console.log('get-script-src Fetch Error :-S', err);
                    });
                return true; // Signifies that we want to use sendResponse asynchronously
            }

            if (request.action === 'google_translate_element') {
                // console.log('google_translate_element', script);

                chrome.scripting.executeScript(
                    {
                        target: { tabId: sender.tab.id },
                        files: ['https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit']
                    },
                    () => { sendResponse(sender.tab.id) });
                return true; // Signifies that we want to use sendResponse asynchronously
            }

            if (request.action == "log-message") {
                // Received a message from content script
                // console.log(request.action, request.message);
                return true; // Signifies that we want to use sendResponse asynchronously

            } else if (request.action == "create-menu") {
                // console.log(request.action, request.message);
                chrome.contextMenus.removeAll();
                chrome.contextMenus.create({
                    id: 'readerStart',
                    title: "Перейти в режим книжного чтения",
                    visible: true,
                    contexts: ["browser_action", "page"],
                });
                chrome.contextMenus.create({
                    id: 'readerStop',
                    title: "Остановить режим книжного чтения",
                    visible: false,
                    contexts: ["browser_action", "page"],
                });
                return true; // Signifies that we want to use sendResponse asynchronously

            } else if (request.action == "start-reader") {
                // console.log(request.action, request.message);
                startReader();
            } else if (request.action == "stop-reader") {
                // console.log(request.action, request.message);
                stopReader();
            } else if (request.action == 'start-translate') {

                // console.log('start-translate', request, request.provider);

                translateProvider = request.provider;
                translatedIndex = request.index;

                if (request.provider == 'DeepL') {
                    if (request.html != null && request.html != '') {

                        // Обязательно почистим куки перед переводом первого параграфа
                        if (translatedIndex == 0)
                            document.cookie = '';


                        let url = "https://www.deepl.com/translator#" +
                            request.from + "/" + request.to + "/" + translatedIndex + '.%20' + request.html;
                        chrome.tabs.query({
                            active: true,
                            currentWindow: true
                        }, function (tabs) {

                            // console.log(url, decodeURIComponent(request.html));

                            if (deepLtabId == null) {

                                chrome.tabs.create({
                                    url: url,
                                    openerTabId: tabs[0].id,
                                    index: tabs[0].index + 1,
                                    active: false
                                }, async tab => {

                                    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {

                                        if (info.status === 'complete' && tabId === tab.id) {
                                            chrome.tabs.onUpdated.removeListener(listener);
                                            deepLtabId = tab.id;
                                        }
                                    });

                                    chrome.tabs.onRemoved.addListener(function listener(tabId, info) {
                                        if (tabId === tab.id) {
                                            chrome.tabs.onRemoved.removeListener(listener);
                                            deepLtabId = null;
                                            // console.log('Open DeepL tab removed');
                                        }
                                    });
                                });
                            } else {
                                // console.log('update tab', url);
                                chrome.tabs.update(deepLtabId, {
                                    url: url,
                                    active: false
                                });
                            }
                        });
                    } else {
                        chrome.tabs.remove(deepLtabId);
                    }
                } else {
                    if (request.html != null && request.html != '')
                        translateOld(request, sender.tab, sendResponse);
                }
                return true; // Signifies that we want to use sendResponse asynchronously
            } else {
                console.log(request);
            }
        });
    }
}

// chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
//     var newRef = "https://www.deepl.com/";
//     var hasRef = false;
//     for (var n in details.requestHeaders) {
//         hasRef = details.requestHeaders[n].name == "Referer";
//         if (hasRef) {
//             details.requestHeaders[n].value = newRef;
//             break;
//         }
//     }
//     if (!hasRef) {
//         details.requestHeaders.push({ name: "Referer", value: newRef });
//     }
//     return { requestHeaders: details.requestHeaders };
// },
//     { urls: ["<all_urls>"] },
//     ["blocking", "requestHeaders"]);

async function translate(request, sendResponse) {
    if (needClose) return;
    try {
        let translated = null;
        let error = null;
        let resp;
        if (request.provider == "DeepL") {
            if (request.index > 0) {
                sendResponse(request.provider, request.index, request.langFrom, request.langTo, request.orig, "[" + request.orig + "]", error);
                return;
            }

            let payload = {
                access_token: undefined,
                body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "method": "LMT_handle_texts",
                    "params": {
                        "texts": [{
                            "text": request.orig
                        }],
                        "splitting": "newlines",
                        "lang":
                        {
                            "target_lang": "RU",
                            "source_lang_user_selected": "auto",
                            "preference": {
                                "weight": { "EN": 12.224910000000001 }
                            }
                        },
                        "timestamp": Date.now()
                    },
                    "id": random_id()
                }),
                headers: { "Content-Type": "application/json; charset=utf-8" },
                method: "POST",
                refresh_token: undefined,
                token_url: "https://w.deepl.com/oidc/token"
            };
            resp = await fetch("https://www2.deepl.com/jsonrpc?client=chrome-extension,0.18.2", {
                ...payload,
                headers: {
                    ...payload.headers,
                    Authorization: "None"
                }
            });

            // resp = await fetch("https://www2.deepl.com/jsonrpc?client=chrome-extension,0.18.2",
            //     {
            //         method: "POST",
            //         refresh_token: undefined,
            //         token_url: "https://w.deepl.com/oidc/token",
            //         body: JSON.stringify({
            //             "jsonrpc": "2.0",
            //             "method": "LMT_handle_texts",
            //             "params": {
            //                 "texts": [{
            //                     "text": request.orig
            //                 }],
            //                 "splitting": "newlines",
            //                 "lang":
            //                 {
            //                     "target_lang": "RU",
            //                     "source_lang_user_selected": "auto",
            //                     "preference": {
            //                         "weight": { "EN": 12.224910000000001 }
            //                     }
            //                 },
            //                 "timestamp": Date.now()
            //             },
            //             "id": random_id()
            //         }),
            //         headers: {
            //             "Content-Type": "application/json; charset=utf-8",
            //             "Authorization": "None"

            //         },
            //         referer: "https://www.deepl.com/"
            //     });

            if (needClose) return;
            if (resp.ok) {
                let json = await resp.json();
                console.log('DeepL. Разбили абзац на части:', json);
                tranlated = json.splitted_texts[0];
                sendResponse(request.provider, request.index, request.langFrom, request.langTo, request.orig, translated, error);
            }
            else {
                console.log('service_worker.js translate by"' + request.provider + '". ', resp);
                sendResponse(request.provider, request.index, request.langFrom, request.langTo, request.orig, '', '[status: ' + resp?.status + ',' + resp?.statusText + ']');
            }
            return;
        }
        if (request.provider == "DoTrans_google") {
            resp = await fetch("https://translate.google.com/translate_a/single",
                {
                    method: "POST",
                    body: JSON.stringify({
                        client: "gtx",
                        dt: "t",
                        dt: "bd",
                        dj: "1",
                        source: "input",
                        q: request.orig,
                        sl: "en",
                        tl: "ru",
                        hl: "en",
                        tk: "450919|494537"
                    }),
                    headers: {
                        "Accept": "*/*",
                        "Content-type": "application/x-www-form-urlencoded",
                    }
                });
        }
        if (needClose) return;
        if (resp?.ok) {
            if (request.provider == "DoTrans_google") {
                let json = await resp.json();

                translated = '';
                for (let i = 0; i < json.sentences.length; i++) {
                    if (json.sentences[i].trans != null) {
                        translated += json.sentences[i].trans;
                    }
                }
            }
            sendResponse(request.provider, request.index, request.langFrom, request.langTo, request.orig, translated, error);
        }
        else {
            console.log('service_worker.js translate by"' + request.provider + '". ', resp);
            sendResponse(request.provider, request.index, request.langFrom, request.langTo, request.orig, '', '[status: ' + resp?.status + ',' + resp?.statusText + ']');
        }

    }
    catch (ex) {
        console.log('service_worker.js exception on translate by"' + request.provider + '": ' + ex.message + '.');
        sendResponse(request.provider, request.index, request.langFrom, request.langTo, request.orig, '', '[error: ' + ex.message + ']');
    }
}

function random_id() {
    let e = new Uint32Array(1);
    return crypto.getRandomValues(e), e[0]
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId == "readerStart") {
        startReader();
    }
    else if (info.menuItemId == "readerStop") {
        stopReader();
    }
});

if (chrome.webRequest && chrome.webRequest.onCompleted) {
    chrome.webRequest.onCompleted.addListener(
        function (details) {
            if (details.url == "https://www2.deepl.com/jsonrpc") {

                if (deepLtabId != null) {
                    if (details.statusCode == 200) {

                        // console.log('chrome.webRequest.onCompleted', details);
                        chrome.tabs.executeScript(
                            deepLtabId, {
                            code: `
                                if (document.querySelector('.lmt__target_textarea').value != null &&
                                    document.querySelector('.lmt__target_textarea').value != '') {
                                    chrome.runtime.sendMessage({
                                        action: "end-translate",
                                        index: ` + translatedIndex + `,
                                        source: document.querySelector('.lmt__source_textarea').value,
                                        target: document.querySelector('.lmt__target_textarea').value,
                                        provider: '` + translateProvider + `'
                                    });
                                }
                                `
                        });
                    } else {

                        // console.log('translation error', details);

                        chrome.tabs.query({
                            active: true,
                            currentWindow: true
                        }, function (tabs) {

                            let tab = tabs[0];
                            chrome.tabs.executeScript(
                                tab.id, {
                                code: `
                                        if (window.updateTranslatedElement)
                                            window.updateTranslatedElement(` + translatedIndex + ",`" +
                                    "translation error, code = " + details.statusCode + "`, true, '" + translateProvider + "');"
                            });
                        });
                    }
                }
            }
        }, {
        urls: ["<all_urls>"],
        types: ['xmlhttprequest']
    },
        ['extraHeaders']);
}
if (chrome.webRequest && chrome.webRequest.onErrorOccurred) {
    chrome.webRequest.onErrorOccurred.addListener(
        function (details) {
            if (details.url == "https://www2.deepl.com/jsonrpc") {
                console.log('onErrorOccurred', details);

                if (deepLtabId != null) {
                    // console.log('translation onErrorOccurred', details);

                    chrome.tabs.query({
                        active: true,
                        currentWindow: true
                    }, function (tabs) {

                        let tab = tabs[0];
                        if (tab.id != deepLtabId) {
                            chrome.tabs.executeScript(
                                tab.id, {
                                code: `
                                    if (window.updateTranslatedElement)
                                        window.updateTranslatedElement(` + translatedIndex + ",`" +
                                    "translation translation onErrorOccurred, code = " + details.statusCode + "`, true, '" + translateProvider + "');"
                            });
                        }
                    });
                }
            }
        }, {
        urls: ["<all_urls>"],
        types: ['xmlhttprequest']
    },
        ['extraHeaders']);
}

function startReader() {
    let script = document.createElement('script');
    script.setAttribute("src", "common.js");
    document.head.appendChild(script);
    script.onload = function () {
        let iframe = document.querySelector('iframe');
        if (iframe == null) {
            iframe = document.createElement('iframe');
            iframe.setAttribute("src", "reader/reader.html");
            document.body.appendChild(iframe);
            iframe.onload = function () {
                doOnStartRead(iframe);
            }
        } else
            doOnStartRead(iframe);
    }
}

async function doOnStartRead(iframe) {

    let readerDoc = iframe.contentWindow.document;
    let headNodes = readerDoc.head.childNodes;
    for (let i = headNodes.length - 1; i >= 0; i--) {
        let name = headNodes[i].nodeName.toLowerCase();
        if (name == 'link' || name == 'script')
            headNodes[i].remove();
    }

    await loadIcoFontCss();
    window.styleIcoFont = readerDoc.createElement('style');
    window.styleIcoFont.setAttribute('id', 'styleIcoFont')
    window.styleIcoFont.innerHTML = window.icoFontCss.replace(/&#92;/ig, "\\\\");
    readerDoc.head.appendChild(window.styleIcoFont);

    window.readerPage = saveHtmlData(readerDoc);

    if (window.readerPage != null) {

        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {

            let tab = tabs[0];
            if (tab.url.startsWith('http') ||
                tab.url.startsWith('https') ||
                tab.url.startsWith('file') ||
                tab.url.startsWith('content')) {

                chrome.tabs.executeScript(
                    tab.id, {
                    code: `
                        window.readerPage = new Object();
                        window.readerPage.htmlAttr = ` + "`" + window.readerPage.htmlAttr + "`" + `;
                        window.readerPage.headAttr = ` + "`" + window.readerPage.headAttr + "`" + `;
                        window.readerPage.headHtml = ` + "`" + window.readerPage.headHtml + "`" + `;
                        window.readerPage.bodyAttr = ` + "`" + window.readerPage.bodyAttr + "`" + `;
                        window.readerPage.bodyHtml = ` + "`" + window.readerPage.bodyHtml + "`" + `;`
                });

                insertCSS(tab.id, 'reader/reader.css', function () {
                    executeScript(tab.id, 'common.js', function () {
                        executeScript(tab.id, 'lib/Readability.js', function () {
                            executeScript(tab.id, 'wrapper.js', function () {
                                executeScript(tab.id, 'reader/reader.js', function () {
                                    chrome.tabs.executeScript(
                                        tab.id, {
                                        code: 'startReader();'
                                    },
                                        function () {

                                            chrome.browserAction.setBadgeText({
                                                tabId: tab.id,
                                                text: 'on'
                                            }, () => { });
                                            chrome.contextMenus.update(
                                                "readerStart", {
                                                visible: false
                                            }, () => { });
                                            chrome.contextMenus.update(
                                                "readerStop", {
                                                visible: true
                                            }, () => { });

                                        });
                                });
                            });
                        });
                    });
                });
            }
        });
    }
}

function stopReader() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {

        let tab = tabs[0];
        chrome.tabs.executeScript(
            tab.id, {
            code: 'stopReader();'
        });
        chrome.browserAction.setBadgeText({
            tabId: tab.id,
            text: ''
        }, () => { });

        chrome.contextMenus.update("readerStart", {
            visible: true
        }, () => { });
        chrome.contextMenus.update("readerStop", {
            visible: false
        }, () => { });
    });
}


async function loadIcoFontCss() {
    let resp = await fetch('./icofont.min.css');
    if (resp.ok) {
        let icoFontCss = await resp.text();
        window.icoFontCss =
            icoFontCss.replace(/fonts\/icofont.woff2\)/ig, chrome.runtime.getURL('fonts/icofont.woff2') + ')')
                .replace(/fonts\/icofont.woff\)/ig, chrome.runtime.getURL('fonts/icofont.woff') + ')')
                .replace(/fonts\/icofont.ttf\)/ig, chrome.runtime.getURL('fonts/icofont.ttf') + ')')
                .replace(/fonts\/icofont.svg\)/ig, chrome.runtime.getURL('fonts/icofont.svg') + ')')
                .replace(/fonts\/icofont.eot\)/ig, chrome.runtime.getURL('fonts/icofont.eot') + ')')
                .replace(/\\/ig, '&#92;');

    }

    resp = await fetch('./font.css');
    if (resp.ok) {
        let fontCss = await resp.text();
        window.icoFontCss +=
            fontCss.replace(/fonts\/standard.woff2\)/ig, chrome.runtime.getURL('fonts/standard.woff2') + ')')
                .replace(/fonts\/standard.woff\)/ig, chrome.runtime.getURL('fonts/standard.woff') + ')')
                .replace(/fonts\/standard.ttf\)/ig, chrome.runtime.getURL('fonts/standard.ttf') + ')')
                .replace(/fonts\/standard.svg\)/ig, chrome.runtime.getURL('fonts/standard.svg') + ')')
                .replace(/fonts\/standard.eot\)/ig, chrome.runtime.getURL('fonts/standard.eot') + ')')
                .replace(/\\/ig, '&#92;');

    }

    // console.log(window.icoFontCss);
}

async function translateOld(request, tab, sendResponse) {

    try {

        let html = decodeURIComponent(request.html)
        if (html.length > 512) {
            // Слишком длинный абзац придется разбивать...

        }

        let url;
        let data;
        switch (request.provider) {
            case 'Google':
                url = 'https://translate.googleapis.com/translate_a/single?' +
                    'client=gtx&source=input&dj=1&q=' + html +
                    '&sl=auto&tl=' + request.to + '&hl=' + request.to + '&dt=t&dt=bd&dt=rm&dt=rw&dt=qca';
                break;

            case 'GoogleApi':
                url = 'https://translate.googleapis.com/translate_a/single?' +
                    'client=gtx&sl=' + request.from + '&tl=' + request.to + '&dt=t&q=' + html;

                break;

            case 'Reverso':
                let resp = await fetch("https://api.reverso.net/translate/v1/translation", {
                    method: 'POST',
                    body: JSON.stringify({
                        format: "text",
                        from: "eng",
                        to: "rus",
                        input: html,
                        options: {
                            sentenceSplitter: true,
                            origin: "reversomobile",
                            contextResults: true,
                            languageDetection: true
                        }
                    }),
                    headers: {
                        "Accept": "*/*",
                        "Connection": "keep-alive",
                        "User-Agent": "Mozilla/5.0(WindowsNT10.0;Win64;x64)AppleWebKit/537.36(KHTML,likeGecko)Chrome/" + 59 + Math.round(Math.random() * 10) + ".0.3497." + Math.round(Math.random() * 100) + "Safari/537.36",
                        "Content-Type": "application/json",
                    },
                });
                if (resp.ok) {
                    let json =
                        // {
                        //     "id": "d80d9e98-622c-49c0-a01c-c9826848989d",
                        //     "from": "eng",
                        //     "to": "rus",
                        //     "input": ["He pulled up to a curve in the parking lot at her JC. He was driving a yellow Jeep CJ5, an older model, but in his eyes far better than the current models. Prior to arriving, he had texted her what he would be driving. But he had no idea what she looked like. Although she had followed his account, had not followed her back (personal rule of his). Her avatar was, predictably, a Jewel. As he waited, he glanced up and saw any number of coeds walking out to the parking, but one in particular caught his eye. She was on the taller side, had long straight black hair that flowed like a waterfall. She was wearing a white crop top, and very short cutoff denim jean shorts. White Nike shoes completed the 'fit'."],
                        //     "correctedText": null,
                        //     "translation": ["Он подъехал к повороту на парковке у её дома. Он ехал на жёлтом джипе CJ5, более старой модели, но в его глазах намного лучше, чем нынешние модели. Перед приездом он написал ей, на чем будет ездить. Но он понятия не имел, как она выглядит. Хотя она следовала его рассказу, не последовала за ней назад (личное правило его). Ее аватар был, как и следовало ожидать, драгоценным камнем. Пока он ждал, он поднял голову и увидел, что на парковку выходят несколько студенток, но одна из них привлекла его внимание. Она была выше, у нее были длинные прямые черные волосы, которые текли как водопад. Она была одета в белый топ, и очень короткие джинсовые джинсовые шорты. Белые туфли Nike завершили 'fit'."],
                        //     "engines": ["NMT"],
                        //     "languageDetection": {
                        //         "detectedLanguage": "eng",
                        //         "isDirectionChanged": false,
                        //         "originalDirection": "eng-rus",
                        //         "originalDirectionContextMatches": 0,
                        //         "changedDirectionContextMatches": 0,
                        //         "timeTaken": 12
                        //     },
                        //     "contextResults": null,
                        //     "truncated": false,
                        //     "timeTaken": 734
                        // };
                        await resp.json();
                    target = json.translation[0];
                    source = html;
                    sendResponse([translatedIndex, target, false, translateProvider]);
                    return;
                }
                else {
                    translate_error(request, resp.status);
                    sendResponse([translatedIndex, '[' + resp.status + ',' + resp.statusText + '] ' + html, false, translateProvider]);
                    return;
                }

            case 'Yandex':
                url = 'https://browser.translate.yandex.net/api/v1/tr.json/translate?translateMode=balloon' +
                    '&context_title=' + 'Social%20Media%20Fun%20%26%20Games%20-%20Erotic%20Couplings%20-%20Literotica.com' +
                    '&id=1811f7da1c061331-6-0' +
                    '&srv=yabrowser' +
                    // '&text=%26apos%3BMy%20bf%20told%20me%20%26apos%3Blook%20me%20in%20my%20eyes%26apos%3B%20as%20I%20gave%20him%20a%20blow%20job...when%20I%20looked' +
                    // '&text=up...he%20came%20in%20my%20mouth%26apos%3B' +
                    // '&text=Tom%20thought%20back%20to%20a%20particular%20experience%20during%20college%2C%20and%20commented%2C' +
                    // '&text=%26quot%3BYour%20****%20is%20bigger%20soft%2C%20than%20most%20guys%20when%20they%26apos%3Bre%20hard.%26quot%3B' +
                    // '&text=The%20next%20day%2C%20he%20had%2063%20notifications%20%26apos%3Bliking%26apos%3B%20the%20comment.%20He%20also%20had%20a%20DM%20that%20was%20from%20someone%20he%20didn%26apos%3Bt%20know.%20He%20had%20to%20approve%20the%20message%2C%20which%20he%20did.%20Jewel_Opal%20wrote%3A' +
                    // '&text=(Hey%20x)' +
                    // '&text=(uhh%20could%20i%20ask%20you%20a%20question%20ahah%3F)' +
                    // '&text=(sure)' +
                    // '&text=(is%20it%20actually%20that%20big%3F)' +
                    // '&text=(Lol)' +
                    '&text=' + html +
                    '&lang=en-ru' +
                    '&format=html' +
                    '&options=2&';
                // url = 'https://translate.yandex.net/api/v1/tr.json/translate?srv=yawidget&options=1&lang=' +
                //     request.to + '&text=' + html;
                break;

            case 'Microsoft':
                break;

            case 'Microsoft':
                break;

            case 'DoTrans_Translator':
            case 'DoTrans_Microsoft':
            case 'DoTrans_Yandex':
            case 'DoTrans_Google':
                let dotransprovider = request.provider.replace('DoTrans_', '');
                if (dotransprovider == null ||
                    dotransprovider == '') {
                    dotransprovider = "Google";
                }
                url = 'https://webmail.smartlinkcorp.com/dotrans.php?' +
                    "dir=" + request.from + "/" + request.to +
                    "&provider=" + dotransprovider.toLowerCase() +
                    "&text=" + html;
                break;
        }

        if (url == null) return;


        let resp = await fetch(url);
        if (resp.ok) {
            let source = '';
            let target = '';
            let translatedJson;
            let translatedText;
            switch (request.provider) {
                case 'Google':
                    translatedJson = await resp.json();

                    for (let i = 0; i < translatedJson.sentences.length; i++) {
                        if (translatedJson.sentences[i].trans != null) {
                            target += translatedJson.sentences[i].trans.replace(/`/gi, "\\`");
                            source += translatedJson.sentences[i].orig.replace(/`/gi, "\\`");
                        }
                    }

                    break;

                case 'GoogleApi':
                    translatedJson = await resp.json();
                    for (let i = 0; i < translatedJson[0].length; i++) {
                        target += translatedJson[0][i][0].replace(/`/gi, "\\`");
                        source += translatedJson[0][i][1].replace(/`/gi, "\\`");
                    }
                    break;

                case 'Yandex':
                    translatedJson = await resp.json();
                    if (translatedJson.code == '200') {
                        target = translatedJson.text[0];
                        source = html;
                    } else {
                        translate_error(request, translatedJson.code);
                        return;
                    }
                    break;

                case 'Microsoft':
                    break;

                case 'DoTrans_Translator':
                case 'DoTrans_Microsoft':
                case 'DoTrans_Yandex':
                case 'DoTrans_Google':
                    translatedText = await resp.text();
                    if (translatedText == 'TRANSLATE service is temporarily unavailable')
                        throw new Error(translatedText)

                    source = decodeURIComponent(html).replace(/`/gi, "\\`");
                    target = translatedText.replace(/`/gi, "\\`");
                    break;
            }

            // chrome.runtime.sendMessage({
            //     action: "end-translate",
            //     index: translatedIndex,
            //     source: source,
            //     target: target,
            //     provider: translateProvider,
            //     tab: tab
            // });

            // console.log('translate', UpdateTranslatedElement, [translatedIndex, target, false, translateProvider]);
            // chrome.scripting.executeScript(
            //     tab.id, {
            //     func: UpdateTranslatedElement,
            //     args: [translatedIndex, target, false, translateProvider]
            // });

            sendResponse([translatedIndex, target, false, translateProvider]);
        } else {
            translate_error(request, resp.status);
            sendResponse([translatedIndex, '[' + resp.status + ',' + resp.statusText + '] ' + html, false, translateProvider]);
        }
    } catch (e) {
        translate_error(request, e.message);
        sendResponse([translatedIndex, '<error>' + e.message + '</error>', false, translateProvider]);
    }
}

function translate_error(request, message) {
    console.log('translate_error', request, message);
    // chrome.tabs.query({
    //     active: true,
    //     currentWindow: true
    // }, function (tabs) {

    //     let tab = tabs[0];
    //     chrome.tabs.executeScript(
    //         tab.id, {
    //         code: `
    //             if (window.updateTranslatedElement)
    //                 window.updateTranslatedElement(` + request.index + ",`" +
    //             "Translation error: " + message + ".`, true, '" + request.provider + "');"
    //     });
    // });
}

async function getGoogleScript() {
    fetch('https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit')
        .then(
            function (response) {
                if (response.ok) {

                    response.text().then(function (data) {
                        console.log(data);
                        return data;
                    });
                }
            }
        )
        .catch(function (err) {
            console.log('Fetch Error :-S', err);
        });

    // let resp = await fetch('https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit');
    // if (resp.ok) {
    //     let txt = await resp.text();
    //     return txt;
    //     //eval(resp.text);
    // }
    // return '';
}

async function googleTranslateElementInit(script) {
    try {
        console.log('googleTranslateElementInit 1');
        chrome.runtime.sendMessage({
            action: "get-script-src",
            src: 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
        }, function (result) {
            console.log('googleTranslateElementInit 2', result);

            createScriptForTranslate(document.head, null, result);

            console.log('googleTranslateElementInit 3');

            new google.translate.TranslateElement({
                includedLanguages: 'ru',
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                // layout: google.translate.TranslateElement.InlineLayout.VERTICAL,
                // layout: google.translate.TranslateElement.InlineLayout.HORIZONTAL,
                autoDisplay: false
            }, 'google_translate_element');

            console.log('googleTranslateElementInit 4', google);

        });
    }
    catch (ex) {
        console.log('googleTranslateElementInit Error', ex);
    }
}

async function UpdateTranslatedElement(index, html, stop, provider) {
    console.log('UpdateTranslatedElement', index, html, stop, provider);
    if (window.updateTranslatedElement)
        window.updateTranslatedElement(index, html, stop, provider)
}
// // console.log("service_worker loaded");
// (c) @Mikhalych

window.onload = function () {

    let btnRead = document.getElementById("btnRead");
    btnRead.onclick = function (element) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {

            let tab = tabs[0];
            if (tab.url.startsWith('http') ||
                tab.url.startsWith('https') ||
                tab.url.startsWith('file') ||
                tab.url.startsWith('content')) {

                let frameDoc = document.querySelector('#readerDoc');
                let readerHead = frameDoc.contentWindow.document.head.innerHTML;
                let readerBody = frameDoc.contentWindow.document.body.innerHTML;
                let readerBodyAttr = JSON.stringify(get_attributes(frameDoc.contentWindow.document.body));

                //chrome.runtime.sendMessage({action: "log", message: readerHead}, function(response) {});
                chrome.tabs.executeScript(
                    tab.id, {
                        // code: 'document.body.style.backgroundColor = "red";' + 'console.log("' + tabs[0].id + '");'
                        code: `
window.red_mode = false;
window.reader_head = ` + "`" + readerHead + "`" + `;
window.reader_body = ` + "`" + readerBody + "`" + `;
window.reader_body_attr = ` + "`" + readerBodyAttr + "`" + `;
//console.log(window.reader_body_attr);
`
                    });

                executeScript(tab.id, 'lib/Readability.js', function () {
                    executeScript(tab.id, 'Readability-wrapper.js', function () {
                        insertCSS(tab.id, 'reader.css', function () {
                            executeScript(tab.id, 'reader.js', function () {
                                chrome.tabs.executeScript(
                                    tab.id, {
                                        code: 'startReader();'
                                    });
                            });
                        });
                    });
                });

                window.setTimeout(() => {
                    window.close()
                }, 100);
            }
        });
    }

    let btnStopRead = document.getElementById("btnStopRead");
    btnStopRead.onclick = function (element) {
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
                        code: 'stopReader();'
                    });
            }
        });
        window.setTimeout(() => {
            window.close()
        }, 100);
    };

    let btnYandexTranslate = document.getElementById("btnYandexTranslate");
    btnYandexTranslate.onclick = function (element) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {

            let tab = tabs[0];
            if (tab.url.startsWith('http') ||
                tab.url.startsWith('https') ||
                tab.url.startsWith('file') ||
                tab.url.startsWith('content')) {

                // console.log('executeScript translateYandex()');
                executeScript(tab.id, 'reader.js', function () {
                    insertCSS(tab.id, 'reader.css', function () {
                        chrome.tabs.executeScript(
                            tab.id, {
                                code: 'translateYandex();'
                            });
                    });
                });
            }
        });
        window.setTimeout(() => {
            window.close()
        }, 100);
    };

    let btnGoogleTranslate = document.getElementById("btnGoogleTranslate");
    btnGoogleTranslate.onclick = function (element) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {

            let tab = tabs[0];
            if (tab.url.startsWith('http') ||
                tab.url.startsWith('https') ||
                tab.url.startsWith('file') ||
                tab.url.startsWith('content')) {

                // console.log('executeScript translateGoogle()');
                executeScript(tab.id, 'reader.js', function () {
                    insertCSS(tab.id, 'reader.css', function () {
                        chrome.tabs.executeScript(
                            tab.id, {
                                code: 'translateGoogle();'
                            });
                    });
                });
            }
        });
        window.setTimeout(() => {
            window.close()
        }, 100);
    };

    let btnThTranslate = document.getElementById("btnThTranslate");
    btnThTranslate.onclick = function (element) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {

            let tab = tabs[0];
            if (tab.url.startsWith('http') ||
                tab.url.startsWith('https') ||
                tab.url.startsWith('file') ||
                tab.url.startsWith('content')) {

                // console.log('executeScript translateGoogle()');
                executeScript(tab.id, 'reader.js', function () {
                    insertCSS(tab.id, 'reader.css', function () {
                        chrome.tabs.executeScript(
                            tab.id, {
                                code: 'translateTh();'
                            });
                    });
                });
            }
        });
        window.setTimeout(() => {
            window.close()
        }, 100);
    };

    function executeScript(tabId, file, func) {
        chrome.tabs.executeScript(
            tabId, {
                file: file
            }, func);
    }

    function insertCSS(tabId, file, func) {
        chrome.tabs.removeCSS(tabId, {
            file: file
        }, function () {
            chrome.tabs.insertCSS(
                tabId, {
                    file: file
                }, func);
        });
    }
}
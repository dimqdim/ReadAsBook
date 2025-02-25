// (c) @Mikhalych

function saveHtmlData(doc) {
    if (doc == null) return null;
    let rc = new Object();
    rc.htmlAttr = str_attr(doc.querySelector('html'));
    rc.headAttr = str_attr(doc.head);
    rc.headHtml = (' ' + doc.head.innerHTML).slice(1);
    rc.bodyAttr = str_attr(doc.body);
    rc.bodyHtml = (' ' + doc.body.innerHTML).slice(1);
    return rc;
}

function str_attr(el) {
    if (el == null) return null;
    let attr = get_attributes(el);
    if (attr == null) return null;
    return JSON.stringify(attr);
}

function restoreHtmlData(doc, obj) {
    doc.head.innerHTML = '';
    doc.body.innerHTML = '';
    restoreAttributes(doc.querySelector('html'), obj.htmlAttr);
    if (obj.headHtml != null && obj.headHtml != 'undefined')
        doc.head.innerHTML = obj.headHtml;
    window.setTimeout(function () {
        restoreAttributes(doc.head, obj.headAttr);
        if (obj.bodyHtml != null && obj.bodyHtml != 'undefined')
            doc.body.innerHTML = obj.bodyHtml;
        restoreAttributes(doc.body, obj.bodyAttr);
    }, 100);
}

function restoreAttributes(el, attr) {
    remove_attributes(el);
    if (attr != 'undefined' && attr != null && attr != '')
        set_attributes(el, JSON.parse(attr));
}


function set_attributes(el, atts) {
    if (el == null || el.attributes == null) return;
    for (let i = 0; i < el.attributes.length; i++) {
        att = el.attributes[i];
        el.setAttribute(att.name, att.value);
        // console.log(att.name, att.value);
    }
}

function get_attributes(el) {
    if (el == null || el.attributes == null) return null;
    var res = [];
    for (let i = 0; i < el.attributes.length; i++) {
        att = el.attributes[i];
        let a = new Object();
        a.name = att.nodeName;
        a.value = att.nodeValue;
        res.push(a)
    }
    return res;
}

function remove_attributes(el) {
    if (el == null || el.attributes == null) return;
    for (let i = el.attributes.length - 1; i >= 0; i--) {
        att = el.attributes[i];
        el.removeAttribute(att.nodeName);
    }
}

function hyphenateText(text) {
    let all = "[абвгдеёжзийклмнопрстуфхцчшщъыьэюя]",
        glas = "[аеёиоуыэю\я]",
        sogl = "[бвгджзклмнпрстфхцчшщ]",
        zn = "[йъь]",
        shy = "\xAD",
        re = [];

    re[1] = new RegExp("(" + zn + ")(" + all + all + ")", "ig");
    re[2] = new RegExp("(" + glas + ")(" + glas + all + ")", "ig");
    re[3] = new RegExp("(" + glas + sogl + ")(" + sogl + glas + ")", "ig");
    re[4] = new RegExp("(" + sogl + glas + ")(" + sogl + glas + ")", "ig");
    re[5] = new RegExp("(" + glas + sogl + ")(" + sogl + sogl + glas + ")", "ig");
    re[6] = new RegExp("(" + glas + sogl + sogl + ")(" + sogl + sogl + glas + ")", "ig");

    for (let i = 1; i < 7; ++i) {
        text =
            text.replace(re[i], "$1" + shy + "$2")
                .replace(/\s»/g, '»');
    }
    return text;
}

function getParagraphs(element, caption, ecerpt) {
    let rc = [];
    // if (element == null || element.nodeName == null) return rc;

    // if (caption != null && caption.innerHTML != '')
    //     rc.push(caption);

    // if (ecerpt != null && ecerpt.innerHTML != '')
    //     rc.push(ecerpt);

    // let ps = element.querySelectorAll('p');
    // for (let i = 0; i < ps.length; i++) {
    //     if (ps[i].innerHTML != null)
    //         rc.push(ps[i]);
    // }
    addTextElements(caption, rc);
    addTextElements(ecerpt, rc);
    addTextElements(element, rc);

    return rc;
}

function getTextElements(element) {
    let rc = [];
    addTextElements(element, rc)
    return rc;
}

function addTextElements(element, arr) {
    if (element == null || element.nodeName == null) return;
    let name = element.nodeName.toLowerCase();
    if (name != 'script' &&
        name != 'meta' &&
        name != 'link' &&
        name != 'style') {

        element.childNodes.forEach(ch => {
            let nodeName = ch.nodeName.toLowerCase();
            if (nodeName == '#text') {
                if (ch.textContent != null && ch.textContent.trim() != '')
                    arr.push(ch);
            } else
                addTextElements(ch, arr)
        });
    }
}


function hyphenate(element) {
    let name = element.nodeName.toLowerCase();
    if (name != 'script' &&
        name != 'meta' &&
        name != 'link' &&
        name != 'style') {

        element.childNodes.forEach(ch => {
            let nodeName = ch.nodeName.toLowerCase();
            if (nodeName == '#text') {
                if (ch.textContent != null && ch.textContent.trim() != '')
                    ch.textContent = hyphenateText(ch.textContent);
            } else
                hyphenate(ch);
        });
    }
}

function changeQuotes(element) {
    let name = element.nodeName.toLowerCase();
    if (name != 'script' &&
        name != 'meta' &&
        name != 'link' &&
        name != 'style') {

        element.childNodes.forEach(ch => {
            let nodeName = ch.nodeName.toLowerCase();
            if (nodeName == '#text') {
                if (ch.textContent != null && ch.textContent.trim() != '')
                    ch.textContent = changeQuotesText(ch.textContent);
            } else
                changeQuotes(ch);
        });
    }
}

function changeQuotesText(text) {
    if (text == '"') {
        return text;
    }
    let ctn = text.match(/"/g);
    if (ctn != null && ctn.length == 1)
        return text.replace(/"/g, '');

    let rc = text
        .replace(/\x27/g, '\x22')
        .replace(/(\w)\x22(\w)/g, '$1\x27$2')
        .replace(/(^)\x22(\s)/g, '$1»$2')
        .replace(/(^|\s|\()"/g, "$1«")
        .replace(/"(\;|\!|\?|\:|\.|\,|$|\)|\s)/g, "»$1")
        .replace(/"(»|\;|\!|\?|\:|\.|\,|$|\)|\s)/g, "»$1")
        .replace(/(\;|\!|\?|\:|\.|\,|$|\)|\s)«(\;|\!|\?|\:|\.|\,|$|\)|\s)/g, "»$1");

    // console.log(text, rc);
    return rc;
}

function executeScript(tabId, file, func) {
    // console.log('execute script ' + file);

    chrome.scripting.executeScript(
        tabId, {
        file: file
    }, func);
}

function insertCSS(tabId, file, func) {
    chrome.tabs.removeCSS(tabId, {
        file: file
    }, function () {
        chrome.scripting.insertCSS(
            tabId, {
            file: file
        }, func);
    });
}

// console.log('common.js loaded');
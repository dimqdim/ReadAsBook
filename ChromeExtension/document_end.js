// (c) @Mikhalych

const rabStart = {

    isReadMode: false,
    rabStartBtn: null,
    top: 0,
    left: 0,
    mousePosition: [0, 0],
    offset: [0, 0],
    isDown: false,
    isMoved: false,
    threshold: 16,

    init: function () {
        this.createStartBtn();
        this.initPosition();
        this.appendListeners();
    },

    createStartBtn: function () {
        let btn = document.createElement('div');
        btn.setAttribute("id", "rabStartBtn");
        btn.setAttribute("title", "Включить режим книжного чтения");
        btn.setAttribute("class", "rab-btn");
        document.body.appendChild(btn);

        let img = document.createElement('img');
        img.setAttribute("id", "rabStartImg");
        img.src = chrome.runtime.getURL("icons/book.svg");
        // console.log('Создаем кнопку с картинкой: ', img.src);
        img.setAttribute("class", "rab-btn-img");
        btn.appendChild(img);

        this.rabStartBtn = btn;
    },

    appendListeners: function () {
        this.rabStartBtn.addEventListener('click', function (e) {
            rabStart.click(e);
        }, true);


        this.rabStartBtn.addEventListener('mousedown', function (e) {
            if (rabStart.isReadMode) return;
            rabStart.down(e);
        }, true);

        this.rabStartBtn.addEventListener('touchstart', function (e) {
            if (rabStart.isReadMode) return;
            e.preventDefault();
            if (e.touches != null && e.touches.length > 0)
                rabStart.down(e.touches[0]);
        }, {
            passive: false
        });

        document.addEventListener('mouseup', function (e) {
            if (rabStart.isReadMode || !rabStart.isDown) return;
            rabStart.up(e);
        }, true);

        document.addEventListener('mousemove', function (e) {
            if (rabStart.isReadMode || !rabStart.isDown) return;
            e.preventDefault();
            rabStart.move(e);
        }, true);

        document.addEventListener('touchmove', function (e) {
            if (rabStart.isReadMode || !rabStart.isDown) return;
            e.preventDefault();
            if (e.touches != null && e.touches.length > 0)
                rabStart.move(e.touches[0]);
        }, {
            passive: false
        });

        document.addEventListener('touchend', function (e) {
            if (rabStart.isReadMode || !rabStart.isDown) return;
            rabStart.up(e);
            if (!rabStart.isMoved) rabStart.rabStartBtn.click();
        }, {
            passive: false
        });
    },

    initPosition: function () {
        if (window.readerOptions != null &&
            window.readerOptions.rabButtonOrigin != null) {
            if (window.readerOptions.rabButtonOrigin.left >= 0 &&
                window.readerOptions.rabButtonOrigin.left <= window.innerWidth - this.rabStartBtn.offsetWidth &&
                window.readerOptions.rabButtonOrigin.top >= 0 &&
                window.readerOptions.rabButtonOrigin.top <= window.innerHeight - this.rabStartBtn.offsetHeight) {

                this.rabStartBtn.style.left = window.readerOptions.rabButtonOrigin.left + 'px';
                this.rabStartBtn.style.top = window.readerOptions.rabButtonOrigin.top + 'px';
            }
            else {
                this.rabStartBtn.style.left = '10px';
                this.rabStartBtn.style.top = window.offsetHeight - this.rabStartBtn.offsetHeight - 10 + 'px';
            }
        }
    },

    updatePosition: function () {
        if (window.readerOptions != null &&
            window.readerOptions.rabButtonOrigin != null) {

            window.readerOptions.rabButtonOrigin.left = this.rabStartBtn.offsetLeft;
            window.readerOptions.rabButtonOrigin.top = this.rabStartBtn.offsetTop;
            saveOptions();
        }
    },

    click: function (e) {
        if (this.isMoved) {
            this.isMoved = false;
        }
        else {
            docStartReader();
        }
    },
    down: function (e) {
        this.rabStartBtn.style.cursor = "move";
        this.isDown = true;
        this.isMoved = false;
        this.offset = [
            this.rabStartBtn.offsetLeft - e.clientX,
            this.rabStartBtn.offsetTop - e.clientY
        ];
    },

    up: function () {
        this.rabStartBtn.style.cursor = "pointer";
        this.rabStartBtn.style.transition = "0";
        this.isDown = false;
        this.updatePosition();
    },

    move: function (e) {
        if (this.isDown) {
            this.mousePosition = {
                x: e.clientX,
                y: e.clientY
            };
            let downX = this.rabStartBtn.offsetLeft - this.offset[0];
            let downY = this.rabStartBtn.offsetTop - this.offset[1];
            if (Math.abs(this.mousePosition.x - downX) > this.threshold ||
                Math.abs(this.mousePosition.y - downY) > this.threshold ||
                this.isMoved) {

                let newLeft = this.mousePosition.x + this.offset[0];
                if (newLeft < 0) newLeft = 0;
                if (newLeft > window.innerWidth - this.rabStartBtn.offsetWidth)
                    newLeft = window.innerWidth - this.rabStartBtn.offsetWidth;

                let newTop = this.mousePosition.y + this.offset[1];
                if (newTop < 0) newTop = 0;
                if (newTop > window.innerHeight - this.rabStartBtn.offsetHeight)
                    newTop = window.innerHeight - this.rabStartBtn.offsetHeight;

                this.rabStartBtn.style.left = newLeft + 'px';
                this.rabStartBtn.style.top = newTop + 'px';
                // this.isDown = true;
                this.isMoved = true;
            }
        }
    }
}

rabStart.init();

chrome.runtime.sendMessage({
    action: "create-menu",
    message: 'Создаем локальное меню на странице: ' + window.location
});

async function docStartReader() {

    // console.log('Сохраним (на всякий случай) оригинальную страницу');
    // window.origPage = saveHtmlData(document);

    // console.log('Запомним исходное состояние окна браузера');
    try {
        chrome.runtime.sendMessage({
            action: "get-window-state"
        }, function (result) {
            window.origWindowState = result;
            console.log('Состояние окна браузера: ', window.origWindowState);
        });
    } catch (ex) {
        alert('Необходимо обновить страницу');
        console.log(ex);
        location.reload();
        return;
    }

    let origDocClone = document.cloneNode(true);

    let rabContainer = document.querySelector('#rabContainer');
    if (rabContainer == null) {

        document.firstElementChild.removeAttribute('lang');
        document.firstElementChild.removeAttribute('class');
        document.head.innerHTML = '';
        document.body.removeAttribute('class');
        document.body.innerHTML = '';

        let readerStyles = document.querySelector('#readerStyles');
        if (readerStyles == null) {
            let css = await loadReaderCss();
            readerStyles = document.createElement('style');
            readerStyles.setAttribute('id', 'readerStyles')
            readerStyles.innerHTML = css.replace(/&#92;/ig, "\\\\");
            document.head.appendChild(readerStyles);
        }

        rabContainer = document.createElement('div');
        rabContainer.setAttribute("id", "rabContainer");
        // console.log("Пытаемся загрузить макет нашей читалки");
        let resp = await fetch(chrome.runtime.getURL("reader/reader.html"));
        if (resp.ok) {

            // console.log("Успешно загрузили макет нашей читалки");

            let buffer = await resp.arrayBuffer();
            let charset = 'utf-8';
            let contentType = resp.headers.get("Content-Type");
            if (contentType != null) {
                let vRegExp = new RegExp(/charset=([^()>@,;:\"\/[\]?.=\s]*)/g);
                let chs = contentType.match(vRegExp);
                if (chs != null && chs.length > 0 && chs[0].length > 'charset='.length)
                    charset = chs[0].slice('charset='.length);
            }
            let decoder = new TextDecoder(charset);
            let text = decoder.decode(buffer);
            let parser = new DOMParser();
            let readerDocument = parser.parseFromString(text, 'text/html');
            rabContainer.innerHTML = readerDocument.body.innerHTML;
            document.body.appendChild(rabContainer);
            await doOnStartRead(rabContainer, origDocClone);
        }
    } else
        await doOnStartRead(rabContainer, origDocClone);

    // console.log('Читалка готова к чтению');
}

async function doOnStartRead(rabContainer, origDocClone) {

    // console.log('Скроем исходное содержимое, оставив только наш контейнер');
    document.body.childNodes
    for (let i = 0; i < document.body.childNodes.length; i++) {
        if (document.body.childNodes[i].id != rabContainer.id) {
            document.body.childNodes[i].style.display = "none";
        }
    }
    // console.log('Инициализируем параметры читалки', rabContainer);
    loadOptions();

    // console.log('Отображаем содержимое в читалке');
    readOrigPage(origDocClone);
}

async function loadReaderCss() {
    let css = '';

    let resp = await fetch(chrome.runtime.getURL('icofont.css'));
    if (resp.ok) {
        let txt = await resp.text();
        css += txt.replace(/.\/fonts/ig, chrome.runtime.getURL('./fonts'));
    }

    resp = await fetch(chrome.runtime.getURL('font.css'));
    if (resp.ok) {
        let txt = await resp.text();
        css += "\n";
        css += txt
            .replace(/.\/icons/ig, chrome.runtime.getURL('./icons'))
            .replace(/.\/fonts/ig, chrome.runtime.getURL('./fonts'));
    }

    resp = await fetch(chrome.runtime.getURL('reader/reader.css'));
    if (resp.ok) {
        let txt = await resp.text();
        css += "\n" + txt;
    }
    return css
}

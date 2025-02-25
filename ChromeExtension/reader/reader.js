// (c) @Mikhalych
"use strict";

// console.log('reader.js: Start.');
let allPagesLoaded = false;
let needClose = false;
let useSpecificArticle = true;
let pageLang = "en";
let nodes4translate;
let translatedIndex;
let tranlatedNodesCount;
let cafTranslateToken = null;
let cafLoadPageToken = null;

let textArea = document.querySelector(".text-col");
let pageNumber;
let totalPages;
let totalWidth;
let columnGap;
let columnWidth;
let pageHeight;
let pageWidth;

window.addEventListener("unload", function () {
  console.log('Исходная страница "' + window.location + '" выгружена.');
  needClose = true;
  try {
    chrome.runtime.sendMessage({
      action: "stop-translate",
    });
  } catch (ex) {
    console.log(ex);
  }
});

const readerOptionsDefault = {
  use: true, // использовать книжный читатель на этом сайте
  theme: "sepia", // тема (day, night, sepia)
  fullscreen: false,
  loadNext: true,
  maxLoad: 25,
  layout: "page", // отображение (page, book, paper)
  fontFamily: "sans-serif",
  fontSize: 100,
  textAlign: "justify",
  hyphenate: false, // переносы по слогам
  textMargin: {
    // отступы текста от краев экрана
    top: 40,
    right: 40,
    bottom: 40,
    left: 40,
  },
  // Позиция кнопки читателя на оргинальной странице
  rabButtonOrigin: {
    left: -10,
    top: -10,
  },
  textIndent: 2, // отступ первой строки
  lineHeight: 1.4, // высота строки (межстрочный интервал)
  useTranslate: false, // переводить текст статьи
  translate: {
    provider: "Google",
    from: "auto",
    to: "ru",
    showOriginal: false,
  },
  useXPathArticle: false, // использовать специфические селекторы для разбора
  xPathArticle: {
    title: "",
    excerpt: "",
    content: ""
  }
};

let readerOptions = localStorage.getItem("rab-options");
// console.log('reader.js: Read Options', readerOptions);
if (readerOptions == null) {
  readerOptions = readerOptionsDefault;
  saveOptions();
} else {
  readerOptions = JSON.parse(readerOptions);
}
window.readerOptions = readerOptions;

function readOrigPage(doc) {
  // Поиск адреса следующей страницы веб-страницы <doc>
  let nextPageUrl = getNextPageUrl(doc);

  let article = getArticle(doc, nextPageUrl);

  if (article.title != null) rabTitle.innerHTML = article.title;
  else rabTitle.innerHTML = "";
  document.title = 'Читаем: "' + article.title + '"';

  if (article.excerpt != null) rabExcerpt.innerHTML = article.excerpt;
  else rabExcerpt.innerHTML = "";

  if (article.content != null)
    rabContent.innerHTML = article.content.replace(
      'class="page"',
      'class="readability-page"'
    );
  else rabContent.innerHTML = "";

  //changeQuotes(rabContent);
  if (article.lang != null && article.lang != "") pageLang = article.lang;
  else {
    let lang = doc.documentElement.lang?.toLocaleLowerCase();
    if (lang != null && lang != "") pageLang = lang;
  }
  console.log("reader.js: Язык исходной страницы - " + pageLang + ".");
  if (
    readerOptions.hyphenate &&
    (pageLang == "ru" || pageLang == "ru-ru" || pageLang == "")
  ) {
    hyphenate(rabContent);
  }

  cleanContent(rabContent);

  if (nextPageUrl) {
    loadNextPage(nextPageUrl, 0);
  } else {
    endLoadPages(1, false);
  }
}

function getArticle(doc, nextPageUrl) {
  let article = null;
  if (useSpecificArticle) {
    let articleElement = doc.body.querySelector("article");
    if (articleElement != null) {
      let entry = articleElement.querySelector("div.entry");
      if (entry != null) {
        article = new Object();
        article.content = "<div>";
        let aside = articleElement.querySelector("aside.meta");
        if (aside != null)
          article.content +=
            '<div class="categories">' + aside.outerHTML + "</div>";

        let vbv = entry.querySelector("span.vbv");
        if (vbv != null) vbv.remove();

        article.content += entry.outerHTML;
        article.content += "</div>";

        let innerTitle = doc.body.querySelector('span[itemprop="headline"]');
        if (innerTitle != null) {
          article.title = innerTitle.innerHTML;
        } else article.title = parseTitle(doc.title);
      }
    }
    if (article == null) {
      articleElement = doc.body.querySelector("#pastmaintext");
      if (articleElement != null) {
        article = new Object();
        let title = doc.body.querySelector("#main_post_title");
        if (title != null) article.title = title;
        else article.title = parseTitle(doc.title);

        article.excerpt =
          '<div><div class="title">' + article.title + "</div><hr/>";
        let add = articleElement.parentNode.querySelectorAll("p.post_add");
        if (add != null && add.length > 0) {
          article.content += '<div class="categories">';
          for (let i = 0; i < add.length; i++) {
            let imgs = add[i].querySelectorAll("img");
            if (imgs != null && imgs.length > 0)
              for (let j = imgs.length - 1; j >= 0; j--) imgs[j].remove();

            article.excerpt += "<p>" + add[i].innerHTML + "</p>";
          }
          article.excerpt += "<hr/><br/></div>";
        }
        let pv = articleElement.querySelector("p.post_view2");
        if (pv != null) pv.remove();

        if (!nextPageUrl) {
          let pt = articleElement.querySelector("p.post_tag");
          if (pt != null) pt.remove();
        }

        article.excerpt += "</div>";
        article.content = articleElement.innerHTML;
      } else {
        articleElement = doc.body.querySelector(".aa_ht");
        if (articleElement != null) {
          let ht = doc.body.querySelector(".headline");
          let excerpt = doc.body.querySelector("#tabpanel-info .bn_B");
          article = {
            title: ht == null ? parseTitle(doc.title) : ht.innerText,
            content: articleElement.innerHTML,
            excerpt: excerpt == null ? '' : excerpt.innerText
          };
        }
      }
    }
  }
  if (article == null) {
    article = new Readability(doc).parse();
    article.title = parseTitle(article.title);
  }

  return article;
}

function cleanContent(rabContent) {
  try {
    let el = rabContent.querySelector("#styleSwitch");
    if (el != null) el.style.display = "none";

    el = rabContent.querySelector("#fontsizediv");
    if (el != null && el.parentNode != null && el.parentNode.parentNode != null)
      el.parentNode.parentNode.style.display = "none";

    el = rabContent.querySelector("#starratingdiv");
    if (
      el != null &&
      el.parentNode != null &&
      el.parentNode.parentNode != null &&
      el.parentNode.parentNode.parentNode != null
    ) {
      el.parentNode.parentNode.parentNode.style.display = "none";
      if (
        el.parentNode.parentNode.parentNode.nextElementSibling != null &&
        el.parentNode.parentNode.parentNode.nextElementSibling.style != null
      )
        el.parentNode.parentNode.parentNode.nextElementSibling.style.display =
          "none";
    }

    el = rabContent.querySelector('div[itemprop="articleBody"]');
    if (
      el != null &&
      el.nextElementSibling != null &&
      el.nextElementSibling.style != null
    ) {
      el.nextElementSibling.style.display = "none";
    }
  } catch (e) {
    console.log('Не удалось "подчистить" контент.', e);
  }
}

function parseTitle(title) {
  let rc = title;
  let last = title.lastIndexOf(" — ");
  if (last >= 0) {
    rc = title.slice(0, last);
  } else {
    last = title.lastIndexOf(" - ");
    if (last >= 0) {
      rc = title.slice(0, last);
    }
  }
  if (
    window.location.hostname
      .toLocaleLowerCase()
      .indexOf(rc.toLocaleLowerCase()) > 0
  ) {
    rc = title.slice(last + 3);
  }
  return rc;
}

function getNextPageUrl(doc) {
  let selector = 'a[href*="' + window.location.pathname + '"]';
  let hrefs = doc.querySelectorAll(selector);

  let nextPages = findNext(hrefs);
  if (nextPages.length == 0) {
    hrefs = doc.querySelectorAll('a:not([href=""])');
    nextPages = findNext(hrefs);
  }

  if (nextPages.length == 0) return null; // Не нашли ни одной ссылки на следующую страницу

  return nextPages[0].href;
}

function findNext(hrefs) {
  let nextPages = [];
  for (let i = 0; i < hrefs.length; i++) {
    let hasNext = false;
    if (hasNextStr(hrefs[i].getAttribute("title"))) {
      hasNext = true;
    } else if (hasNextStr(hrefs[i].innerText)) {
      hasNext = true;
    }

    if (hasNext) {
      // console.log(hrefs[i]);
      nextPages.push(hrefs[i]);
    }
  }
  return nextPages;
}

function hasNextStr(text) {
  if (text == null) return false;
  let txt = text.toLowerCase();
  if (
    txt == "next" ||
    txt == "next page" ||
    txt.indexOf("следующая часть") >= 0 ||
    txt.indexOf("следующая страница") >= 0 ||
    txt.indexOf("►") >= 0
  )
    return true;
  return false;
}

async function loadNextPage(url, level) {
  if (needClose) return;
  let pageNum = level + 2;
  if (pageNum > readerOptions.maxLoad) {
    endLoadPages(level + 1, true);
    return;
  }
  try {
    showStatus("Загружаем следующую страницу (" + pageNum + ")...");

    let resp = await fetch(url);
    if (resp.ok) {
      let buffer = await resp.arrayBuffer();
      let charset = "utf-8";
      let contentType = resp.headers.get("Content-Type");
      if (contentType != null) {
        let vRegExp = new RegExp(/charset=([^()>@,;:\"\/[\]?.=\s]*)/g);
        let chs = contentType.match(vRegExp);
        if (chs != null && chs.length > 0 && chs[0].length > "charset=".length)
          charset = chs[0].slice("charset=".length);
      }
      let decoder = new TextDecoder(charset);
      let text = decoder.decode(buffer);
      let parser = new DOMParser();
      let nextDocument = parser.parseFromString(text, "text/html");

      let nextPageUrl = getNextPageUrl(nextDocument);

      let article = getArticle(nextDocument, nextPageUrl);
      let nextPage = document.createElement("div");
      let readabilityPage = article.content.replace(
        '<div id="readability-page-1',
        '<div id="readability-page-' + String(level + 2).replace(/^0+/, "")
      );
      readabilityPage = readabilityPage.replace(
        'class="page"',
        'class="readability-page"'
      );
      nextPage.innerHTML = readabilityPage;
      nextPage.removeAttribute("class");
      cleanContent(nextPage);
      //changeQuotes(nextPage);

      let rabContent = document.querySelector("#rabContent");
      rabContent.innerHTML +=
        '<hr><p class="page-number">' + pageNum + "</p>" + nextPage.innerHTML;

      if (nextPageUrl) {
        loadNextPage(nextPageUrl, level + 1);
      } else {
        endLoadPages(level + 2, false);
      }
    } else {
      console.log("Ошибка парсинга HTTP: " + resp.status + ". href=" + url);
    }
  } catch (ex) {
    console.log(ex);
  }
}

function endLoadPages(count, isBreak) {
  showStatus(
    "Всего загружено страниц: " + count + (isBreak ? " [максимум]" : ""),
    1000
  );
  allPagesLoaded = true;
  if (readerOptions.useTranslate) translateProvider();
}

function loadOptions() {
  window.onresize = function () {
    updateLayout();
    nextPrevPage(-1);
  };

  // const wrapper = document.querySelector(".wrapper");
  // wrapper.classList.add(readerOptions.theme);
  // wrapper.classList.remove("transparent");

  let miSetup = document.querySelector("#miSetup");
  miSetup.onclick = function () {
    return miSetupClick();
  };

  let miFullScreen = document.querySelector("#miFullScreen");
  miFullScreen.onclick = function () {
    toggleMenu();

    const chk = document.querySelector("#chkFullScreen");
    //chk.checked = !chk.checked;
    chk.click();

    return false;
  };

  let miClose = document.querySelector("#miClose");
  miClose.onclick = function () {
    return miCloseClick();
  };

  let closeIcon = document.querySelector(".closeIcon");
  closeIcon.onclick = function () {
    return miCloseClick();
  };

  const defaultOptions = document.querySelector("#defaultOptions");
  defaultOptions.onclick = function () {
    readerOptions = readerOptionsDefault;
    saveOptions();
    loadOptions();
  };

  const chkFullScreen = document.querySelector("#chkFullScreen");
  chkFullScreen.onclick = function () {
    readerOptions.fullscreen = chkFullScreen.checked;
    saveOptions();
    setFullScreen();
  };

  const chkLoadNext = document.querySelector("#chkLoadNext");
  const maxLoad = document.querySelector("#maxLoad");
  maxLoad.value = readerOptions.maxLoad;
  chkLoadNext.onclick = function () {
    readerOptions.loadNext = chkLoadNext.checked;
    saveOptions();
    setLoadNext();
  };
  maxLoad.onchange = function () {
    readerOptions.maxLoad = maxLoad.value;
    saveOptions();
    setLoadNext();
  };

  const miSave = document.querySelector("#miSave");
  miSave.onclick = function () {
    // savePageHtml();
    savePageFb2();
  };

  const miPrint = document.querySelector("#miPrint");
  miPrint.onclick = function () {
    const htmlString = document.querySelector("#rabContent").innerHTML;
    const newIframe = document.createElement("iframe");
    newIframe.width = "1px";
    newIframe.height = "1px";
    newIframe.src = "about:blank";

    newIframe.onload = function () {
      newIframe.contentWindow.document.body.innerHTML = htmlString;
      const originals = document.querySelectorAll(".translated-original");
      for (let i = 0; i < originals.length; i++) {
        originals[i].innerHTML = "";
      }

      setTimeout(function () {
        newIframe.contentWindow.focus();
        newIframe.contentWindow.print();
        // newIframe.contentWindow.document.body.removeChild(script_tag);
        newIframe.parentElement.removeChild(newIframe);
      }, 300);
    };
    document.body.appendChild(newIframe);
  };

  const chkLineIndent = document.querySelector("#chkLineIndent");
  chkLineIndent.checked = readerOptions.textIndent != 0;
  updateLineIndentButtons();
  chkLineIndent.onclick = function () {
    updateLineIndentButtons();
    readerOptions.textIndent = chkLineIndent.checked ? 1 : 0;
    saveOptions();
    setTextIndent();
  };

  function updateLineIndentButtons() {
    const lineIndentButtons = document.querySelector("#lineIndentButtons");
    if (chkLineIndent.checked) lineIndentButtons.classList.remove("hidden");
    else lineIndentButtons.classList.add("hidden");
  }

  const indentButtons = document.querySelectorAll(".line-indent-button");
  for (let i = 0; i < indentButtons.length; i++) {
    indentButtons[i].onclick = (e) => {
      let btn =
        e.target.nodeName.toLowerCase() == "i" ? e.target.parentNode : e.target;
      let data = btn.getAttribute("data");

      if (data == "+") {
        updateLineIndent(+0.5);
      } else if (data == "-") {
        updateLineIndent(-0.5);
      }
    };
  }

  function updateLineIndent(d) {
    readerOptions.textIndent += d;
    saveOptions();
    setTextIndent();
  }

  const chkTranslate = document.querySelector("#chkTranslate");
  chkTranslate.onclick = function () {
    readerOptions.useTranslate = chkTranslate.checked;
    setTranslate();
    saveOptions();
  };

  const selProvider = document.querySelector("#selProvider");
  selProvider.onchange = function () {
    readerOptions.translate.provider = selProvider.value;
    saveOptions();
    clearTranslated();
    setTranslate();
  };

  const selLangFrom = document.querySelector("#selLangFrom");
  selLangFrom.onchange = function () {
    readerOptions.translate.from = selLangFrom.value;
    saveOptions();
    clearTranslated();
    setLanguages();
  };

  const selLangTo = document.querySelector("#selLangTo");
  selLangTo.onchange = function () {
    readerOptions.translate.to = selLangTo.value;
    saveOptions();
    clearTranslated();
    setLanguages();
  };

  window.addEventListener("focus", function (event) {
    console.log("reader.js: Focus window", event);
    try {
      chrome.runtime.sendMessage(
        {
          action: "get-window-state",
        },
        function (result) {
          if (readerOptions.fullscreen && !result) {
            showStatus("Переходим в полноэкранный режим", 300);
            setFullScreen();
          }
        }
      );
    } catch (ex) {
      alert("Необходимо обновить страницу");
      console.log(ex);
    }
  });

  let xDown = null;
  let yDown = null;
  let xMove = null;
  let yMove = null;
  const textCont = document.querySelector(".text-container");
  const clickPane = document.querySelector(".click-pane");

  clickPane.addEventListener(
    "touchstart",
    function (evt) {
      const firstTouch = evt.touches[0];
      xDown = firstTouch.clientX;
      yDown = firstTouch.clientY;
    },
    false
  );

  clickPane.addEventListener(
    "touchend",
    function (evt) {
      endTouch();
    },
    false
  );

  clickPane.addEventListener(
    "touchcancel",
    function (evt) {
      endTouch();
    },
    false
  );

  clickPane.addEventListener(
    "touchmove",
    function (evt) {
      if (xDown == null || yDown == null) return;

      const x = evt.touches[0].clientX;
      const y = evt.touches[0].clientY;

      const xDiff = (xMove == null ? xDown : xMove) - x;
      const yDiff = (yMove == null ? yDown : yMove) - y;

      const xA = Math.abs(xDiff);
      const yA = Math.abs(yDiff);

      if (readerOptions.layout == "paper") {
        if (yA < 10) return;
        let newScrollTop = textCont.scrollTop + yDiff;
        if (newScrollTop < 0) newScrollTop = 0;
        textCont.scrollTop = newScrollTop;
      } else {
        if (xA < 10) return;
        let newScrollLeft = textCont.scrollLeft + xDiff;
        if (newScrollLeft < 0) newScrollLeft = 0;
        textCont.scrollLeft = newScrollLeft;
      }

      xMove = x;
      yMove = y;
    },
    false
  );

  function endTouch() {
    if (xMove == null || yMove == null) return;

    if (readerOptions.layout != "paper") nextPrevPage(xDown > xMove ? 1 : -1);
    // else
    //     nextPrevPage(yDown > yMove ? 1 : -1);

    xDown = null;
    yDown = null;
    xMove = null;
    yMove = null;
  }

  const clickCells = document.querySelectorAll(".click-pane td");
  for (let i = 0; i < clickCells.length; i++) {
    clickCells[i].onclick = (e) => {
      if (xMove != null || yMove != null) return;
      let data = e.target.getAttribute("data");
      const chk = document.querySelector("#chk");
      if (data != "opt") setupPane.classList.remove("menu-pane-active");
      if (chk.checked) {
        chk.checked = false;
      } else {
        switch (data) {
          case "next":
            updateLayout();
            nextPrevPage(+1);
            break;

          case "prev":
            updateLayout();
            nextPrevPage(-1);
            break;

          case "opt":
            setupPane.classList.toggle("menu-pane-active");
            break;
        }
      }
    };
    clickCells[i].onwheel = (e) => {
      nextPrevPage(e.deltaY > 0 ? 1 : -1);
    };
  }

  const textArea = document.querySelector(".text-col");
  const textStyle = window.getComputedStyle(textArea);
  let shiftLastPage;
  textArea.onscroll = (e) => {
    // console.log(textArea.scrollLeft, textArea.scrollWidth, textArea.scrollWidth - textArea.scrollLeft);
    const progress = document.querySelector(".progress");
    if (readerOptions.layout != "paper") {
      if (
        parseInt(textArea.scrollWidth - textArea.scrollLeft) <=
        window.innerWidth
      ) {
        progress.style.width = "100%";
      } else {
        progress.style.width =
          (e.target.scrollLeft * 100) / e.target.scrollWidth + "%";
      }
    } else if (
      textCont.scrollHeight - textCont.scrollTop <=
      textCont.clientHeight
    )
      progress.style.width = "100%";
    else
      progress.style.width =
        (e.target.scrollTop * 100) / e.target.scrollHeight + "%";
  };

  const themeBtns = document.querySelectorAll(".button-theme");
  for (let i = 0; i < themeBtns.length; i++) {
    themeBtns[i].classList.remove("button-active");
    if (themeBtns[i].getAttribute("data") == readerOptions.theme)
      themeBtns[i].classList.add("button-active");
    themeBtns[i].onclick = (e) => {
      for (let j = 0; j < themeBtns.length; j++) {
        themeBtns[j].classList.remove("button-active");
      }
      let btn =
        e.target.nodeName.toLowerCase() == "font"
          ? e.target.parentNode.parentNode
          : e.target;
      btn.classList.add("button-active");
      readerOptions.theme = btn.getAttribute("data");
      saveOptions();
      setTheme();
    };
  }

  const layoutBtns = document.querySelectorAll(".layout-button");
  for (let i = 0; i < layoutBtns.length; i++) {
    layoutBtns[i].classList.remove("button-active");
    if (layoutBtns[i].getAttribute("data") == readerOptions.layout)
      layoutBtns[i].classList.add("button-active");
    layoutBtns[i].onclick = (e) => {
      for (let j = 0; j < layoutBtns.length; j++) {
        layoutBtns[j].classList.remove("button-active");
      }
      let btn =
        e.target.nodeName.toLowerCase() == "i" ? e.target.parentNode : e.target;
      btn.classList.add("button-active");
      readerOptions.layout = btn.getAttribute("data");
      saveOptions();
      setLayout();
    };
  }

  const fontFamilySelect = document.querySelector("#fontFamilySelect");
  fontFamilySelect.value = readerOptions.fontFamily;
  fontFamilySelect.onchange = (e) => {
    readerOptions.fontFamily = e.target.value;
    setFontFamily();
    saveOptions();
  };

  const fontSizeBtns = document.querySelectorAll(".button-font");
  for (let i = 0; i < fontSizeBtns.length; i++) {
    fontSizeBtns[i].onclick = (e) => {
      let btn =
        e.target.nodeName.toLowerCase() == "font"
          ? e.target.parentNode.parentNode
          : e.target;
      let data = btn.getAttribute("data");
      if (data == "100") readerOptions.fontSize = 100;
      else if (data == "+") readerOptions.fontSize += 5;
      else if (data == "-") readerOptions.fontSize -= 5;

      saveOptions();
      setFontSize();
    };
  }

  const lineHeightBtns = document.querySelectorAll(".line-height-button");
  for (let i = 0; i < lineHeightBtns.length; i++) {
    lineHeightBtns[i].onclick = (e) => {
      let btn =
        e.target.nodeName.toLowerCase() == "i" ? e.target.parentNode : e.target;
      let data = btn.getAttribute("data");
      if (data == "+") readerOptions.lineHeight += 0.1;
      else if (data == "-") readerOptions.lineHeight -= 0.1;

      saveOptions();
      setLineHeight();
    };
  }

  const textLayoutBtns = document.querySelectorAll(".text-layout-button");
  for (let i = 0; i < textLayoutBtns.length; i++) {
    textLayoutBtns[i].classList.remove("button-active");
    if (textLayoutBtns[i].getAttribute("data") == readerOptions.textAlign)
      textLayoutBtns[i].classList.add("button-active");
    textLayoutBtns[i].onclick = (e) => {
      for (let j = 0; j < textLayoutBtns.length; j++) {
        textLayoutBtns[j].classList.remove("button-active");
      }
      let btn =
        e.target.nodeName.toLowerCase() == "i" ? e.target.parentNode : e.target;
      btn.classList.add("button-active");
      readerOptions.textAlign = btn.getAttribute("data");
      saveOptions();
      setTextAlign();
    };
  }

  const textMarginBtns = document.querySelectorAll(".text-margin-button");
  setTextMargin(readerOptions.textMargin);
  for (let i = 0; i < textMarginBtns.length; i++) {
    textMarginBtns[i].onclick = (e) => {
      let btn =
        e.target.nodeName.toLowerCase() == "i" ? e.target.parentNode : e.target;
      switch (btn.getAttribute("data")) {
        case "+vert":
          readerOptions.textMargin.top -= 5;
          readerOptions.textMargin.bottom -= 5;
          break;
        case "-vert":
          readerOptions.textMargin.top += 5;
          readerOptions.textMargin.bottom += 5;
          break;
        case "+horz":
          readerOptions.textMargin.left -= 5;
          readerOptions.textMargin.right -= 5;
          break;
        case "-horz":
          readerOptions.textMargin.left += 5;
          readerOptions.textMargin.right += 5;
          break;
        case "up":
          readerOptions.textMargin.top -= 5;
          readerOptions.textMargin.bottom += 5;
          break;
        case "down":
          readerOptions.textMargin.top += 5;
          readerOptions.textMargin.bottom -= 5;
          break;
        case "left":
          readerOptions.textMargin.left -= 5;
          readerOptions.textMargin.right += 5;
          break;
        case "right":
          readerOptions.textMargin.left += 5;
          readerOptions.textMargin.right -= 5;
          break;
      }
      readerOptions.textMargin.left = correct(
        readerOptions.textMargin.left,
        window.innerWidth * 0.3
      );
      readerOptions.textMargin.right = correct(
        readerOptions.textMargin.right,
        window.innerWidth * 0.3
      );
      readerOptions.textMargin.top = correct(
        readerOptions.textMargin.top,
        window.innerHeight * 0.3
      );
      readerOptions.textMargin.bottom = correct(
        readerOptions.textMargin.bottom,
        window.innerHeight * 0.3
      );
      saveOptions();
      setTextMargin(readerOptions.textMargin);
    };
  }

  function correct(val, max) {
    if (val < 0) return 0;
    if (val > max) return max;
    return val;
  }

  const chkHyphenate = document.querySelector("#chkHyphenate");
  chkHyphenate.checked = readerOptions.hyphenate == true;
  chkHyphenate.onclick = (e) => {
    readerOptions.hyphenate = e.target.checked;
    saveOptions();
    setTextHyphenate();
  };

  const footer = document.querySelector("footer");
  footer.onclick = function () {};

  const miTranslate = document.querySelector("#miTranslate");
  miTranslate.onclick = function () {
    const chk = document.querySelector("#chkTranslate");
    //chk.checked = !chk.checked;
    chk.click();
  };

  const chkOriginal = document.querySelector("#chkOriginal");
  chkOriginal.onclick = function () {
    readerOptions.translate.showOriginal = chkOriginal.checked;
    setShowOriginal();
    saveOptions();
  };

  setTheme();
  setFullScreen();
  setLoadNext();
  setFontFamily();
  setFontSize();
  setTextAlign();
  setTextIndent();
  setTextHyphenate();
  setLineHeight();
  setLayout();
  updateLayout();
  setTranslate();
  translatedIndex = 0;
}

function setFullScreen() {
  const chkFullScreen = document.querySelector("#chkFullScreen");
  chkFullScreen.checked = readerOptions.fullscreen;
  changeFullScreen(readerOptions.fullscreen);

  try {
    if (document.body.webkitRequestFullScreen) {
      if (readerOptions.fullscreen == true)
        document.body.webkitRequestFullScreen();
      else document.webkitCancelFullScreen();
    } else {
      chrome.runtime.sendMessage({
        action: "set-fullscreen",
        value: readerOptions.fullscreen,
        origWindowState: window.origWindowState,
      });
    }
  } catch (ex) {
    console.log("reader.js setFuulScreen Exception ", ex.message);
  }
}

function setTranslate() {
  const chkTranslate = document.querySelector("#chkTranslate");
  chkTranslate.checked = readerOptions.useTranslate;

  const divTranslate = document.querySelector("#divTranslate");
  if (readerOptions.useTranslate) {
    divTranslate.classList.remove("hidden");

    const chkOriginal = document.querySelector("#chkOriginal");
    chkOriginal.checked = readerOptions.translate.showOriginal;

    const selProvider = document.querySelector("#selProvider");
    selProvider.value = readerOptions.translate.provider;

    translateProvider();
  } else {
    clearTranslated();
    divTranslate.classList.add("hidden");
  }
}

function setLanguages() {
  selLangFrom.value = readerOptions.translate.from;
  selLangTo.value = readerOptions.translate.to;

  if (readerOptions.useTranslate) {
    translateProvider();
  }
}

function setShowOriginal() {
  var divs = document.querySelectorAll(".translated-original");
  for (var i = 0; i < divs.length; i++) {
    if (readerOptions.translate.showOriginal)
      divs[i].classList.remove("hidden");
    else divs[i].classList.add("hidden");
  }
}

function clearTranslated() {
  if (cafTranslateToken != null) {
    console.log("Останавливаем текущий перевод.", cafTranslateToken);
    cafTranslateToken.abort("Останавили текущий перевод");
  }

  var divs = document.querySelectorAll(".translated-original");
  for (var i = 0; i < divs.length; i++) {
    if (divs[i] && divs[i].parentNode != null)
      divs[i].parentNode.innerHTML = divs[i].innerHTML;
  }
  translatedIndex = 0;
  cafTranslateToken = null;
}

function translateProvider() {
  if (!allPagesLoaded) return;

  console.log("Начинаем перевод. Сервис:", readerOptions.translate.provider);
  cafTranslateToken = new cancelToken();

  nodes4translate = getParagraphs(
    document.querySelector("#rabContent"),
    document.querySelector("#rabTitle"),
    document.querySelector("#rabExcerpt")
  );

  translateText(cafTranslateToken.signal, readerOptions.translate.provider);
}

async function translateText(signal, provider) {
  // console.log("translateText", signal, provider);
  if (signal.aborted) return;

  signal.pr.catch((reason) => {
    console.log(reason);
    showStatus(reason, 750);
  });

  tranlatedNodesCount = 0;
  for (let i = 0; i < nodes4translate.length; i++) {
    translateNode(
      signal,
      provider,
      i,
      nodes4translate[i].textContent,
      readerOptions.translate.from,
      readerOptions.translate.to,
      function (index, orig, tranlated, error) {
        let result;
        if (error != null && error != "") {
          result = "[error: " + error + "] " + orig;
          console.log(index, orig, tranlated, error);
        } else {
          if (tranlated == null) {
            console.log(
              "reader.js. Не удалось первести абзац № " + (index + 1)
            );
            return;
          }
          if (orig[0] == " " && tranlated[0] != " ")
            result = ' ' + changeQuotesText(tranlated);
          else if (
            orig.length > 1 &&
            tranlated.length > 1 &&
            orig[orig.length - 1] == " " &&
            tranlated[tranlated.length - 1] != " "
          )
            result = changeQuotesText(tranlated) + ' ';
          else result = changeQuotesText(tranlated);

          if (index > 0) {
            result = readerOptions.hyphenate ? hyphenateText(result) : result;
          }
        }

        nodes4translate[i].textContent = result;
        // nodes4translate[index].innerHTML =
        //   "<p class='translated-original" +
        //   (readerOptions.translate.showOriginal ? "" : " hidden") +
        //   "'>" +
        //   orig +
        //   "</p>" +
        //   "<p class='translated'>" +
        //   result +
        //   "</p>";

        if (error != null && error != "") {
          finishTranslate();
          return;
        }
        tranlatedNodesCount++;
        // console.log(tranlatedNodesCount, nodes4translate.length, orig, tranlated);
        if (tranlatedNodesCount < nodes4translate.length)
          showStatus(
            "Переводим  " +
              (index + 1) +
              "-й абзац из " +
              nodes4translate.length +
              " с помощью " +
              provider +
              " (" +
              Math.round(
                (tranlatedNodesCount * 100.0) / nodes4translate.length
              ) +
              "%)"
          );
        else {
          finishTranslate();
          return;
        }
      }
    );
    if (signal.aborted) return;
    await sleep(10);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateNode(
  signal,
  provider,
  index,
  orig,
  langFrom,
  langTo,
  result
) {
  if (signal.aborted) return;

  let token = new cancelToken();

  // wrap a generator to make it look like a normal async
  // function that when called, returns a promise.
  let main = CAF(function* main(signal, url, options) {
    let resp = yield fetch(url, options);
    // want to be able to cancel so we never get here?!?
    // console.log('fetch response', url, [options], resp, signal);
    return resp;
  });

  let url = null;
  let options = null;
  switch (provider) {
    case "GoogleApi":
      let data = encodeURIComponent(orig);
      url =
        "https://translate.googleapis.com/translate_a/single?dt=t&dt=bd&dt=qc&dt=rm&dt=ex&client=gtx" +
        "&hl=" +
        langFrom +
        "&sl=" +
        langFrom +
        "&tl=" +
        langTo +
        "&q=" +
        data +
        "&dj=1" +
        "&tk=" +
        tk(data);
      options = {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      };
      break;

    case "Google":
      url =
        "https://translate.googleapis.com/translate_a/single?" +
        "client=gtx" +
        "&source=input" +
        "&dj=1&q=" +
        encodeURIComponent(orig) +
        "&sl=" +
        langFrom +
        "&tl=" +
        langTo +
        "&hl=" +
        langTo +
        "&dt=t" +
        "&dt=bd" +
        "&dt=rm" +
        "&dt=rw" +
        "&dt=qca";
      options = {
        headers: {
          Accept: "*/*",
          "Content-type": "application/x-www-form-urlencoded",
          "User-Agent": getRandomUserAgent(),
        },
      };
      break;

    case "Yandex":
      url =
        "https://translate.yandex.net/api/v1/tr.json/translate?srv=tr-url-widget" +
        "&id=96b60190.6540cad4.0f68ceea.74722d75726c2d776964676574-0-0" +
        "&format=html" +
        "&lang=en-ru" +
        "&text=" +
        encodeURIComponent(orig);

      options = {
        headers: {
          Accept: "*/*",
          Connection: "keep-alive",
          "User-Agent": getRandomUserAgent(),
        },
      };
      break;

    case "MyMemory":
      url =
        "https://api.mymemory.translated.net/get?" +
        "q=" +
        encodeURIComponent(orig) +
        "&langpair=EN|RU";
      break;

    case "DeepL":
      deeplInlineTranslate();
      return;

    case "Reverso":
      url = "https://api.reverso.net/translate/v1/translation";

      options = {
        method: "POST",
        body: JSON.stringify({
          format: "text",
          from: "eng",
          to: "rus",
          input: orig,
          options: {
            sentenceSplitter: true,
            origin: "reversomobile",
            contextResults: true,
            languageDetection: true,
          },
        }),
        headers: {
          Accept: "*/*",
          Connection: "keep-alive",
          "User-Agent": getRandomUserAgent(),
          "Content-Type": "application/json",
        },
      };
      break;

    case "LibreTranslate":
      url = "https://translate.argosopentech.com/translate";
      options = {
        method: "POST",
        body: JSON.stringify({
          q: orig,
          source: langFrom,
          target: langTo,
        }),
        headers: { "Content-Type": "application/json" },
      };
      break;

    case "uLanguage":
      url = "https://backenster.com/v2/api/v3/translate/";
      options = {
        method: "POST",
        timeout: 15e3,
        body:
          "platform=browserExtension" +
          "&from=" +
          "&to=ru_RU" +
          "&text=" +
          encodeURIComponent(orig),
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Authorization: "Fujiwaranosai",
        },
        dataType: "json",
      };
      break;

    case "DoTrans_yandex":
      url =
        "https://translate.yandex.net/api/v1/tr.json/translate?srv=tr-url-widget&id=2a97f9cc.629b8fc3.7f6b6cd1.74722d75726c2d776964676574-0-0&format=html&lang=en-ru&text=" +
        encodeURIComponent(orig);
      options = {
        headers: {
          Accept: "*/*",
          Connection: "keep-alive",
          "Content-type": "application/x-www-form-urlencoded",
          "User-Agent": getRandomUserAgent(),
        },
      };
      break;

    case "DoTrans_translator":
    case "DoTrans_microsoft":
    case "DoTrans_google":
      let dotransprovider = provider.replace("DoTrans_", "");
      if (dotransprovider == null || dotransprovider == "") {
        dotransprovider = "google";
      }
      if ((langFrom = "auto")) langFrom = pageLang;
      if (langFrom == "") langFrom = "en";

      url =
        "https://imtranslator.net/dotrans.asp?" +
        "dir=" +
        langFrom +
        "/" +
        langTo +
        "&provider=" +
        dotransprovider +
        "&text=" +
        encodeURIComponent(orig);
      options = {
        method: "POST",
        body: JSON.stringify({
          dir: langFrom + "/" + langTo,
          provider: dotransprovider,
          text: orig,
        }),
        headers: {
          Accept: "*/*",
          Connection: "keep-alive",
          "Content-type": "application/x-www-form-urlencoded",
          "User-Agent": getRandomUserAgent(),
        },
      };
      break;
  }
  if (url == null) {
    console.log("Не задан URL сервиса первода");
  }

  let onResponse = function (resp) {
    // console.log('Ответ от сервиса "' + provider + '": ', resp,);
    switch (provider) {
      case "Google":
      case "GoogleApi":
      case "Reverso":
      case "Yandex":
      case "LibreTranslate":
      case "DoTrans_yandex":
      case "MyMemory":
      case "uLanguage":
        resp.json().then(function (json) {
          // console.log('Json от сервиса "' + provider + '": ', json,);
          if (provider == "Reverso") {
            result(index, orig, json.translation[0], null);
          } else if (provider == "Yandex") {
            result(index, orig, json.text[0], "");
          } else if (provider == "DoTrans_yandex") {
            result(index, orig, json.text[0], "");
          } else if (provider == "uLanguage") {
            result(index, orig, json.result, "");
          } else if (provider == "LibreTranslate") {
            result(index, orig, decodeURIComponent(json.translatedText), "");
          } else if (provider == "MyMemory") {
            let tranlated = decodeURIComponent(
              json.responseData.translatedText
            );
            if (json.responseData.responseStatus != 200)
              result(
                index,
                orig,
                "",
                json.responseData.responseStatus + " [" + tranlated + "]"
              );
            else result(index, orig, tranlated, "");
          } else {
            let translated = "";
            for (let i = 0; i < json.sentences.length; i++) {
              if (json.sentences[i].trans != null) {
                translated += json.sentences[i].trans;
              }
            }
            result(index, orig, translated, null);
          }
        });
        break;
      case "DoTrans_translator":
      case "DoTrans_microsoft":
      case "DoTrans_google":
        resp.text().then(function (text) {
          if (
            text.indexOf("TRANSLATE service is temporarily unavailable") > 0
          ) {
            result(index, orig, "", text);
          } else {
            result(index, orig, text, null);
          }
        });
        break;
    }
  };

  let onCancelOrError = function (resp) {
    console.log('Ошибка ответа от сервиса "' + provider + '": ', resp.message);
    result(index, orig, null, resp.message);
  };

  // run the wrapped async-looking function, listen to its
  // returned promise
  main(token.signal, url, options).then(onResponse, onCancelOrError);

  let timeout = 7000;
  if (
    provider == "Reverso" ||
    provider == "LibreTranslate" ||
    provider == "uLanguage"
  )
    timeout = 70000;
  setTimeout(function onElapsed() {
    token.abort({ message: "Не получили ответ от сервера за 10 сек." });
  }, timeout);
}
//     switch (provider) {
//         case "uLanguage":

//             resp = await fetch("https://backenster.com/v2/api/v3/translate/", {
//                 method: 'POST',
//                 body: JSON.stringify({
//                     platform: "browserExtension",
//                     from: "",
//                     to: "ru_RU",
//                     text: orig
//                 }),
//                 headers: {
//                     "Accept": "application/json, text/javascript, */*; q=0.01",
//                     "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
//                 }
//             });
//             if (needClose) return; // Страница выгружается - нужно прекратить перевод
//             if (resp.ok) {
//                 let json = await resp.json();
//                 result(index, orig, json.translation[0], null);
//             }
//             else {
//                 result(index, orig, '', '[status: ' + resp.status + ',' + resp.statusText + ']');
//             }
//             return;

//         case "Apertium": // нет перевода с английского на русский
//             resp = await fetch('https://apertium.org/apy/translate',
//                 {
//                     method: "POST",
//                     body: "langpair=eng|rus&markUnknown=no&prefs=&q=" + encodeURIComponent(orig),
//                     headers: { "Content-Type": "application/x-www-form-urlencoded" }
//                 });

//             if (needClose) return; // Страница выгружается - нужно прекратить перевод
//             if (resp.ok) {
//                 let json = await resp.json();
//                 result(index, orig, json.responseData.translatedText, '');
//             }
//             else {
//                 result(index, orig, '', '[status: ' + resp.status + ',' + resp.statusText + ']');
//             }
//             return;

//         case "DeepL":
//             chrome.runtime.sendMessage({
//                 action: "translate",
//                 provider: provider,
//                 index: index,
//                 langFrom: langFrom,
//                 langTo: langTo,
//                 orig: orig,
//                 result: result
//             }, function (res) {
//                 console.log('Перевели абзац № ' + (res.index + 1) + ' с помощью ' + res.provider, res.langFrom, res.langTo, '"' + res.orig + '"', '"' + res.translated + '"', res.error);
//                 result(res.index, res.orig, res.translated, res.error);
//             });
//             return;

//         case "Prompt":
//             resp = await fetch('https://www.translate.ru/api/getTranslation',
//                 {
//                     method: 'POST',
//                     body: JSON.stringify({
//                         eventName: "SourceTextChange",
//                         text: orig,
//                         dirCode: "en-ru",
//                         useAutoDetect: true,
//                         h: "-354981933",
//                         aft: "00yZWwjaRW8ZH3yza0VlUIrzcMauV-eW8wxWIZ-0eEPNygPgtc4OawU5qh1JmFMptp_yvh0",
//                         pageIx: 0,
//                         v: 2
//                     }),
//                     headers: {
//                         "Accept": "*/*",
//                         "Connection": "keep-alive",
//                         "User-Agent": getRandomUserAgent(),
//                         "Content-Type": "application/json",
//                     }
//                 });

//             if (needClose) return; // Страница выгружается - нужно прекратить перевод
//             if (resp.ok) {
//                 let json = await resp.json();
//                 result(index, orig, decodeURIComponent(json.text), decodeURIComponent(json.error));
//             }
//             else {
//                 result(index, orig, '', '[status: ' + resp.status + ',' + resp.statusText + ']');
//             }
//             return;

//         case "NLP_Translation":

//             resp = await fetch("https://nlp-translation.p.rapidapi.com/v1/translate?text=" + encodeURIComponent(orig) + "&to=" + langTo + "&from" + langFrom,
//                 {
//                     headers: {
//                         "Accept": "*/*",
//                         "Connection": "keep-alive",
//                         "User-Agent": getRandomUserAgent(),
//                         'X-RapidAPI-Host': 'nlp-translation.p.rapidapi.com',
//                         'X-RapidAPI-Key': '7e94d4f640msh8d84824714c6595p11a93bjsn5e28071e2887'
//                     }
//                 });
//             if (needClose) return; // Страница выгружается - нужно прекратить перевод
//             if (resp.ok) {
//                 let translated = await resp.text();
//                 result(index, orig, translated, null);
//             }
//             else {
//                 result(index, orig, '', '[status: ' + resp.status + ',' + resp.statusText + ']');
//             }
//             return;

function getRandomUserAgent() {
  return (
    "Mozilla/5.0(WindowsNT10.0;Win64;x64)AppleWebKit/537.36(KHTML,likeGecko)Chrome/" +
    59 +
    Math.round(Math.random() * 10) +
    ".0.3497." +
    Math.round(Math.random() * 100) +
    "Safari/537.36"
  );
}

var tk = function (a) {
  var d = [];

  for (var f = 0, e = 0; f < a.length; ++f) {
    var g = a.charCodeAt(f);

    if (128 > g) {
      d[e++] = g;
    } else {
      if (2048 > g) {
        d[e++] = (g >> 6) | 192;
      } else {
        d[e++] = (g >> 12) | 224;
        d[e++] = ((g >> 6) & 63) | 128;
      }
      d[e++] = (g & 63) | 128;
    }
  }

  var b = 0;
  var tk = 0;

  for (e = 0; e < d.length; e++) {
    tk += d[e];
    tk = yf(tk, "+-a^+6");
  }

  tk = yf(tk, "+-3^+b+-f");

  if (0 > tk) {
    tk = (tk & 2147483647) + 2147483648;
  }
  tk %= 1e6;

  return tk.toString() + "." + (tk ^ b).toString();
};

var yf = function (a, b) {
  for (var c = 0; c < b.length - 2; c += 3) {
    var d = b[c + 2];
    d = "a" <= d ? d.charCodeAt(0) - 87 : Number(d);
    d = "+" == b[c + 1] ? a >>> d : a << d;
    a = "+" == b[c] ? (a + d) & 4294967295 : a ^ d;
  }

  return a;
};

async function showStatus(text, time) {
  const status = document.getElementById("status");
  if (text == null || text == "") {
    status.parentNode.classList.add("hidden");
    status.textContent = "";
  } else {
    status.parentNode.classList.remove("hidden");
    status.textContent = text;
    if (time != null) {
      setTimeout(function () {
        status.parentNode.classList.add("hidden");
        status.textContent = "";
      }, time);
    }
  }
}

async function finishTranslate() {
  cafTranslateToken = null;
  showStatus("Закончили перевод страницы.", 750);
  // let rabTitle = document.querySelector("#rabTitle > .translated");
  let rabTitle = document.querySelector("#rabTitle");
  if (rabTitle != null) {
    document.title = 'Читаем: "' + rabTitle.innerText + '"';
  }
}

function nextPrevPage(dir) {
  let newVal;
  switch (readerOptions.layout) {
    case "page":
    case "book":
      let num = getCurrentPage();
      let newNum = num + dir;
      if (newNum < 0) newNum = 0;
      if (newNum >= totalPages) newNum = totalPages - 1;
      textArea.scrollTo(newNum * (pageWidth + columnGap), 0);
      showStatus(newNum + 1 + " / " + totalPages, 700);
      break;
    case "paper":
      let delta = textArea.clientHeight - 30;
      newVal = textArea.scrollTop + delta * dir;
      if (newVal < 0) textArea.scrollTop = 0;
      else textArea.scrollTop = newVal;
      break;
  }
}

function getCurrentPage() {
  return Math.floor(Math.round(textArea.scrollLeft) / (pageWidth + columnGap));
}

function updateLayout() {
  textArea = document.querySelector(".text-col");

  let par = textArea.parentElement;
  //   console.log(par.clientWidth, par.clientHeight);

  pageHeight = par.clientHeight - readerOptions.textMargin.top - readerOptions.textMargin.bottom;
  pageWidth = par.clientWidth - readerOptions.textMargin.left - readerOptions.textMargin.right;
  // let clickPane = document.querySelector(".click-pane");
  // clickPane.style.display = '';

  switch (readerOptions.layout) {
    case "page":
      textArea.style.overflow = "hidden";
      columnGap = 2;
      columnWidth = pageWidth - columnGap;
      break;
    case "book":
      textArea.style.overflow = "hidden";
      columnGap = 60;
      columnWidth = Math.trunc((pageWidth - columnGap) / 2);
      break;

    default:
      // clickPane.style.display = 'none';
      columnGap = 0;
      columnWidth = 0;
      textArea.style.overflow = "auto";
      break;
  }
  textArea.style.columnGap = columnGap == 0 ? '' : columnGap + "px";
  textArea.style.columnWidth = columnWidth == 0 ? '' : columnWidth + "px";
  textArea.style.width = pageWidth + "px";
  textArea.style.height = pageHeight + "px";

  totalWidth = textArea.scrollWidth;
  totalPages = Math.ceil(totalWidth / (pageWidth + columnGap));
  pageNumber = Math.floor(textArea.scrollLeft / pageWidth);

  //   console.log(
  //     readerOptions.layout,
  //     pageNumber,
  //     totalPages,
  //     totalWidth,
  //     parseInt(textArea.style.columnGap),
  //     parseInt(textArea.style.columnWidth)
  //   );
}

function setTheme() {
  if (readerOptions.theme == null)
    readerOptions.theme = readerOptionsDefault.theme;
  const main = document.querySelector("main.content");
  const themeBtns = document.querySelectorAll(".button-theme");
  for (let i = 0; i < themeBtns.length; i++) {
    main.classList.remove(themeBtns[i].getAttribute("data"));
  }
  main.classList.add(readerOptions.theme);
}

function setFontFamily() {
  if (readerOptions.fontFamily == null)
    readerOptions.fontFamily = readerOptionsDefault.fontFamily;
  const main = document.querySelector(".text-container");
  const fonts = document.querySelectorAll("#fontFamilySelect option");
  for (let i = 0; i < fonts.length; i++) {
    main.classList.remove(fonts[i].value);
  }
  main.classList.add(readerOptions.fontFamily);
}

function setLineHeight() {
  if (readerOptions.lineHeight == null)
    readerOptions.lineHeight = readerOptionsDefault.lineHeight;
  const text = document.querySelector(".text-col");
  text.style.lineHeight = readerOptions.lineHeight;
}

function setFontSize() {
  if (readerOptions.fontSize == null)
    readerOptions.fontSize = readerOptionsDefault.fontSize;
  const text = document.querySelector(".text-col");
  text.style.fontSize = readerOptions.fontSize + "%";
  document.querySelector("#fontSize").innerHTML = text.style.fontSize;
}

function setTextAlign() {
  if (readerOptions.textAlign == null)
    readerOptions.textAlign = readerOptionsDefault.textAlign;
  const text = document.querySelector(".text-col");
  text.style.textAlign = readerOptions.textAlign;
}

function setTextHyphenate() {
  if (readerOptions.hyphenate == null)
    readerOptions.hyphenate = readerOptionsDefault.hyphenate;
  const text = document.querySelector(".text-col");
  if (readerOptions.hyphenate) text.innerHTML = hyphenateText(text.innerHTML);
  else text.innerHTML = text.innerHTML.replace(/\xAD/gi, "");
}

function setLayout() {
  if (readerOptions.layout == null)
    readerOptions.layout = readerOptionsDefault.layout;
  const textCont = document.querySelector(".text-container");
  if (readerOptions.layout == "paper") {
    textCont.style.left = 0;
    textCont.style.right = 0;
  }

  const layoutBtns = document.querySelectorAll(".layout-button");
  for (let i = 0; i < layoutBtns.length; i++) {
    textCont.classList.remove(layoutBtns[i].getAttribute("data"));
  }
  textCont.classList.add(readerOptions.layout);
  updateLayout();
  nextPrevPage(-1);
}

function setTextIndent() {
  if (readerOptions.textIndent == null)
    readerOptions.textIndent = readerOptionsDefault.textIndent;
  const text = document.querySelector(".text-col");
  text.style.textIndent = readerOptions.textIndent + "rem";
}

function setTextMargin() {
  if (readerOptions.textMargin == null)
    readerOptions.textMargin = readerOptionsDefault.textMargin;
  const text = document.querySelector(".text-col");
  text.style.marginTop = readerOptions.textMargin.top + "px";
  text.style.marginRight = readerOptions.textMargin.right + "px";
  text.style.marginBottom = readerOptions.textMargin.bottom + "px";
  text.style.marginLeft = readerOptions.textMargin.left + "px";

  // switch (readerOptions.layout) {
  //     case "page":
  //     case "book":
  //         text.style.columnGap =
  //             readerOptions.textMargin.left + readerOptions.textMargin.right + "px";
  //         break;
  //     case "paper":
  //         break;
  // }
  updateLayout();
  nextPrevPage(0);
}

function setLoadNext() {
  if (readerOptions.loadNext == null)
    readerOptions.loadNext = readerOptionsDefault.loadNext;
  chkLoadNext.checked = readerOptions.loadNext == true;

  const maxLoad = document.querySelector("#maxLoad");
  if (chkLoadNext.checked) maxLoad.classList.remove("hidden");
  else maxLoad.classList.add("hidden");
}

function saveOptions() {
  localStorage.setItem("rab-options", JSON.stringify(readerOptions));
}

async function savePageHtml() {
  const capt = document.querySelector("#rabTitle");
  const caption = capt.innerText.replace(/\xAD/gi, "");

  if (readerOptions.useTranslate && !readerOptions.translate.showOriginal) {
    let originals = document.querySelectorAll(".translated-original");
    if (originals.length > 0)
      for (let i = 0; i < originals.length; i++) {
        let o = originals[i];
        o.parentNode.removeChild(o);
      }
  }

  const cont = document.querySelector("#rabContent");
  let artText = cont.outerHTML;
  if (!readerOptions.hyphenate) artText = artText.replace(/\xAD/gi, "");

  cont.outerHTML;

  const content =
    `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
    <meta charset="utf-8">
    <style>

    body {
        font-family: sans-serif;
        background: #fff2e1;
    }

    .rab-text {
      font-size: 1.2em;
      text-align: justify;
      text-indent: 3em;
      word-wrap: break-word;
    }
    
    .rab-text p {
        margin-block-start: 4px;
        margin-block-end: 4px;
    }
    
    .rab-text img {
        float: left;
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        margin: 0 1em 1em 0;
    }
    
    .caption {
        display: inline-block;
        font-size: 1.9em;
        font-weight: bold;
        text-align: center;
        flex: 1;
    }

    .translated-original {
        font-size: 80%;
        color: #707070;
        line-height: 1;
        padding: 2px;
        margin: 0;
    }
    
    .translated {
        color: black;
        padding: 2px;
        margin: 0;
    }
    
    </style>
    </head>
    <body>
` +
    '<div class="caption">' +
    caption +
    "</div>" +
    '<div class="rab-text">' +
    artText +
    "</div>" +
    "</body></html>";

  const blob = new Blob([content], {
    type: "text/html",
  });
  const objectURL = URL.createObjectURL(blob);

  const link = Object.assign(document.createElement("a"), {
    href: objectURL,
    type: "text/html",
    download: caption.replace(/[<>:"/\\|?*]+/g, "") + ".html",
  });
  link.dispatchEvent(new MouseEvent("click"));
  setTimeout(() => URL.revokeObjectURL(objectURL));
}

async function savePageFb2() {
  const capt = document.querySelector("#rabTitle");
  const caption = capt.innerText.replace(/\xAD/gi, "");

  const rabExcerpt = document.querySelector("#rabExcerpt");
  let excerpt = rabExcerpt.innerText.replace(/\n/gi, " ").replace(/\r/gi, "");

  if (readerOptions.useTranslate && !readerOptions.translate.showOriginal) {
    let originals = document.querySelectorAll(".translated-original");
    if (originals.length > 0)
      for (let i = 0; i < originals.length; i++) {
        let o = originals[i];
        o.parentNode.removeChild(o);
      }
  }

  const cont = document.querySelector("#rabContent");
  let all = document.querySelectorAll("#rabContent > *");
  for (let i = 0; i < all.length; i++) {
    console.log(all[i]);
  }
  let artText = cont.innerHTML;
  if (!readerOptions.hyphenate) artText = artText.replace(/\xAD/gi, "");

  let today = new Date();
  let dd = String(today.getDate()).padStart(2, '0');
  let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  let yyyy = today.getFullYear();
  
  const content =
    `<?xml version="1.0" encoding="utf-8"?>
    <FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
     <description>
      <title-info>
       <genre>love_erotica</genre>
       <author>
        <first-name></first-name>
        <last-name></last-name>
       </author>
       <book-title>` + caption +`</book-title>
       <annotation>
        <p><emphasis>` + excerpt + `</emphasis></p>
       </annotation>
       <date></date>
       <lang>ru</lang>
      </title-info>
      <document-info>
       <author>
        <first-name></first-name>
        <last-name></last-name>
       </author>
       <program-used>ReadAsBook</program-used>
       <date value="` + yyyy + "-" + mm + "-" + dd + `">` + yyyy + "-" + mm + "-" + dd + `</date>
       <src-url>` + window.location + `</src-url>
       <id>` + uuidv4() + `</id>
       <version>1.0</version>
      </document-info>
     </description>
     <body>
      <section>
       <title>
        <p>` + caption + `</p>
       </title>
       ` +
    artText
      .replace(/<br>/gi, "<empty-line/>")
      .replace(/<hr>/gi, "<empty-line/>")
      .replace(/<div/gi, "<p")
      .replace(/div>/gi, "p>") +
    `
      </section>
     </body>
   </FictionBook>
`;

  const blob = new Blob([content], {
    type: "text/html",
  });
  const objectURL = URL.createObjectURL(blob);

  const link = Object.assign(document.createElement("a"), {
    href: objectURL,
    type: "text/html",
    download: caption.replace(/[<>:"/\\|?*]+/g, "") + ".fb2",
  });
  link.dispatchEvent(new MouseEvent("click"));
  setTimeout(() => URL.revokeObjectURL(objectURL));
}

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

async function miCloseClick() {
  try {
    toggleMenu(false);

    chrome.runtime.sendMessage(
      {
        action: "set-fullscreen",
        value: false,
        origWindowState: window.origWindowState,
      },
      function () {
        location.reload();
      }
    );
  } catch (ex) {
    console.log("reader.js exception: " + ex.message + ".");
    location.reload();
  }
  return false;
}

function miSetupClick() {
  // console.log('miSetupClick');
  let setupPane = document.querySelector("#setupPane");
  setupPane.classList.toggle("menu-pane-active");
  if (!setupPane.classList.contains("menu-pane-active")) toggleMenu();
  return false;
}

function changeFullScreen(isFullScreen) {
  let miFullScreen = document.querySelector("#miFullScreen");
  miFullScreen.classList.remove("minimize");
  console.log("Change FullScreen: ", isFullScreen);
  if (isFullScreen) {
    miFullScreen.setAttribute("title", "Выход из полноэкранного режима");
    miFullScreen.classList.add("minimize");
  } else {
    miFullScreen.setAttribute("title", "Полный экран");
  }
}

function toggleMenu(checked) {
  let chk = document.querySelector("#chk");
  if (checked == null) chk.checked = !chk.checked;
  else chk.checked = checked;
}

async function deeplInlineTranslate(orig) {
  await DeeplSetLanguage({
    isTargetLanguageConfirmed: true,
    selectedTargetLanguage: "RU",
  });
  DeeplSendMessage({
    action: "dlRequestInlineTranslation",
    payload: {
      requests: [
        {
          text: orig,
        },
      ],
      domainName: window.location.hostname,
      trigger: "inline",
      sourceLang: "EN",
    },
  })
    .then((e) => {
      console.log(e);
      // kt.update({
      //     translationState: s,
      //     translatedSnippet: e[0].text,
      //     originalSnippet: n,
      //     websiteLanguage: e[0].detected_source_language
      // })
    })
    .catch((e) => {
      console.log(e);
      // kt.update({
      //     translationState: s,
      //     originalSnippet: n,
      //     error: e.message ? e.message : chrome.i18n.getMessage(e)
      // })
    });
}

function DeeplSetLanguage(e) {
  chrome.storage.sync.set(e);
}

function DeeplSendMessage(e) {
  return new Promise((t, n) => {
    chrome.runtime.sendMessage(e, function (e) {
      e && e.error && n(e.error), t(e);
    });
  });
}

// console.log('reader.js: End');

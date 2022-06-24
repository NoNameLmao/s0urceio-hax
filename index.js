// ==UserScript==
// @name         s0urceio-hax
// @namespace    http://tampermonkey.net/
// @version      0.10.0-45
// @description  A script that will automate almost all of s0urce.io for you.
// @author       emberglaze
// @match        http://s0urce.io/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=s0urce.io
// @grant        none
// @license      MIT
// ==/UserScript==

/* globals $ */ /* eslint no-multi-spaces: "off" */
(() => {
    const config = {
        message: "https://bit.ly/3vCHQKU", // message to send to the victim
	    autoTarget: false,                 // automatic choosing of the target
	    autoAttack: false,                 // automatic attacking of one of the target's ports
        db: "https://raw.githubusercontent.com/NoNameLmao/s0urceio-hax/main/db.json", // base64 hashes of words
        freq: {           // how often to (everything in milliseconds):
		    word: 720,    // guess the word
		    mine: 800,    // attempt to upgrade miners
		    upgrade: 500, // attempt to upgrade firewalls
		    broke: 800,   // if not enough bitcoins to hack someone - wait before trying again
		    hack: 500,    // wait before restarting the hacking loop
            balance: 100  // update the balance
        },
        playerToAttack: 0,               // which player in the index of the list, 0 is the first player
        maxHackFails: 5,                 // max failed hack attempts before restarting
        maxMinerLevel: 20,               // max allowed levels of miners other than quantum servers and botnets
        maxQBLevel: 100,                 // max allowed quantum servers and botnets level
        maxUpgradeCost: .5,              // will only be allowed to spend a percentage of your balance on upgrading miners
        cdnShowProgressPercentage: true, // show hacking progress in percentage in CDN window title
        infoInPageTitle: true,           // TODO: show some information by changing the page's title
        enableLogging: true,             // Output logs in Devtools console (recommended to be "false" unless debugging, causes huge lag over time)
        gui: {
            enabled: true,  // if you want the bot's own custom window or not (you can always close it in game and reopen it by typing "" in f12 console)
            width: "320px", // window's width  in pixels
            height: "480px" // window's height in pixels
        }
    };
    const vars = {
        listingURL: {},       // a mapping of image urls to words (built over time)
        listingB64: {},       // b64 hashes to words (loaded on start)
        balance: 0,           // your bitcoin balance
        progressBlock: false, // waiting for the bar to move in response to our word
        loops: {            // loops ("null" as a property value placeholder):
            word: null,     // word guessing
            upgrade: null,  // upgrading firewalls
            miner: null,    // buying miners
            balance: null,  // update balance
            pageTitle: null // changing the page title
        },
	    hackProgress: 0, // current hack progress in percentages
        hackFailures: 0, // the amount of fails
        minerStatus: [                                 // amount of bought:
            { name: "shop-basic-miner", value: 0 },    // basic miners;
            { name: "shop-advanced-miner", value: 0 }, // advanced miners;
            { name: "shop-mining-drill", value: 0 },   // mining drills;
            { name: "shop-data-center", value: 0 },    // data centers;
            { name: "shop-bot-net", value: 0 },        // botnets;
            { name: "shop-quantum-server", value: 0 }  // quantum servers.
        ],
        firewall: [                                     // firewall status (indexes aren't mistaken, they start at 1)
            { name: "A", index: 1, needUpgrade: true }, // A
            { name: "B", index: 2, needUpgrade: true }, // B
            { name: "C", index: 3, needUpgrade: true }, // C
            { name: "ALL", needUpgrade: true }
        ],
        gui: {
            dragReady: false,
            dragOffset: { x: 0, y: 0 }
        }
    };
    // idea for using emojis in console: https://stackoverflow.com/a/64291837
    class Logger {
        ok(text) {
            if (!config.enableLogging) return;
            console.log(`📗 ${text}`);
        }
        warn(text) {
            if (!config.enableLogging) return;
            console.log(`📙 ${text}`);
        }
        error(text) {
            if (!config.enableLogging) return;
            console.log(`📕 ${text}`);
        }
        action(text) {
            if (!config.enableLogging) return;
            console.log(`📘 ${text}`);
        }
    }
    const logger = new Logger();
    const app = {
        start() {
            $.get(config.db).done(data => {
                vars.listingB64 = JSON.parse(data);
                // check the windows are open, and open them if they aren't
                if (!$("#player-list").is(":visible")) {
                    logger.warn("\"Target list\" isn't opened!")
                    logger.action('Opening "Target list"...')
                    $("#desktop-list").children("img").click();
                }
                if (!$("#window-shop").is(":visible")) {
                    logger.warn("\"Black market\" isn't opened!");
                    logger.action('Opening "Black market"...')
                    $("#desktop-shop").children("img").click();
                    $("#desktop-miner").children("img").click();
                }
                if (!$("#window-computer").is(":visible")) {
                    logger.warn("\"My computer\" isn't opened!");
                    logger.action('Opening "My computer"...');
				    $("#desktop-computer").children("img").click();
                }
                if (config.gui.enabled) {
                    logger.action("Opening bot window...");
                    if ($("#custom-gui").length > 0) $("#custom-gui").show();
                    else gui.show();
                } else logger.action("Skipping GUI, it's disabled.");
                app.automate();
            });
        },
        restart() {
            app.stop();
            logger.action("Waiting for restart...");
            setTimeout(() => {
                logger.action("Restarting!..");
                app.automate();
            }, config.freq.hack);
        },
        stop() {
            for (const loop in vars.loops) {
                if (vars.loops[loop] === null) {
                    logger.warn(`Can't stop "${loop}" loop!`);
                    continue;
                }
                clearInterval(vars.loops[loop]);
                vars.loops[loop] = null;
            }
            vars.hackProgress = 0;
            vars.progressBlock = false;
            logger.ok("Stopped all hacking");
        },
        automate() {
            // does everything to prep for hacking except word guessing
            app.attack();
            if (vars.loops.miner === null) vars.loops.miner = setInterval(loops.miner, config.freq.mine);
            if (vars.loops.upgrade === null) vars.loops.upgrade = setInterval(loops.upgrade, config.freq.upgrade);
            if (vars.loops.balance === null) {
                vars.loops.balance = setInterval(() => {
                    vars.balance = parseInt($("#window-my-coinamount").text());
                }, config.freq.balance);
            }
        },
        attack() {
            // if the auto target is toggled, choose the target
            if (config.autoTarget) {
                // with playerToAttack = 0 choose between the 6 first players from the player list
                let rndTarget = getRandomInt(config.playerToAttack, config.playerToAttack + 10);
                // playerToAttack is an int, the index of the player list
                const targetName = $("#player-list").children("tr").eq(rndTarget)[0].innerText.replace(/^.../gm, "");
                logger.ok(`Target's name: ${targetName}`);
                let ownName = $("#window-my-playername")[0].textContent.replace(/  |\r\n|\n|\r/gm, "");
                if (targetName.includes(ownName)) {
                    app.attack();
                }
                logger.action(`Attacking ${targetName}...`);
                // click it, and then hack, and then a random port
                $("#player-list").children("tr").eq(rndTarget)[0].click();
                $("#window-other-button").click();
            }
            if (config.autoAttack) {
                const portNumber = getRandomInt(1, 3);
                const portStyle = $(`#window-other-port${portNumber}`).attr("style");
                if (portStyle.indexOf("opacity: 1") === -1) {
                    logger.warn(`[*] Hacking port ${portNumber} is too expensive!`);
                    logger.action('Waiting to start hacking the port...')
                    setTimeout(app.attack, config.freq.broke);
                    return;
                }
                $(`#window-other-port${portNumber}`).click();
            }
            if (vars.loops.word === null) vars.loops.word = setInterval(loops.word, config.freq.word);
        },
        findWord() {
            const wordLink = $(".tool-type-img").prop("src");
            if (!wordLink.endsWith("s0urce.io/client/img/words/template.png")) {
                if (vars.listingURL.hasOwnProperty(wordLink)) {
                    const word = vars.listingURL[wordLink];
                    logger.ok(`Found word (URL): [${word}]`);
                    app.submit(word);
                    return;
                }
                toDataURL(wordLink).then(dataUrl => {
                    const hash = getHashCode(dataUrl);
                    if (vars.listingB64.hasOwnProperty(hash)) {
                        const word = vars.listingB64[hash];
                        logger.ok(`Found word (B64): [${word}]`);
                        app.learn(word);
                        return;
                    }
                });
            } else {
                if (!$("#window-tool").is("visible")) return;
                logger.warn("Can't find the word link!");
                app.restart();
            }
        },
        learn(word) {
            const wordLink = $(".tool-type-img").prop("src");
            vars.listingURL[wordLink] = word;
            app.submit(word);
        },
        submit(word) {
            const typeBox = document.getElementById("tool-type-word");
            typeBox.value = word;
            $("#tool-type-form > button").click();
        }
    }
    const loops = {
        word() {
            if ($("#targetmessage-input").is(":visible") === true) {
                setCDMTitle('cdm (idle)');
                $("#targetmessage-input").val(config.message);
                $("#targetmessage-button-send").click();
                app.restart();
                return;
            }
            if (vars.progressBlock) {
                const newHackProgress = parseHackProgress($("#progressbar-firewall-amount").attr("style"));
                if (vars.hackProgress === newHackProgress) {
                    logger.warn("Progress bar hasn't moved!");
                    logger.action('Waiting for progress bar to move, it is possibly lagging.')
                    vars.hackFailures++;
                    if (vars.hackFailures >= config.maxHackFails) {
                        vars.hackFailures = 0;
                        logger.warn("Progress bar is stuck!");
                        logger.action('Retrying!')
                        vars.listingURL = {};
                        app.restart();
                    }
                    return;
                }
                vars.hackFailures = 0;
                vars.hackProgress = newHackProgress;
                setCDMTitle(`cdm (${$("#progressbar-firewall-amount").prop("style").width} progress)`);
                vars.progressBlock = false;
            }
            vars.progressBlock = true;
            app.findWord();
        },
        miner() {
            for (const miner of vars.minerStatus) {
                miner.value = parseInt($(`#${miner.name}-amount`).text());
                if ($(`#${miner.name}`).attr("style") === "opacity: 1;") {
                    if (miner.value >= config.maxQBLevel) continue;
                    const isAdvancedMiner = (miner.name === "shop-quantum-server" || miner.name === "shop-bot-net") ? true : false;
                    if (miner.value >= config.maxMinerLevel && !isAdvancedMiner) continue;
                    $(`#${miner.name}`).click();
                }
            }
        },
        upgrade() {
            if (!vars.firewall[3].needUpgrade) return;
            const i = getRandomInt(0, 2);
            // index refers to 1,2,3, the index in the DOM (use for selectors)
            const index = vars.firewall[i].index;
            // if this firewall is already fully upgraded, get an other random firewall.
            if (!vars.firewall[i].needUpgrade) vars.loops.upgrade();
            // if the back button is visible, we're on a page, let's back out and hide the firewall warning.
            if ($("#window-firewall-pagebutton").is(":visible") === true) {
                $("#tutorial-firewall").css("display", "none");
                $("#window-firewall-pagebutton").click();
            }
            // click on the firewall
            logger.action(`Handling upgrades to firewall ${vars.firewall[i].name}...`);
            $(`#window-firewall-part${index}`).click();
            // get stats
            const stats = [
                parseInt($("#shop-max-charges").text()),
                parseInt($("#shop-strength").text()),
                parseInt($("#shop-regen").text())
            ];
            const statLookup = [
                "max_charge10",
                "difficulty",
                "regen"
            ];
            const maxStats = [30, 4, 10];
            let maxUpgradeCount = 0;
            for (const stat in maxStats) {
                if (stats[stat] < maxStats[stat]) {
                    const statPrice = parseInt($(`#shop-firewall-${statLookup[stat]}-value`).text());
                    if (statPrice < (vars.balance * config.maxUpgradeCost)) {
                        logger.action(`Buying: ${$(".window-shop-element-info b").eq(stat).text()}...`);
                        $(`#shop-firewall-${statLookup[stat]}`).click();
                        // buy more than one upgrade, but only if they cost less than a third of the bitcoin balance.
                        // return;
                    }
                } else {
                    maxUpgradeCount++;
                    if (maxUpgradeCount === 3) {
                        vars.firewall[i].needUpgrade = false;
                        if (vars.firewall.every(checkFirewallsUpgrades)) vars.firewall[3].needUpgrade = false;
                    }
                }
            }
            if ($("#window-firewall-pagebutton").is(":visible")) $("#window-firewall-pagebutton").click();
        }
    }
    const gui = {
        show() {
            const sizeCSS = `height: ${config.gui.height}; width: ${config.gui.width};`;
            const labelMap = {
                word: "Word Speed",
                mine: "Miner Upgrade",
                upgrade: "Firewall Upgrade",
                hack: "Hack Wait"
            }
            function freqInput(type) {
                return (
                    '<span style="font-size:15px">'+
                        `${labelMap[type]}:`+
                        `<input type="text" class="custom-gui-freq input-form" style="width:50px;margin:0px 0px 15px 5px;border:" value="${config.freq[type]}" data-type="${type}">ms<br>`+
                    '</span>'
                )
            }
            const botWindowHTML = (
                `<div id="custom-gui" class="window" style="border-color: rgb(62, 76, 95); color: rgb(191, 207, 210); ${sizeCSS} z-index: 10; top: 11.5%; left: 83%;">`+
                    '<div id="custom-gui-bot-title" class="window-title" style="background-color: rgb(62, 76, 95);">'+
                        's0urceio-hax GUI'+
                        '<span class="window-close-style">'+
                            '<img class="window-close-img" src="http://s0urce.io/client/img/icon-close.png">'+
                        '</span>'+
                    '</div>'+
                    `<div class="window-content" style="${sizeCSS}">`+
                        '<div id="custom-restart-button" class="button" style="display: block; margin-bottom: 15px">'+
                            'Restart Bot'+
                        '</div>'+
                        '<div id="custom-stop-button" class="button" style="display: block; margin-bottom: 15px">'+
                            'Stop Bot'+
                        '</div>'+
                        '<div id="custom-autoTarget-button" class="button" style="display: block; margin-bottom: 15px">'+
                            'Auto pick targets'+
                        '</div>'+
                        '<div id="custom-autoAttack-button" class="button" style="display: block; margin-bottom: 15px">'+
                            'Auto hack ports'+
                        '</div>'+
                        '<span>Message to victim:</span>'+
                        '<br>'+
                        `<input type="text" class="custom-gui-msg input-form" style="width:250px;height:30px;border:;background:lightgrey;color:black" value="${config.message}">`+
                        '<br><br>'+
                        freqInput("word")+
                        freqInput("mine")+
                        freqInput("upgrade")+
                        freqInput("hack")+
                        '<div id="custom-github-button" class="button" style="display: block;">'+
                            'Check this out on Github!'+
                        '</div>'+
                    '</div>'
            );
            $("#login-page > div.login-window > div:nth-child(4)")[0].outerHTML = '';
            $(".window-wrapper").append(botWindowHTML);
            $("#custom-autoTarget-button").css("color", config.autoTarget ? "green" : "red");
            $("#custom-autoAttack-button").css("color", config.autoAttack ? "green" : "red");
            $("#custom-gui-bot-title > span.window-close-style").on("click", () => $("#custom-gui").hide());
            $("#custom-restart-button").on("click", () => app.restart());
            $("#custom-stop-button").on("click", () => app.stop());
            $("#custom-autoTarget-button").on("click", () => {
                config.autoTarget = !config.autoTarget;
                $("#custom-autoTarget-button").css("color", config.autoTarget ? "green" : "red");
            });
            $("#custom-autoAttack-button").on("click", () => {
		    	config.autoAttack = !config.autoAttack;
	    		$("#custom-autoAttack-button").css("color", config.autoAttack ? "green" : "red");
	    	});
            $("#custom-github-button").on("click", () => window.open("https://github.com/NoNameLmao/s0urceio-hax"));
            $(".custom-gui-freq").on("keypress", e => {
	    		if (e.keyCode !== 13) return;
	    		const type = $(e.target).attr("data-type");
	    		if (!config.freq[type]) return;
		    	config.freq[type] = $(e.target).val();
	    		logger.ok(`Frequency for '${type}' set to ${config.freq[type]}`);
	    	});
            $(".custom-gui-msg").on("keypress", e => {
                if (e.keyCode !== 13) return;
                config.message = $(e.target).val();
                logger.ok(`Message for set to: ${config.message}`);
                setCDMTitle('cdm (idle)');
            });
            // make the bot window draggable
            $(document).on("mousedown", "#custom-gui", e => {
                vars.gui.dragReady = true;
                vars.gui.dragOffset.x = e.pageX - $("#custom-gui").position().left;
                vars.gui.dragOffset.y = e.pageY - $("#custom-gui").position().top;
            });
            $(document).on("mouseup", "#custom-gui", () => {
                vars.gui.dragReady = false;
            });
            $(document).on("mousemove", e => {
                if (vars.gui.dragReady) {
                    $("#custom-gui").css("top", `${e.pageY - vars.gui.dragOffset.y}px`);
                    $("#custom-gui").css("left", `${e.pageX - vars.gui.dragOffset.x}px`);
                }
            });
        }
    };
    function checkFirewallsUpgrades(FW, index) {
        if (index == 3) return true;
        return !FW.needUpgrade;
    }
    function parseHackProgress(progress) {
        if (!$("#window-tool").is(":visible")) return NaN;
        const newProgress = progress.slice(0, -2);
        const newProgressParts = newProgress.split("width: ");
        return parseInt(newProgressParts.pop());
    }
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function getHashCode(data) {
        if (data.length === 0) return 0;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const c = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + c;
            hash &= hash;
        }
        return hash.toString();
    }
    function toDataURL(url) {
        return fetch(url).then(response => response.blob()).then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }))
    }
    function setCDMTitle(title) {
        const cdmTitle = $("#window-tool > div.window-title")[0];
        if (!config.cdmShowProgressPercentage) cdmTitle.textContent = `\n\t\t\t\t\t\tcdm \n\t\t\t\t\t`;
        cdmTitle.textContent = `\n\t\t\t\t\t\t${title} \n\t\t\t\t\t`;
    }
    logger.ok("Loaded! Awaiting login...");
    $("#window-msg2")[0].outerHTML = '';
    $("#desktop-wrapper").first().offset({ top: 0, left: 0 });
    $("#tool-type-form")[0].innerHTML += `<button type="submit" class="button">Send</button>`;
    $("#window-firewall-part1-amount").click();
    $("#login-page > div:nth-child(2)")[0].outerHTML = (
        '<div style="position: absolute; width: 100%; bottom: 20px; text-align: center">'+
            '\n\t\t\t\n\t\t\t\tCopyright 2017 s0urce.io -'+
                '<a href="client/contact.txt">'+
                    'Contact, Terms of Service &amp; Credits'+
                '</a>'+
                '\n\t\t\t\t'+
                '<div style="opacity: 0.5">'+
                    "This website is only a game. Actual hacking is possible, but don't do it."+
                '</div>'+
                '\n\t\t\t'+
                '<div style="opacity: 0.3; color: #ff2">'+ // version
                    's0urceio-hax v0.10.0-45 ~~ Made by <a href="https://github.com/snollygolly/sourceio-automation" style="color: #ff2" target="_blank" rel="noopener noreferrer">snollygolly</a>, improved && updated by <a href="https://github.com/NoNameLmao/s0urceio-hax"style="color: #ff2" target="_blank" rel="noopener noreferrer">emberglaze</a>'+
                '</div>'+
        '</div>'
    );
    $("#login-page > div.login-window > div:nth-child(2)")[0].outerHTML = (
        '<div style="width: 100%; text-align: center">'+
            '\n\t\t\t\t\t'+
            '<img src="https://cdn.discordapp.com/icons/324530421327069185/18e6943b4f3c47d37b0428e858d0d0d4.webp?size=80" style="margin-top: 20px">'+
            '<span class="txt-rotate"></span>'+
            '\n\t\t\t\t'+
        '</div>'
    );
    $("#login-play").on('click', () => {
        logger.ok("Starting in 5 seconds to make sure that the entire page loaded, don't panic!");
        setTimeout(app.start, 5000);
    });
    const TxtRotate = function(el) {
        this.el = el;
        this.period = 2000;
        this.txt = '';
        this.tick();
        this.isDeleting = false;
    };
    TxtRotate.prototype.tick = function() {
        const fullTxt = 's0urce.io'
        if (this.isDeleting) this.txt = fullTxt.substring(0, this.txt.length - 1);
        else this.txt = fullTxt.substring(0, this.txt.length + 1);
        this.el.innerHTML = `<span class="txt-rotate" style="font-size: 60px">${this.txt}</span>`;
        const that = this;
        let delta = 250 - Math.random() * 100;
        if (this.isDeleting) { delta /= 2; }
        if (!this.isDeleting && this.txt === fullTxt) {
            delta = this.period;
            this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
            this.isDeleting = false;
            this.loopNum++;
            delta = 250;
        }
        setTimeout(() => that.tick(), delta);
    };
    window.onload = () => {
        new TxtRotate($("#login-page > div.login-window > div:nth-child(2) > span")[0]);
        $("#login-page > div.login-window > div:nth-child(4)")[0].outerHTML = '';
        $("#login-page > div.login-window > div:nth-child(6)")[0].outerHTML = '';
        enableRightClick();
    }
    $("#window-log > div.window-content > div > div")[0].innerHTML = "System started. s0urceio-hax's GUI will show in 5 seconds to make sure the page finished loading.";
    $("#window-miner > div.window-title")[0].textContent = 'My miners';
    function changePageTitle(title) {
        $("title")[0].textContent = title;
    }
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    let playerLevel;
    let currentPageTitleIndex = 0;
    const pageTitleInfoArray = ['s0urce.io', `Player level: ${playerLevel}`, `Balance: ${vars.balance}`];
    setInterval(() => {
        playerLevel = $("#window-my-playerlevel")[0].textContent;
        changePageTitle(pageTitleInfoArray[currentPageTitleIndex]);
        currentPageTitleIndex++;
        if (currentPageTitleIndex > pageTitleInfoArray - 1) currentPageTitleIndex = 0;
    }, 5000);
    // access all userscript vars from the window object in console
    window.hax = { config, app, vars, loops, gui }

    // ALLOW RIGHT CLICK
    function enableRightClick() {
        const css = document.createElement('style');
        const { head } = document;
        css.type = 'text/css';
        css.innerText = `* {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
        }`;
        function main() {
            const { body } = document;
            const documentEvents = [
                document.oncontextmenu = null,
                document.onselectstart = null,
                document.ondragstart = null,
                document.onmousedown = null
            ];
            const bodyEvents = [
                body.oncontextmenu = null,
                body.onselectstart = null,
                body.ondragstart = null,
                body.onmousedown = null,
                body.oncut = null,
                body.oncopy = null,
                body.onpaste = null
            ];
            [].forEach.call(
                ['copy', 'cut', 'paste', 'select', 'selectstart'],
                function(event) {
                    document.addEventListener(event, function(e) {
                        e.stopPropagation();
                    }, true);
                }
            );
            alwaysAbsoluteMode();
            enableCommandMenu();
            head.appendChild(css);
            document.addEventListener('keydown', keyPress);
            function keyPress(event) {
                if (event.ctrlKey && event.keyCode == 192) {
                    return confirm('Activate Absolute Right Click Mode!') == true ? absoluteMode() : null;
                }
            }
            function absoluteMode() {
                [].forEach.call(
                    ['contextmenu', 'copy', 'cut', 'paste', 'mouseup', 'mousedown', 'keyup', 'keydown', 'drag', 'dragstart', 'select', 'selectstart'],
                    function(event) {
                        document.addEventListener(event, function(e) {
                            e.stopPropagation();
                        }, true);
                    }
                )
            }
            function alwaysAbsoluteMode() {
                let sites = ['example.com','www.example.com'];
                const list = RegExp(sites.join('|')).exec(location.hostname);
                return list ? absoluteMode() : null;
            }
            function enableCommandMenu() {
                const commandMenu = true;
                try {
                    if (typeof(GM_registerMenuCommand) == undefined) return;
                    else {
                        if (commandMenu == true) {
                            GM_registerMenuCommand('Enable Absolute Right Click Mode', function() {
                                return confirm('Activate Absolute Right Click Mode!') == true ? absoluteMode() : null;
                            });
                        }
                    }
                }
                catch(err) {
                    console.log(err);
                }
            }
            const blacklist = [
                'youtube.com','.google.','.google.com','greasyfork.org','twitter.com','instagram.com','facebook.com','translate.google.com','.amazon.','.ebay.','github.',
                'stackoverflow.com','bing.com','live.com','.microsoft.com','dropbox.com','pcloud.com','box.com','sync.com','onedrive.com','mail.ru','deviantart.com',
                'pastebin.com','dailymotion.com','twitch.tv','spotify.com','steam.com','steampowered.com','gitlab.com','.reddit.com'
            ]
            let enabled = false;
            const url = window.location.hostname;
            const match = RegExp(blacklist.join('|')).exec(url);
            if (window && typeof window != undefined && head != undefined) {
                if (!match && enabled != true) {
                    main();
                    enabled = true;
                    window.addEventListener('contextmenu', function contextmenu(event) {
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        const handler = new eventHandler(event);
                        window.removeEventListener(event.type, contextmenu, true);
                        const eventsCallback = new eventsCall(function() {});
                        handler.fire();
                        window.addEventListener(event.type, contextmenu, true);
                        if (handler.isCanceled && (eventsCallback.isCalled)) event.preventDefault();
                    }, true);
                }
            }
            function eventsCall() {
                this.events = ['DOMAttrModified', 'DOMNodeInserted', 'DOMNodeRemoved', 'DOMCharacterDataModified', 'DOMSubtreeModified'];
                this.bind();
            }
            eventsCall.prototype.bind = function() {
                this.events.forEach(function(event) {
                    document.addEventListener(event, this, true);
                }.bind(this));
            }
            eventsCall.prototype.handleEvent = function() {
                this.isCalled = true;
            }
            eventsCall.prototype.unbind = function() {
                this.events.forEach(function(event) {});
            }
            function eventHandler(event) {
                this.event = event;
                this.contextmenuEvent = this.createEvent(this.event.type);
            }
            eventHandler.prototype.createEvent = function(type) {
                const { target } = this.event;
                const event = target.ownerDocument.createEvent('MouseEvents');
                event.initMouseEvent(
                    type, this.event.bubbles, this.event.cancelable,
                    target.ownerDocument.defaultView, this.event.detail,
                    this.event.screenX, this.event.screenY, this.event.clientX, this.event.clientY,
                    this.event.ctrlKey, this.event.altKey, this.event.shiftKey, this.event.metaKey,
                    this.event.button, this.event.relatedTarget
                );
                return event;
            }
            eventHandler.prototype.fire = function() {
                const { target } = this.event;
                const contextmenuHandler = function(event) {
                    event.preventDefault();
                }
                target.dispatchEvent(this.contextmenuEvent);
                this.isCanceled = this.contextmenuEvent.defaultPrevented;
            }
        }
    };
})();

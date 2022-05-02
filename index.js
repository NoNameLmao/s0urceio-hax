// ==UserScript==
// @name         s0urceio-hax
// @namespace    http://tampermonkey.net/
// @version      0.2-alpha
// @description  A script that will automate the entirety of s0urce.io for you.
// @author       emberglaze
// @match        http://s0urce.io/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=s0urce.io
// @grant        none
// @require      http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// ==/UserScript==

/* globals $ */
(function() {
    'use strict';
    const config = {
        message: "javascript on top",
	    autoTarget: true,
	    autoAttack: true,
        db: "https://raw.githubusercontent.com/NoNameLmao/s0urceio-hax/main/db.json",
        freq: {
            // how often to guess
		    word: 650,
            // how often to attempt to upgrade mining tools
		    mine: 1000,
            // how often to attempt to upgrade firewalls
		    upgrade: 1000,
            // if not enough bitcoins to hack someone - how long to wait before trying again
		    broke: 1000,
            // how long to wait before restarting the hacking loop
		    hack: 1000
        },
        // which player in the index of the list, 0 is the first player (the bot target a player with index between playerToAttack and playerToAttack + 3 (random)
        playerToAttack: 0,
        // max failed hack attempts before restarting
        maxHackFails: 5,
        // how high to upgrade all of your miner types except quantum-servers and botnets.
        maxMinerLevel: 20,
        maxQBLevel: 100,
        // current BTC * maxUpgradeCost
        maxUpgradeCost: .5,
        gui: {
            enabled: true,
            width: "320px",
            height: "500px"
        },
        ocr: {
            enabled: false,
            url: "http://api.ocr.space/parse/image",
            key: "XXX"
        }
    };
    const vars = {
        // a mapping of image urls to words (built over time)
        listingURL: {},
        // b64 hashes to words (loaded on start)
        listingB64: {},
        balance: 0,
        flags: {
            // waiting for OCR to complete
            ocrBlock: false,
            // waiting for the bar to move in response to our word
            progressBlock: false
        },
        loops: {
            word: null,
            upgrade: null,
            miner: null
        },
	    hackProgress: 0,
        hackFailures: 0,
        // miners
        minerStatus: [
            { name: "shop-basic-miner", value: 0 },
            { name: "shop-advanced-miner", value: 0 },
            { name: "shop-mining-drill", value: 0 },
            { name: "shop-data-center", value: 0 },
            { name: "shop-bot-net", value: 0 },
            { name: "shop-quantum-server", value: 0 }
        ],
        firewall: [
            { name: "A", index: 1, needUpgrade: true },
            { name: "B", index: 2, needUpgrade: true },
            { name: "C", index: 3, needUpgrade: true },
            { name: "ALL", needUpgrade: true }
        ],
        gui: {
            dragReady: false,
            dragOffset: { x: 0, y: 0 }
        }
    };
    const app = {
        start() {
            $.get(config.db).done((data) => {
                vars.listingB64 = JSON.parse(data);
                // check the windows are open, and open them if they aren't
                if ($("#player-list").is(":visible") === false) {
                    log("[!] \"Target list\" isn't opened! Opening it...");
                    $("#desktop-list").children("img").click();
                }
                if ($("#window-shop").is(":visible") === false) {
                    log("[!] \"Black market\" isn't opened! Opening it...");
                    $("#desktop-shop").children("img").click();
                    $("#desktop-miner").children("img").click();
                }
                if ($("#window-computer").is(":visible") === false) {
                    log("[!] \"My computer\" isn't opened! Opening it...");
				    $("#desktop-computer").children("img").click();
                }
                if (config.gui.enabled === true) {
                    log("[.] Opening bot window...");
                    if ($("#custom-gui").length > 0) $("#custom-gui").show();
                    else gui.show();
                } else {
                    log("[.] GUI disabled, skipping...");
                }
                // start the automation
                app.automate();
            });
        },
        restart() {
            app.stop();
            log("[.] Waiting for restart...");
            setTimeout(() => {
                log("[!] Restarting!..");
                app.automate();
            }, config.freq.hack);
        },
        stop() {
            // check and disable all loops
            for (const loop in vars.loops) {
                if (vars.loops[loop] === null) {
                    log(`[!] Can't stop "${loop}" loop!`);
                    continue;
                }
                clearInterval(vars.loops[loop]);
                vars.loops[loop] = null;
            }
            vars.hackProgress = 0;
            // reset flags
            vars.flags.ocrBlock = false;
            vars.flags.progressBlock = false;
            log("[.] Stopped all hacking");
        },
        automate() {
            // does everything to prep for hacking except word guessing
            app.attack();
            if (vars.loops.miner === null) {
                // start the loop for btc monitoring
                vars.loops.miner = setInterval(loops.miner, config.freq.mine);
            }
            if (vars.loops.upgrade === null) {
                // start the loop for upgrades
                vars.loops.upgrade = setInterval(loops.upgrade, config.freq.upgrade);
            }
        },
        attack() {
            // if the auto target is toggled, choose the target
            if (config.autoTarget) {
                // with playerToAttack = 0 choose between the 6 first players from the player list
                let rndTarget = getRandomInt(config.playerToAttack, config.playerToAttack + 5);
                // playerToAttack is an int, the index of the player list
                let targetName = $("#player-list").children("tr").eq(rndTarget)[0].innerText;
                let ownName = $("#window-my-playername")[0].innerHTML;
                if (targetName.includes(ownName)) {
                    log('[.] Ignoring my own username...');
                    app.attack();
                }
                log(`[.] Now attacking ${targetName}...`);
                // click it, and then hack, and then a random port
                $("#player-list").children("tr").eq(rndTarget)[0].click();
                $("#window-other-button").click();
            }
            // if the auto attack port is toggled, choose the port and click
            if (config.autoAttack) {
                const portNumber = getRandomInt(1, 3);
                // do a check for money
                const portStyle = $(`#window-other-port${portNumber}`).attr("style");
                if (portStyle.indexOf("opacity: 1") === -1) {
                    // this port costs too much, let's wait a bit
                    log(`[*] Hacking port ${portNumber} is too expensive, waiting...`);
                    setTimeout(app.attack, config.freq.broke);
                    return;
                }
                $(`#window-other-port${portNumber}`).click();
            }
            if (vars.loops.word === null) {
                vars.loops.word = setInterval(loops.word, config.freq.word);
            }
        },
        findWord() {
            const wordLink = $(".tool-type-img").prop("src");
            if (!wordLink.endsWith("s0urce.io/client/img/words/template.png")) {
                if (vars.listingURL.hasOwnProperty(wordLink)) {
                    const word = vars.listingURL[wordLink];
                    log(`[.] Found word (URL): [${word}]`);
                    app.submit(word);
                    return;
                }
                toDataURL(wordLink).then((dataUrl) => {
                    const hash = getHashCode(dataUrl);
                    if (vars.listingB64.hasOwnProperty(hash)) {
                        const word = vars.listingB64[hash];
                        log(`[.] Found word (B64): [${word}]`);
                        app.learn(word);
                        return;
                    }
                    if (config.ocr.enabled) {
                        log("[*] Not seen, trying OCR...");
                        app.doOCR(config.ocr.url, {
                            apikey: config.ocr.key,
                            language: "eng",
                            url: wordLink
                        });
                    } else log("[*] OCR disabled, skipping...");
                });
            } else {
                log("[*] Can't find the word link!");
                // if the target is disconnected and autoTarget disabled, re-enable it.
                if ($("#cdm-text-container span:last").text() === "Target is disconnected from the Server." && !config.autoTarget) {
                    $("#custom-autoTarget-button").click();
                }
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
        },
        doOCR(link, payload) {
            vars.flags.ocrBlock = true;
            // this is made somewhat generic to allow different ocr vendors
            $.post(link, payload).done((data) => {
                const word = String(data.ParsedResults[0].ParsedText).trim().toLowerCase().split(" ").join("");
                if (word.length > 2) {
                    log(`[.] Got data: [${word}]`);
                    $("#tool-type-word").val(word);
                    app.learn(word);
                    vars.flags.ocrBlock = false;
                } else {
                    log("[*] OCR failed!");
                    app.restart();
                }
            });
        }
    }
    const loops = {
        word: () => {
            // block is true is we're mid-OCR
            if (vars.flags.ocrBlock === true) return;
            if ($("#targetmessage-input").is(":visible") === true) {
                // we're done!
                $("#targetmessage-input").val(config.message);
                $("#targetmessage-button-send").click();
                app.restart();
                return;
            }
            // if we're waiting on the progress bar to move
            if (vars.flags.progressBlock === true) {
                const newHackProgress = parseHackProgress($("#progressbar-firewall-amount").attr("style"));
                // check to see if it moved
                if (vars.hackProgress === newHackProgress) {
                    log("[*] Progress bar hasn't moved, waiting...");
                    vars.hackFailures++;
                    if (vars.hackFailures >= config.maxHackFails) {
                        vars.hackFailures = 0;
                        log("[*] Progress bar is stuck, restarting...");
                        // maybe the URLs have changed
                        vars.listingURL = {};
                        app.restart();
                    }
                    return;
                }
                // the bar has moved
                vars.hackFailures = 0;
                vars.hackProgress = newHackProgress;
                vars.flags.progressBlock = false;
            }
            // actually do the word stuff
            vars.flags.progressBlock = true;
            app.findWord();
        },
        miner: () => {
            // first, get the status of our miners
            for (const miner of vars.minerStatus) {
                // set value
                miner.value = parseInt($(`#${miner.name}-amount`).text());
                // this is available to buy
                if ($(`#${miner.name}`).attr("style") === "opacity: 1;") {
                    // buy more quantum servers and botnets, buy botnets at the same rate as the quantum servers
                    if (miner.value >= config.maxQBLevel) {
                        // we're beyond or at the max QB level, no updates needed
                        continue;
                    }
                    // is this an advanced miner?
                    const isAdvancedMiner = (miner.name === "shop-quantum-server" || miner.name === "shop-bot-net") ? true : false;
                    if (miner.value >= config.maxMinerLevel && !isAdvancedMiner) {
                        // this isn't an advanced miner and it's beyond the max level, no updates needed
                        continue;
                    }
                    // we should buy this
                    $(`#${miner.name}`).click();
                }
            }
        },
        upgrade: () => {
            // leave if all firewalls are upgraded to max
            if (!vars.firewall[3].needUpgrade) return;
            // get a random firewall
            const i = getRandomInt(0, 2);
            // index refers to 1,2,3, the index in the DOM (use for selectors)
            const index = vars.firewall[i].index;
            // if this firewall is already fully upgraded, get an other random firewall.
            if (!vars.firewall[i].needUpgrade) vars.loops.upgrade();
            vars.balance = parseInt($("#window-my-coinamount").text());
            // if the back button is visible, we're on a page, let's back out and hide the firewall warning.
            if ($("#window-firewall-pagebutton").is(":visible") === true) {
                $("#tutorial-firewall").css("display", "none");
                $("#window-firewall-pagebutton").click();
            }
            // click on the firewall
            log(`[.] Handling upgrades to firewall ${vars.firewall[i].name}`);
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
                        log(`[.] Buying: ${$(".window-shop-element-info b").eq(stat).text()}`);
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
            // let's go back
            if ($("#window-firewall-pagebutton").is(":visible")) $("#window-firewall-pagebutton").click();
        }
    }
    const gui = {
        show: () => {
            const sizeCSS = `height: ${config.gui.height}; width: ${config.gui.width};`;
            const labelMap = {
                word: "Word Speed",
                mine: "Miner Upgrade",
                upgrade: "Firewall Upgrade",
                hack: "Hack Wait"
            }
            function freqInput(type) {
                return `
                    <span style="font-size:15px">
                        ${labelMap[type]}:
                        <input type="text" class="custom-gui-freq input-form" style="width:50px;margin:0px 0px 15px 5px;border:" value="${config.freq[type]}" data-type="${type}">
                        <span>(ms)</span><br>
                    </span>
                `
            }
            const botWindowHTML = `
                <div id="custom-gui" class="window" style="border-color: rgb(62, 76, 95); color: rgb(191, 207, 210); ${sizeCSS} z-index: 10; top: 11.5%; left: 83%;">
                    <div id="custom-gui-bot-title" class="window-title" style="background-color: rgb(62, 76, 95);">
                        Source.io Bot
                        <span class="window-close-style">
                            <img class="window-close-img" src="http://s0urce.io/client/img/icon-close.png">
                        </span>
                    </div>
                    <div class="window-content" style="${sizeCSS}">
                        <div id="custom-restart-button" class="button" style="display: block; margin-bottom: 15px">
                            Restart Bot
                        </div>
                        <div id="custom-stop-button" class="button" style="display: block; margin-bottom: 15px">
                            Stop Bot
                        </div>
                        <div id="custom-autoTarget-button" class="button" style="display: block; margin-bottom: 15px">
                            Target Auto
                        </div>
                        <div id="custom-autoAttack-button" class="button" style="display: block; margin-bottom: 15px">
                            Port Attack Auto
                        </div>
                        <span>Message to victim:</span>
                        <br>
                        <input type="text" class="custom-gui-msg input-form" style="width:250px;height:30px;border:;background:lightgrey;color:black" value="${config.message}">
                        <br><br>
                        ${freqInput("word")}
                        ${freqInput("mine")}
                        ${freqInput("upgrade")}
                        ${freqInput("hack")}
                        <span style="font-size:15px">
                            Made by snollygolly, updated and improved by emberglaze!
                        </span>
                        <div id="custom-github-button" class="button" style="display: block;">
                            Check it out on Github!
                        </div>
                    </div>
                </div>
            `
            $(".window-wrapper").append(botWindowHTML);
            // color the toggle buttons
            $("#custom-autoTarget-button").css("color", config.autoTarget ? "green" : "red");
            $("#custom-autoAttack-button").css("color", config.autoAttack ? "green" : "red");
            // bind functions to the gui buttons
            $("#custom-gui-bot-title > span.window-close-style").on("click", () => {
                $("#custom-gui").hide();
            });
            $("#custom-restart-button").on("click", () => {
                app.restart();
            });
            $("#custom-stop-button").on("click", () => {
                app.stop();
            });
            $("#custom-autoTarget-button").on("click", () => {
                config.autoTarget = !config.autoTarget;
                $("#custom-autoTarget-button").css("color", config.autoTarget ? "green" : "red");
            });
            $("#custom-autoAttack-button").on("click", () => {
		    	config.autoAttack = !config.autoAttack;
	    		$("#custom-autoAttack-button").css("color", config.autoAttack ? "green" : "red");
	    	});
            $("#custom-github-button").on("click", () => {
		    	window.open("https://github.com/NoNameLmao/s0urceio-hax");
	    	});
            $(".custom-gui-freq").on("keypress", e => {
	    		if (e.keyCode !== 13) {
	    			return;
	    		}
	    		const type = $(e.target).attr("data-type");
	    		if (!config.freq[type]) {
	    			// disregard invalid input
	    			return;
	    		}
		    	config.freq[type] = $(e.target).val();
	    		log(`[*] Frequency for '${type}' set to ${config.freq[type]}`);
	    	});
            $(".custom-gui-msg").on("keypress", e => {
                if (e.keyCode !== 13) return;
                config.message = $(e.target).val();
                log(`[*] Message for set to: ${config.message}`);
            });
            // make the bot window draggable
            const botWindow = "#custom-gui";
            $(document).on("mousedown", botWindow, e => {
                vars.gui.dragReady = true;
                vars.gui.dragOffset.x = e.pageX - $(botWindow).position().left;
                vars.gui.dragOffset.y = e.pageY - $(botWindow).position().top;
            });
            $(document).on("mouseup", botWindow, () => {
                vars.gui.dragReady = false;
            });
            $(document).on("mousemove", (e) => {
                if (vars.gui.dragReady) {
                    $(botWindow).css("top", `${e.pageY - vars.gui.dragOffset.y}px`);
                    $(botWindow).css("left", `${e.pageX - vars.gui.dragOffset.x}px`);
                }
            });
        }
    };
    function checkFirewallsUpgrades(FW, index) {
        if (index === 3) return true;
        return !FW.needUpgrade;
    }
    function parseHackProgress(progress) {
        // remove the %;
        const newProgress = progress.slice(0, -2);
        const newProgressParts = newProgress.split("width: ");
        return parseInt(newProgressParts.pop());
    }
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function getHashCode(data) {
        let hash = 0;
        if (data.length === 0) return hash;
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
    function log(message) {
        console.log(`{s0urceio-hax} ${message}`);
    }
    log("[.] Loaded! Awaiting login...");
    $("#login-page > div.login-window > div:nth-child(4)")[0].outerHTML = ''
    $("#login-page > div.login-window > div:nth-child(6)")[0].outerHTML = ''
    $("#window-msg2")[0].outerHTML = ''
    $("#desktop-wrapper").first().offset({ top: 0, left: 0 });
	// add a "submit" button as a fix to a bug where the word doesnt get submitted
    $("#tool-type-form")[0].innerHTML += `<button type="submit" class="button">Send</button>`;
    $("#login-play").on('click', () => {
        log("[!] Starting in 5 seconds to make sure that the entire page loaded, don't panic!");
        setTimeout(app.start, 5000);
    });
    // access all userscript vars from the window object in console
    window.little_trolling = { config, app, vars, loops, gui }
})();

const config = {
    message: "https://bit.ly/3vCHQKU", // message to send to the victim
    autoTarget: false,                 // automatic choosing of the target
    autoAttack: false,                 // automatic attacking of one of the target's ports
    autoBuyMiners: false,              // automatic purchase of miners
    db: "https://raw.githubusercontent.com/NoNameLmao/s0urceio-hax/main/db.json", // base64 hashes of words
    freq: {           // how often to (everything in milliseconds):
	    word: 800,    // guess the word
	    mine: 500,    // attempt to upgrade miners
	    upgrade: 250, // attempt to upgrade firewalls
	    broke: 500,   // if not enough bitcoins to hack someone - wait before trying again
	    hack: 100,    // wait before restarting the hacking loop
        balance: 100  // update the balance
    },
    playerToAttack: 0,               // which player in the index of the list, 0 is the first player
    maxHackFails: 5,                 // max failed hack attempts before restarting
    maxMinerLevel: 20,               // max allowed levels of miners other than quantum servers and botnets
    maxQBLevel: 100,                 // max allowed quantum servers and botnets level
    maxUpgradeCost: .3,              // will only be allowed to spend a percentage of your balance on upgrading miners
    cdnShowProgressPercentage: true, // show hacking progress in percentage in CDN window title
    infoInPageTitle: true,           // TODO: show some information by changing the page's title
    enableLogging: false,            // Output logs in Devtools console (recommended to be "false" unless debugging, causes huge lag over time if console isn't cleared regularly)
    gui: {
        enabled: true,  // if you want the bot's own custom window or not (you can always close it in game and reopen it by typing "" in f12 console)
        width: "320px", // window width  in pixels
        height: "580px" // window height in pixels
    }
};
const vars = {
    listingURL: {},             // a mapping of image urls to words (built over time)
    listingB64: {},             // b64 hashes to words (loaded on start)
    balance: 0,                 // your bitcoin balance
    progressBlock: false,       // waiting for the bar to move in response to our word,
    previousHackedPort: null,   // the port that was previously hacked, to avoid trying to hack a closed port
    previousHackedPlayer: null, // the player that was previously hacked
    loops: {            // loops ("null" as a property value placeholder):
        word: null,     // word guessing
        upgrade: null,  // upgrading firewalls
        miner: null,    // buying miners
        balance: null,  // update balance
        pageTitle: null // changing the page title
    },
    hackStatus: false, // if currently hacking or not
    hackProgress: 0,   // current hack progress in percentages
    hackFailures: 0,   // the amount of fails
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
        visible: false, // cant trust jquery
        dragReady: false,
        dragOffset: { x: 0, y: 0 }
    }
};
// idea for using emojis in console: https://stackoverflow.com/a/64291837
class Logger {
    ok(any) { if (config.enableLogging) console.log('📗', any) }
    warn(any) { if (config.enableLogging) console.log('📙', any) }
    error(any) { if (config.enableLogging) console.log('📕', any) }
    action(any) { if (config.enableLogging) console.log('📘', any) }
}
const logger = new Logger();
const app = {
    start() {
        $.get(config.db).done(data => {
            vars.listingB64 = JSON.parse(data);
            // check the windows are open, and open them if they aren't
            if (!$("#player-list").is(":visible")) {
                logger.warn(`"Target list" isn't opened!`)
                logger.action('Opening "Target list"...')
                $("#desktop-list").children("img").click();
            }
            if (!$("#window-shop").is(":visible")) {
                logger.warn(`"Black market" isn't opened!`);
                logger.action('Opening "Black market"...')
                $("#desktop-shop").children("img").click();
                $("#desktop-miner").children("img").click();
            }
            if (!$("#window-computer").is(":visible")) {
                logger.warn(`"My computer" isn't opened!`);
                logger.action('Opening "My computer"...');
			    $("#desktop-computer").children("img").click();
            }
            if (config.gui.enabled) {
                logger.action("GUI enabled, opening bot window...");
                if ($("#custom-gui").length > 0) $("#custom-gui").show();
                else gui.show();
            }
            app.automate();
        });
    },
    restart() {
        logger.action("Preparing for a restart...");
        app.stop();
        setTimeout(() => {
            logger.action("Restarting!");
            app.automate();
        }, config.freq.hack);
    },
    stop() {
        for (const loop in vars.loops) {
            if (vars.loops[loop] === null) {
                logger.warn(`Can't stop "${loop}"!`);
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
        // does everything to prepare for hacking except word guessing
        app.attack();
        if (vars.loops.miner === null) vars.loops.miner = setInterval(loops.miner, config.freq.mine);
        if (vars.loops.upgrade === null) vars.loops.upgrade = setInterval(loops.upgrade, config.freq.upgrade);
        if (vars.loops.balance === null) {
            vars.loops.balance = setInterval(() => {
                vars.balance = parseFloat($("#window-my-coinamount").text());
            }, config.freq.balance);
        }
    },
    attack() {
        // choose the target if the auto target is toggled
        if (config.autoTarget) {
            // with playerToAttack = 0 choose between the 6 first players from the player list
            let rndTarget = getRandomInt(config.playerToAttack, config.playerToAttack + 10);
            // playerToAttack is an int, the index of the player list
            const targetName = $("#player-list").children("tr").eq(rndTarget)[0].innerText.replace(/^.../gm, "");
            let ownName = $("#window-my-playername")[0].textContent.replace(/  |\r\n|\n|\r/gm, "");
            if (targetName.includes(ownName)) app.attack();
            logger.ok(`Picked ${targetName} as the target.`);
            // click it, and then hack, and then a random port
            $("#player-list").children("tr").eq(rndTarget)[0].click();
            $("#window-other-button").click();
        }
        if (config.autoAttack) {
            const portNumber = getRandomInt(1, 3);
            logger.action(`Attacking port ${portNumber}`)
            const portStyle = $(`#window-other-port${portNumber}`).attr("style");
            if (portStyle.indexOf("opacity: 1") === -1) {
                logger.warn(`[*] Hacking the port is too expensive!`);
                logger.action('Waiting for enough balance...')
                setTimeout(app.attack, config.freq.broke);
                return;
            }
            $(`#window-other-port${portNumber}`).click();
            vars.hackStatus = true;
            vars.previousHackedPort = portNumber;
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
        socket.emit("playerRequest", {
            task: 777,
            word: word
        })
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
            let barProgress = $("#progressbar-firewall-amount").prop("style").width;
            setCDMTitle(`cdm (${barProgress} progress)`);
            vars.progressBlock = false;
        }
        vars.progressBlock = true;
        app.findWord();
    },
    miner() {
        if (!config.autoBuyMiners) return;
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
        if (vars.gui.visible) {
            logger.action("GUI already shown, not opening another window to avoid dublicates.");
            return;
        }
        vars.gui.visible = true;
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
                    '<div id="custom-autoBuyMiners-button" class="button" style="display: block; margin-bottom: 15px">'+
                        'Auto buy miners'+
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
                    '<div id="custom-hide-gui-button-hoverinfo">'+
                        '<span id="custom-hide-gui-button-hoverinfo-content" style="font-weight: bold">'+
                            'You can display the script\'s GUI again by typing "hax.gui.show()" into console'+
                        '</span>'+
                    '</div>'+
                    '<div id="custom-hide-gui-button" class="button" style="display: block;">'+
                        'Hide script GUI'+
                    '</div>'+
                '</div>'
        );
        setCDMTitle('cdm (idle)');
        $(".window-wrapper").append(botWindowHTML);
        $("#custom-autoTarget-button").css("color", config.autoTarget ? "green" : "red");
        $("#custom-autoAttack-button").css("color", config.autoAttack ? "green" : "red");
        $("#custom-autoBuyMiners-button").css("color", config.autoBuyMiners ? "green" : "red");
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
        $("#custom-hide-gui-button").on("click", () => gui.hide());
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
        });
        // make the custom GUI draggable
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
    },
    hide() {
        vars.gui.visible = false;
        $("#custom-gui").hide();
        setCDMTitle('cdm');
        config.cdnShowProgressPercentage = false;
        logger.ok('s0urce-hax has restored the original GUI. To show the script\'s GUI again, type "hax.gui.show()" into console.');
    }
};
// access all userscript vars from the window object in console
window.hax = { config, app, vars, loops, gui }

function checkFirewallsUpgrades(FW, index) {
    if (index == 3) return true;
    return !FW.needUpgrade;
}
function parseHackProgress(progress) {
    if (!$("#window-tool").is(":visible")) return NaN; // cdn is not open
    if (!vars.hackStatus) return NaN; // not hacking
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
$("#window-msg2").hide();
$("#desktop-wrapper").first().offset({ top: 0, left: 0 });
$("#window-firewall-part1-amount").click();
$("#login-page > div > div.login-element-description")[0].outerHTML.replace('<div style="opacity: 0.5">This website is only a game and actual hacking is not possible.</div>',
    '<div style="opacity: 0.5">'+
        "This website is only a game. Actual hacking is possible, but don't do it."+
    '</div>'+
    '\n\t\t\t'+
    '<div style="opacity: 0.3; color: #ff2">'+ // version
        's0urceio-hax v2023.10.13-108~~ Made by <a href="https://github.com/snollygolly/sourceio-automation" style="color: #ff2" target="_blank" rel="noopener noreferrer">snollygolly</a>, improved && updated by <a href="https://github.com/NoNameLmao/s0urceio-hax"style="color: #ff2" target="_blank" rel="noopener noreferrer">emberglaze</a>'+
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
socket.on("prepareClient", () => {
    logger.ok("Starting in 3 seconds to make sure that the entire page loaded.");
    setTimeout(app.start, 3000);
    let playerLevel;
    let currentPageTitleIndex = 0;
    const pageTitleInfoArray = ['s0urce.io', `Player level: ${playerLevel}`, `Balance: ${vars.balance}`];
    setInterval(() => {
        playerLevel = $("#window-my-playerlevel").text();
        changePageTitle(pageTitleInfoArray[currentPageTitleIndex]);
        currentPageTitleIndex++;
        if (currentPageTitleIndex > pageTitleInfoArray - 1) currentPageTitleIndex = 0;
    }, 5000);
});
class TxtRotate {
    constructor(el) {
        this.el = el;
        this.period = 2000;
        this.txt = '';
        this.isDeleting = false;
        this.tick();
    }
    tick() {
        const fullTxt = 's0urce.io';
        if (this.isDeleting) this.txt = fullTxt.substring(0, this.txt.length - 1);
        else this.txt = fullTxt.substring(0, this.txt.length + 1);
        this.el.innerHTML = `<span class="txt-rotate" style="font-size: 60px">${this.txt}<span class="blink">_</span></span>`;
        const that = this;
        let delta = 250 - Math.random() * 100;
        if (this.isDeleting) delta /= 2;
        if (!this.isDeleting && this.txt === fullTxt) {
            delta = this.period;
            this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
            this.isDeleting = false;
            delta = 250;
        }
        setTimeout(() => that.tick(), delta);
    }
}
window.onload = () => {
    logger.ok('Page finished loading!');
    const css = `
.blink {
    animation: blink-animation 1s steps(5, start) infinite;
    -webkit-animation: blink-animation 1s steps(5, start) infinite;
}

@keyframes blink-animation {
    to {
        visibility: hidden;
    }
}

@-webkit-keyframes blink-animation {
    to {
        visibility: hidden;
    }
}
    `;
    const styleTag = document.createElement('style');
	styleTag.textContent = css;
	document.head.appendChild(styleTag);
    new TxtRotate($("#login-page > div.login-window > div:nth-child(2) > span")[0]);
    setCDMTitle('cdm (idle)');
    $("#login-page > div.login-window > div:nth-child(4)").hide();
    $("#login-page > div.login-window > div:nth-child(7)").hide();
    $(".login-window").attr("background", "");
}
$("#window-log > div.window-content > div > div")[0].innerHTML = "System started. s0urceio-hax's GUI will show in 3 seconds.";
$("#window-miner > div.window-title").text('My Miners');
function changePageTitle(title) {
    $("title").text(title);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

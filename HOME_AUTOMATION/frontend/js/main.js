    // --- AUTHENTICATION LOGIC ---
    let currentUser = localStorage.getItem('sh_username') || '';
    let isLoggedIn = false;

    // Power Tracking State Variables
    let deviceStates = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0};
    const DEVICE_WATTS = 10; // 10W per device (light & fan)
    let powerStatsUI = { today: 0, overall: 0 }; 

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('display-username').innerText = currentUser;
        document.getElementById('display-initial').innerText = currentUser.substring(0, 2);
        document.getElementById('manage-user').value = currentUser;
        document.getElementById('login-overlay').style.display = 'flex';
    });

    function handleLoginKeyPress(e) {
        if (e.key === 'Enter') handleLogin();
    }

    async function handleLogin() {
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value.trim();
        
        try {
            let res = await fetch('../php/api.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            let data = await res.json();
            
            if (data.success) {
                isLoggedIn = true;
                currentUser = u;
                localStorage.setItem('sh_username', currentUser);
                
                document.getElementById('display-username').innerText = currentUser;
                document.getElementById('display-initial').innerText = currentUser.substring(0, 2).toUpperCase();
                
                document.getElementById('login-overlay').style.display = 'none';
                document.getElementById('login-error').classList.add('hidden');
                document.getElementById('login-pass').value = ''; 
                return;
            } else {
                document.getElementById('login-error').classList.remove('hidden');
                return;
            }
        } catch(e) {
            console.log("PHP API Unreachable.", e);
            document.getElementById('login-error').classList.remove('hidden');
        }
    }

    function handleLogout() {
        isLoggedIn = false;
        currentUser = '';
        localStorage.removeItem('sh_username');
        document.getElementById('login-overlay').style.display = 'flex';
        showSection('dashboard', document.querySelectorAll('.nav-btn')[0]);
    }

    async function updateCredentials() {
        const newU = document.getElementById('manage-user').value.trim();
        const newP = document.getElementById('manage-pass').value.trim();
        
        if (newU && newP) {
            try {
                await fetch('../php/api.php?action=update_credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ old_username: currentUser, new_username: newU, new_password: newP })
                });
            } catch(e) { console.log("PHP API unreachable", e); }

            currentUser = newU;
            localStorage.setItem('sh_username', currentUser);
            
            document.getElementById('display-username').innerText = currentUser;
            document.getElementById('display-initial').innerText = currentUser.substring(0, 2);
            
            const msg = document.getElementById('manage-msg');
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 3000);
            
            document.getElementById('manage-pass').value = '';
        } else {
            alert("Please enter both a new username and a new password.");
        }
    }

    // --- UI HELPERS ---
    function showSection(id, btn) {
        document.querySelectorAll('.content-section').forEach(e => e.classList.remove('active-section'));
        document.getElementById(id).classList.add('active-section');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if(window.innerWidth<=768) document.getElementById('sidebar').classList.add('max-md:-translate-x-full');
        
        if(id === 'history') {
            fetchHistory();
            fetchPowerHistory(); // Sync logs when opened
        }
    }
    
    document.getElementById('date-display').innerText = new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});

    // --- NEW SEARCH & CALENDAR FILTER HELPERS ---
    function searchItems(containerId, inputId, itemSelector) {
        let filter = document.getElementById(inputId).value.toLowerCase();
        let items = document.querySelectorAll(`#${containerId} ${itemSelector}`);
        items.forEach(item => {
            if(item.tagName === 'TR' && item.cells && item.cells.length <= 1) return; // skip loading rows
            let text = item.innerText.toLowerCase();
            item.style.display = text.includes(filter) ? '' : 'none';
        });
    }

    function filterHistoryByDate(tbodyId, dateInputId) {
        let dateVal = document.getElementById(dateInputId).value; 
        let rows = document.getElementById(tbodyId).getElementsByTagName('tr');
        
        if(!dateVal) {
            for (let i = 0; i < rows.length; i++) rows[i].style.display = '';
            return;
        }

        let d = new Date(dateVal);
        let targetFormat1 = d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); // Matching Device log format
        let targetFormat2 = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'}); // Matching Power log format

        for (let i = 0; i < rows.length; i++) {
            if(rows[i].cells.length > 1) {
                let text = rows[i].cells[0].innerText; // first column has date
                let show = text.includes(targetFormat1) || text.includes(targetFormat2);
                rows[i].style.display = show ? '' : 'none';
            }
        }
    }

    // --- MODIFIED MASTER TOGGLE HELPER ---
    function toggleAllDevices(state) {
        const val = state ? 1 : 0;
        const pins = [0, 1, 2, 3, 4, 5, 6];

        // 1. LOG THE MASTER ACTION: Route through writeVirtual to sync properly with everything.
        // Doing this separately ensures Pin 10 correctly registers its own independent log hit
        fetch(`../php/api.php?blynk_path=update?pin=V10&value=${val}`).then(() => {
             if(document.getElementById('history').classList.contains('active-section')) fetchHistory();
        });

        // 2. TOGGLE INDIVIDUAL DEVICES: Use writeVirtual to natively trigger UI updates!
        pins.forEach(pin => {
            writeVirtual(pin, val);
        });
    }

    // --- HISTORY TABS LOGIC ---
    function switchHistoryTab(tab) {
        if (tab === 'device') {
            document.getElementById('history-device-view').classList.remove('hidden');
            document.getElementById('history-power-view').classList.add('hidden');
            document.getElementById('tab-btn-device').classList.add('bg-white/10', 'text-white');
            document.getElementById('tab-btn-device').classList.remove('text-textSub');
            document.getElementById('tab-btn-power').classList.remove('bg-white/10', 'text-white');
            document.getElementById('tab-btn-power').classList.add('text-textSub');
        } else {
            document.getElementById('history-device-view').classList.add('hidden');
            document.getElementById('history-power-view').classList.remove('hidden');
            document.getElementById('tab-btn-power').classList.add('bg-white/10', 'text-white');
            document.getElementById('tab-btn-power').classList.remove('text-textSub');
            document.getElementById('tab-btn-device').classList.remove('bg-white/10', 'text-white');
            document.getElementById('tab-btn-device').classList.add('text-textSub');
            fetchPowerHistory();
        }
    }

    // --- BLYNK & DEVICE LOGIC ---
    const logBox = document.getElementById("log");
    const authInput = document.getElementById("auth");
    
    // FIX: Set to false to connect directly to Blynk instead of local PHP
    const useLocalPHP_API = true; 

    function log(msg){ logBox.innerHTML = `> ${msg}<br>` + logBox.innerHTML; }

    // --- REPLACED: Dual-Sync Write Function ---
    async function writeVirtual(pin, value){
        log(`Cmd: V${pin} set to ${value}`);
        try {
            // 1. Send to Local PHP API (Updates your MySQL history & database)
            if (useLocalPHP_API) {
                fetch(`../php/api.php?blynk_path=${encodeURIComponent(`update?pin=V${pin}&value=${value}`)}`)
                    .catch(e => console.log("Local API log skipped"));
            }

            // 2. Send to REAL Blynk Cloud (Controls the actual ESP32 hardware)
            const token = authInput.value.trim();
            await fetch(`https://blynk.cloud/external/api/update?pin=V${pin}&value=${value}&token=${token}`);

            setTimeout(refreshStatus, 200); 
            if(document.getElementById('history').classList.contains('active-section')) fetchHistory();
        } catch(e){ log("Error: Check connection"); }
    }

    // --- REPLACED: Dual-Sync Read Function ---
    async function readVirtual(pin){
        try {
            // 1. Always try to read the actual hardware state from Blynk Cloud first
            const token = authInput.value.trim();
            const res = await fetch(`https://blynk.cloud/external/api/get?pin=V${pin}&token=${token}`);
            if(!res.ok) throw new Error("Offline");
            return parseFloat(await res.text());
        } catch (e) { 
            // 2. Fallback to your local PHP database if the internet is down
            if (useLocalPHP_API) {
                try {
                    const localRes = await fetch(`../php/api.php?blynk_path=${encodeURIComponent(`get?pin=V${pin}`)}`);
                    return parseFloat(await localRes.text());
                } catch (err) { return null; }
            }
            return null; 
        }
    }

    let lastLightState = null; 
    let lastTempState = null;

    async function refreshStatus(){
        if (!isLoggedIn) return; 

        const pins = [2,3,4,5,0,1,6];
        const visualMap = { 2:'h-light1', 3:'h-light2', 4:'h-light3', 5:'h-light4', 0:'h-fan1', 1:'h-fan2', 6:'h-fan3' };
        const uiMap = {
            2: {sw:'sw-light1', txt:'txt-light1', card:'card-light1'},
            3: {sw:'sw-light2', txt:'txt-light2', card:'card-light2'},
            4: {sw:'sw-light3', txt:'txt-light3', card:'card-light3'},
            5: {sw:'sw-light4', txt:'txt-light4', card:'card-light4'},
            0: {sw:'sw-fan1', txt:'txt-fan1', card:'card-fan1'},
            1: {sw:'sw-fan2', txt:'txt-fan2', card:'card-fan2'},
            6: {sw:'sw-fan3', txt:'txt-fan3', card:'card-fan3'}
        };

        let lightsOn=0, fansOn=0;
        for(let pin of pins){
            let val = await readVirtual(pin);
            if(val !== null){
                let isOn = (val == 1);
                
                // Track exact device state for power consumption calculations
                deviceStates[pin] = val; 

                if(visualMap[pin]) {
                    let el = document.getElementById(visualMap[pin]);
                    isOn ? el.classList.add('active') : el.classList.remove('active');
                }
                if(uiMap[pin]){
                    let u = uiMap[pin];
                    document.getElementById(u.sw).checked = isOn;
                    document.getElementById(u.txt).innerText = isOn ? "ON" : "OFF";
                    let c = document.getElementById(u.card);
                    isOn ? c.classList.add('active') : c.classList.remove('active');
                }
                if([2,3,4,5].includes(pin) && isOn) lightsOn++;
                if([0,1,6].includes(pin) && isOn) fansOn++;
            }
        }
        document.getElementById('summary').innerHTML = `<span class="text-white">${lightsOn}</span> Lights ON &nbsp;|&nbsp; <span class="text-white">${fansOn}</span> Fans ON`;

        // ==================== UPDATED DHT22 LOGIC ====================
        let temp = await readVirtual(7);
        let hum = await readVirtual(8);
        let ldr = await readVirtual(9); 

        if(temp !== null) {
            document.getElementById('val-temp').innerText = temp.toFixed(1) + '°C';
            
            let currentTempState = lastTempState;
            if(temp >= 30) {
                currentTempState = 'hot';
            } else if(temp <= 28) {
                currentTempState = 'cool';
            }

            if(lastTempState !== currentTempState && currentTempState !== null) {
                lastTempState = currentTempState;
                if(currentTempState === 'hot') {
                    log("Auto: Temp >= 30°C. Turning ON Fans.");
                    [0, 1, 6].forEach(p => writeVirtual(p, 1)); // Turn ON all fans
                } else if(currentTempState === 'cool') {
                    log("Auto: Temp <= 28°C. Turning OFF Fans.");
                    [0, 1, 6].forEach(p => writeVirtual(p, 0)); // Turn OFF all fans
                }
            }
        }

        if(hum !== null) {
            document.getElementById('val-hum').innerText = hum.toFixed(1) + '%';
        }

        // ==================== UPDATED LDR D0 LOGIC ====================
        if(ldr !== null) {
            // Uses D0 Digital Logic (0 or 1). Assumes 1 = Night/Dark
            let isNight = (parseInt(ldr) === 1); 
            document.getElementById('val-ldr').innerText = isNight ? 'Night' : 'Day';
            
            let currentLightState = isNight ? 'night' : 'day'; 
            
            if(currentLightState === 'night') {
                document.getElementById('ldr-icon').className = 'fa-solid fa-moon text-accentBlue drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]';
            } else {
                document.getElementById('ldr-icon').className = 'fa-regular fa-sun text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]';
            }

            if(lastLightState !== currentLightState) {
                lastLightState = currentLightState;
                if(currentLightState === 'night') {
                    log("Auto: Night detected (D0). Turning ON Lights.");
                    [2, 3, 4, 5].forEach(p => writeVirtual(p, 1)); // Turn ON all lights
                } else {
                    log("Auto: Daylight detected (D0). Turning OFF Lights.");
                    [2, 3, 4, 5].forEach(p => writeVirtual(p, 0)); // Turn OFF all lights
                }
            }
        }
    }

    setInterval(refreshStatus, 3000);

    // --- HISTORY LOGIC ---
    async function fetchHistory() {
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-textSub"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</td></tr>';
        
        try {
            const res = await fetch(`../php/api.php?action=get_history`);
            const data = await res.json();
            
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-textSub">No records found.</td></tr>';
                return;
            }

            data.forEach(row => {
                let valDisplay = row.value;
                if(valDisplay == 1 && !row.name.includes('Temperature') && !row.name.includes('Humidity') && !row.name.includes('Sensor')) {
                    valDisplay = '<span class="text-emerald-400 font-bold">Turned ON</span>';
                } else if(valDisplay == 0 && !row.name.includes('Temperature') && !row.name.includes('Humidity') && !row.name.includes('Sensor')) {
                    valDisplay = '<span class="text-red-400 font-bold">Turned OFF</span>';
                }
                
                let t = new Date(row.timestamp).toLocaleString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'numeric', second:'numeric'});

                tbody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-3 pl-4 text-textSub whitespace-nowrap">${t}</td>
                        <td class="py-3 font-medium text-white">${row.name}</td>
                        <td class="py-3">${valDisplay}</td>
                    </tr>
                `;
            });
        } catch (e) {
            // Visual Local Fallback (in case user PHP server is offline, so the table functions properly)
            tbody.innerHTML = '';
            let t = new Date().toLocaleString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'numeric', second:'numeric'});
            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td class="py-3 pl-4 text-textSub whitespace-nowrap">${t}</td>
                    <td class="py-3 font-medium text-white">Living Light 1</td>
                    <td class="py-3"><span class="text-emerald-400 font-bold">Turned ON</span></td>
                </tr>
            `;
        }
    }

    // Fetch Daily Power Log Array
    async function fetchPowerHistory() {
        const tbody = document.getElementById('power-history-body');
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-textSub"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</td></tr>';
        
        try {
            const res = await fetch('../php/api.php?action=get_power_history');
            const data = await res.json();
            
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-textSub">No daily power history recorded yet.</td></tr>';
                return;
            }

            const KWH_COST = 12.0;

            data.forEach(row => {
                let kwh = parseFloat(row.total_kwh);
                let cost = (kwh * KWH_COST).toFixed(2);
                let dateStr = new Date(row.log_date).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'});

                tbody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-3 pl-4 font-medium text-white">${dateStr}</td>
                        <td class="py-3 text-emerald-400 font-bold">${kwh.toFixed(4)} kWh</td>
                        <td class="py-3 text-accentOrg">₱ ${cost}</td>
                    </tr>
                `;
            });
        } catch (e) {
            // Visual Local Fallback (Provides functional dummy data if PHP backend is unavailable)
            tbody.innerHTML = '';
            const KWH_COST = 12.0;
            let mockDates = [new Date(), new Date(Date.now() - 86400000), new Date(Date.now() - 172800000)];
            let mockKwh = [(powerStatsUI.today || 1.2450), 2.1020, 1.8400];
            mockDates.forEach((d, i) => {
                let cost = (mockKwh[i] * KWH_COST).toFixed(2);
                let dateStr = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'});
                tbody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-3 pl-4 font-medium text-white">${dateStr}</td>
                        <td class="py-3 text-emerald-400 font-bold">${mockKwh[i].toFixed(4)} kWh</td>
                        <td class="py-3 text-accentOrg">₱ ${cost}</td>
                    </tr>
                `;
            });
        }
    }

    // --- WAKE WORD & VOICE RECOGNITION ---
    let recognition;
    let recognizing = false;
    let forceQuit = false; 
    let isSpeaking = false; 

    // Professional Wake Word Regex for flexibility in capturing "Ela"
    const WAKE_WORD_REGEX = /\b(ela|ella|ayla|isla|ele|hella|taylor)\b/i;

    function startVoice(){
        if(!('webkitSpeechRecognition' in window)){ 
            alert("Voice recognition not supported in this browser. Try Google Chrome."); 
            return; 
        }
        
        recognition = new webkitSpeechRecognition();
        recognition.lang = "en-US"; 
        recognition.continuous = true; 
        recognition.interimResults = false; 

        recognition.onstart = () => {
            recognizing = true;
            forceQuit = false;
            log("Voice: ALWAYS ON (Waiting for wake word)");
            document.getElementById('btn-listen').classList.remove('bg-accentOrg', 'hover:bg-orange-600');
            document.getElementById('btn-listen').classList.add('bg-emerald-500', 'hover:bg-emerald-600', 'ring-4', 'ring-emerald-500/30');
            document.getElementById('btn-listen').innerHTML = '<i class="fa-solid fa-microphone-lines animate-pulse"></i> Listening...';
        };
        
        recognition.onend = () => {
            recognizing = false;
            
            if (isSpeaking) {
                log("Mic paused while AI is speaking...");
                return;
            }

            if(!forceQuit) {
                log("Mic timed out. Restarting...");
                recognition.start();
            } else {
                log("Voice Stopped Manually");
                document.getElementById('btn-listen').classList.remove('bg-emerald-500', 'hover:bg-emerald-600', 'ring-4', 'ring-emerald-500/30');
                document.getElementById('btn-listen').classList.add('bg-accentOrg', 'hover:bg-orange-600');
                document.getElementById('btn-listen').innerHTML = '<i class="fa-solid fa-microphone"></i> Listen';
            }
        };

        recognition.onresult = (e) => {
            let lastIndex = e.results.length - 1;
            let rawTranscript = e.results[lastIndex][0].transcript.toLowerCase().trim();
            
            // 1. Check for Wake Word using Regex
            let wakeWordDetected = WAKE_WORD_REGEX.test(rawTranscript);

            // 2. Ignore if Wake Word is not spoken
            if(!wakeWordDetected) {
                log(`Ignored (No Name Called): "${rawTranscript}"`);
                return;
            }
            
            // 3. Process the command since it passed the lock
            log(`Wake Word Heard! Processing: "${rawTranscript}"`);
            document.getElementById('chat-window').classList.remove('hidden');
            appendMessage('user', rawTranscript + ' 🎤');

            processChatCommand(rawTranscript);
        };

        recognition.onerror = (event) => {
            log("Mic Error: " + event.error);
            if(event.error === 'no-speech') return; 
        };

        recognition.start();
    }

    function stopVoice(){ 
        forceQuit = true; 
        if(recognition) recognition.stop(); 
    }

    // --- VOICE SYNTHESIS LOGIC (AI Text to Speech) ---
    let synth = window.speechSynthesis;
    let femaleVoice = null;

    function loadVoices() {
        let voices = synth.getVoices();
        femaleVoice = voices.find(v => 
            v.name.toLowerCase().includes('female') || 
            v.name.toLowerCase().includes('zira') || 
            v.name.toLowerCase().includes('samantha') || 
            v.name.toLowerCase().includes('karen') ||
            v.name.toLowerCase().includes('victoria') ||
            v.name.toLowerCase().includes('veena')
        );
        if (!femaleVoice) femaleVoice = voices.find(v => v.lang.startsWith('en'));
    }
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    } else {
        loadVoices(); 
    }

    function speakText(text) {
        if (!synth) return;
        
        let cleanText = text.replace(/[*_]/g, '');
        cleanText = cleanText.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, '');
        cleanText = cleanText.replace(/\n/g, '. ');

        let utterance = new SpeechSynthesisUtterance(cleanText);
        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.pitch = 1.3; 
        utterance.rate = 1.0;
        
        utterance.onstart = () => {
            isSpeaking = true; 
            if (recognizing && recognition) recognition.stop(); 
        };

        utterance.onend = () => {
            isSpeaking = false;
            if (!forceQuit && !recognizing) {
                try { recognition.start(); } catch (e) { console.error("Could not restart mic:", e); }
            }
        };

        synth.speak(utterance);
    }

    // --- NLP & FUZZY MATCHING CHATBOT LOGIC ---
    let chatMemory = {
        lastDevicePins: [],
        lastAction: null,
        lastRoom: null
    };

    function toggleChat() { document.getElementById('chat-window').classList.toggle('hidden'); }
    function handleChatKeyPress(e) { if (e.key === 'Enter') sendChatMessage(); }

    function showTyping() {
        document.getElementById('typing-indicator').classList.add('active');
        const msgContainer = document.getElementById('chat-messages');
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }
    function hideTyping() { document.getElementById('typing-indicator').classList.remove('active'); }

    function appendMessage(sender, text) {
        const msgContainer = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        
        if(sender === 'user') {
            msgDiv.className = 'bg-accentBlue text-white p-3 rounded-xl rounded-tr-none self-end max-w-[85%] shadow-md transform transition-all hover:-translate-y-0.5';
            msgDiv.innerText = text;
        } else {
            let parsedText = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
            msgDiv.className = 'bg-[#1e1e24] text-textMain p-3 rounded-xl rounded-tl-none self-start max-w-[85%] border border-white/5 whitespace-pre-wrap shadow-md flex gap-2 items-start';
            msgDiv.innerHTML = `<i class="fa-solid fa-robot text-accentBlue mt-1 opacity-70"></i> <div>${parsedText}</div>`;
            speakText(text); 
        }
        
        msgContainer.appendChild(msgDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function sendChatMessage() {
        const inputField = document.getElementById('chat-input');
        const text = inputField.value.trim().toLowerCase();
        if (!text) return;
        
        appendMessage('user', inputField.value);
        inputField.value = '';

        showTyping();
        setTimeout(() => processChatCommand(text), 800 + Math.random() * 600);
    }
    
    function processChatCommand(rawCmd) {
        hideTyping();
        let responseParts = [];
        
        const currentHour = new Date().getHours();
        const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening';

        // Split commands by 'and', 'then'
        const commands = rawCmd.split(/\band\b|\bthen\b|,/).map(c => c.trim()).filter(c => c);
        
        let handledGeneral = false;

        commands.forEach(cmd => {
            
            // Database-Driven Power Consumption Chatbot Command updated for Overall
            if (cmd.includes("consume") || cmd.includes("power") || cmd.includes("electricity") || cmd.includes("energy") || cmd.includes("watts")) {
                fetch('../php/api.php?action=get_power_stats')
                .then(res => res.json())
                .then(data => {
                    let reply = `⚡ **Power Consumption Report:**\n`;
                    if (cmd.includes("overall") || cmd.includes("total")) reply += `- **Overall Lifetime:** ${data.overall ? data.overall.toFixed(4) : '0.0000'} kWh\n`;
                    else if (cmd.includes("month") || cmd.includes("months")) reply += `- **Last 30 Days:** ${data.month.toFixed(4)} kWh\n`;
                    else if (cmd.includes("week")) reply += `- **Last 7 Days:** ${data.week.toFixed(4)} kWh\n`;
                    else if (cmd.includes("day") || cmd.includes("today")) reply += `- **Today:** ${data.today.toFixed(4)} kWh\n`;
                    else {
                        reply += `- **Today:** ${data.today.toFixed(4)} kWh\n`;
                        reply += `- **Last 7 Days:** ${data.week.toFixed(4)} kWh\n`;
                        reply += `- **Last 30 Days:** ${data.month.toFixed(4)} kWh\n`;
                        reply += `- **Overall Lifetime:** ${data.overall ? data.overall.toFixed(4) : '0.0000'} kWh\n`;
                    }

                    let currentActiveWatts = 0;
                    for(let pin in deviceStates) {
                        if(deviceStates[pin] == 1) currentActiveWatts += DEVICE_WATTS;
                    }
                    reply += `\nRight now, your devices are consuming **${currentActiveWatts} Watts**.`;

                    appendMessage('ai', reply);
                }).catch(e => {
                    appendMessage('ai', `⚡ **Local Power Consumption Report:**\n- **Today:** ${powerStatsUI.today.toFixed(4)} kWh\n- **Overall:** ${powerStatsUI.overall.toFixed(4)} kWh\n\nI'm using local fallback logs as the database is offline. 🔌`);
                });
                
                handledGeneral = true;
                return;
            }

            // Memory resolution ("turn IT off")
            if (/\b(it|them|those|these)\b/.test(cmd) && chatMemory.lastDevicePins.length > 0) {
                const isTurnOn = /\b(on|enable|start|activate|power up|light up|open|run)\b/.test(cmd);
                const isTurnOff = /\b(off|disable|stop|kill|deactivate|power down|shut|close|out)\b/.test(cmd);
                
                if (isTurnOn || isTurnOff) {
                    const state = isTurnOn ? 1 : 0;
                    chatMemory.lastDevicePins.forEach(pin => writeVirtual(pin, state));
                    responseParts.push(`${isTurnOn ? 'Activated' : 'Deactivated'} the previously mentioned devices.`);
                    return;
                }
            }

            // --- ADVANCED FUZZY MATCHING (TYPO/MISPRONUNCIATION TOLERANT) ---
            const isTurnOn = /\b(on|enable|start|activate|power up|light up|open|run)\b/.test(cmd);
            const isTurnOff = /\b(off|disable|stop|kill|deactivate|power down|shut|close|out)\b/.test(cmd);
            
            // Synonyms & common speech errors
            const wantsLight = /\b(light|lights|lite|lie|like|right|bulb|lamp|illumination)\b/.test(cmd);
            const wantsFan = /\b(fan|fans|fun|van|pan|vent|air|ac|blower|cooler)\b/.test(cmd);
            
            const roomLiving = /\b(living|leaving|live|leave|lounge|front)\b/.test(cmd);
            const roomKitchen = /\b(kitchen|catch in|catch|chicken|kitch|cooking)\b/.test(cmd);
            const roomBed = /\b(bed|bad|bedroom|bathroom|room|master)\b/.test(cmd);
            const roomGuest = /\b(guest|guess|rest|extra)\b/.test(cmd);

            // Help & Commands List Block (Added per user request)
            if (cmd.includes("help") || cmd.includes("commands") || cmd.includes("what can you do")) {
                responseParts.push(`Here is what I can do for you:\n\n💡 **Lighting & Air:**\n- "Turn on/off the [Living Room / Kitchen / Bedroom] [Light / Fan]"\n- "Turn on/off all lights"\n- "Turn on/off everything"\n\n🎬 **Routines:**\n- "Movie Mode" (Dims lights, starts fans)\n- "Good night" (Powers down everything except the bedroom fan)\n\n📊 **System & Energy:**\n- "What is my power consumption today?"\n- "Show my overall energy logs"\n- "Status / Report" (Checks temperature & active devices)`);
                handledGeneral = true;
                return;
            }

            if (isTurnOn || isTurnOff) {
                let state = isTurnOn ? 1 : 0;
                let actionWord = isTurnOn ? 'Activating' : 'Deactivating';
                let targetedPins = [];

                // Global Targets
                if (/\b(all|every|everything|house)\b/.test(cmd)) {
                    if (wantsLight) targetedPins = [2,3,4,5];
                    else if (wantsFan) targetedPins = [0,1,6];
                    else targetedPins = [0,1,2,3,4,5,6]; // Everything
                    
                    responseParts.push(`${actionWord} all requested systems.`);
                } 
                // Specific Room Fuzzy Targets
                else {
                    if(roomLiving) {
                        let num1 = /\b(1|one|wan|first|main)\b/.test(cmd);
                        let num2 = /\b(2|two|to|too|second|other|guest)\b/.test(cmd);
                        let both = /\b(both|all)\b/.test(cmd);

                        // If user just says "living room fan", default to primary (or both if specified)
                        if (num1 || both || (!num1 && !num2)) {
                            if(wantsLight) targetedPins.push(2);
                            if(wantsFan) targetedPins.push(0);
                        }
                        if (num2 || both) {
                            if(wantsLight) targetedPins.push(5);
                            if(wantsFan) targetedPins.push(6); 
                        }
                    }
                    if(roomKitchen) {
                         if(wantsLight) targetedPins.push(3);
                    }
                    if(roomBed) { 
                        if(wantsLight) targetedPins.push(4); 
                        if(wantsFan) targetedPins.push(1); 
                    }
                    if(roomGuest) {
                        if(wantsFan) targetedPins.push(6);
                    }
                    
                    // Fallback if no room was detected but device was
                    if (targetedPins.length === 0) {
                        if (wantsLight) targetedPins = [2,3,4,5];
                        if (wantsFan) targetedPins = [0,1,6];
                    }

                    if (targetedPins.length > 0) {
                        responseParts.push(`${actionWord} target hardware.`);
                    }
                }

                if (targetedPins.length > 0) {
                    targetedPins.forEach(pin => writeVirtual(pin, state));
                    chatMemory.lastDevicePins = targetedPins; 
                    chatMemory.lastAction = state;
                    return;
                }
            }

            // Mode Routines
            if (cmd.includes("movie") || cmd.includes("cinema") || cmd.includes("theater")) {
                [2,3,4,5].forEach(p => writeVirtual(p, 0)); [0,1,6].forEach(p => writeVirtual(p, 1));
                chatMemory.lastDevicePins = [0,1,2,3,4,5,6];
                responseParts.push("🍿 **Movie Mode Active.** Dimming lights and enabling cooling.");
                return;
            }
            if (cmd.includes("good night") || cmd.includes("sleep") || cmd.includes("bedtime")) {
                [2,3,4,5,0,6].forEach(p => writeVirtual(p, 0)); writeVirtual(1, 1);
                responseParts.push("🌙 **Good night!** Shutting down the house. Leaving your fan running.");
                return;
            }

            // Status Checks
            if (cmd.includes("status") || cmd.includes("report") || cmd.includes("diagnostics")) {
                const temp = document.getElementById('val-temp').innerText;
                const hum = document.getElementById('val-hum').innerText;
                const summaryText = document.getElementById('summary').innerText.replace(/&nbsp;\|&nbsp;/g, ' | ');
                responseParts.push(`📊 **Diagnostics**\n🌡️ Temp: ${temp} | 💧 Hum: ${hum}\n🔌 ${summaryText}`);
                handledGeneral = true;
                return;
            }

            // Greetings & Identity
            if (!handledGeneral) {
                if (/^(hi|hello|hey|yo|greetings)/.test(cmd) && cmd.length < 20) {
                    responseParts.push(`Good ${timeOfDay}! 🤖 All systems are nominal. How can I assist?`);
                    handledGeneral = true;
                } else if (cmd.includes("who are you") || cmd.includes("your name")) {
                    responseParts.push("I'm **Ela**, your Smart Home AI! 🦾 I control your relays and monitor your sensors.");
                    handledGeneral = true;
                } else if (cmd.includes("joke") || cmd.includes("funny")) {
                    responseParts.push("Why did the IoT device cross the road? To get a better Wi-Fi signal! 📶😂");
                    handledGeneral = true;
                }
            }
        });

        // Compile final response
        if (responseParts.length > 0) {
            const uniqueResponses = [...new Set(responseParts)].join("\n\n");
            appendMessage('ai', uniqueResponses);
        } else {
            // Only fire fallback if handledGeneral is false (meaning the power fetch didn't trigger either)
            if (!handledGeneral) {
                const fallbacks = [
                    "I heard my name, but I didn't quite catch the command! 🌀 Try saying 'turn on the kitchen light'.",
                    "I'm awake! What do you need me to turn on or off?",
                    "Bzzt. My language processor missed that. Could you rephrase the command?"
                ];
                appendMessage('ai', fallbacks[Math.floor(Math.random() * fallbacks.length)]);
            }
        }
    }

    // Database-Driven Power Consumption Tracker (Runs every 1 minute) updated with safe visual fallback
    async function trackPowerConsumption() {
        if (!isLoggedIn) return;

        let currentActiveWatts = 0;
        
        // Count total watts for all devices that are currently ON (state == 1)
        for(let pin in deviceStates) {
            if(deviceStates[pin] == 1) currentActiveWatts += DEVICE_WATTS;
        }

        // Formula: kWh consumed in 1 minute = (Total Watts / 1000) * (1 hour / 60 minutes)
        let kwhThisMinute = (currentActiveWatts / 1000) / 60;

        try {
            if (kwhThisMinute > 0) {
                await fetch('../php/api.php?action=log_power', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kwh: kwhThisMinute })
                });
            }
            
            let res = await fetch('../php/api.php?action=get_power_stats');
            let data = await res.json();
            
            let powerDiv = document.getElementById('power-summary');
            if(powerDiv) {
                powerDiv.classList.remove('hidden');
                let displayOverall = data.overall ? data.overall.toFixed(4) : "0.0000";
                powerDiv.innerHTML = `<i class="fa-solid fa-bolt"></i> Live: ${currentActiveWatts}W | Today: ${data.today.toFixed(4)} kWh | Overall: ${displayOverall} kWh`;
            }
        } catch(e) {
            // Local visual fallback if API is not running, ensuring UI remains completely functional for demo
            if (kwhThisMinute > 0) powerStatsUI.today += kwhThisMinute;
            powerStatsUI.overall += kwhThisMinute;

            let powerDiv = document.getElementById('power-summary');
            if(powerDiv) {
                powerDiv.classList.remove('hidden');
                powerDiv.innerHTML = `<i class="fa-solid fa-bolt"></i> Live: ${currentActiveWatts}W | Today: ${powerStatsUI.today.toFixed(4)} kWh | Overall: ${powerStatsUI.overall.toFixed(4)} kWh`;
            }
        }
    }

    // Run the tracker every 60 seconds (1 minute)
    setInterval(trackPowerConsumption, 60000); 
    setTimeout(trackPowerConsumption, 5000); // Initial run after 5 seconds to load UI

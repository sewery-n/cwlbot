chrome.runtime.sendMessage({ action: 'initWebSocket' });
function setFieldValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        if (element.type === "checkbox") {
            element.checked = value;
        } else {
            element.value = value;
        }
    } else {
        console.warn(`Element ${elementId} nie został znaleziony. `);
    }
}

function setTeleportSettings(teleportSettings) {
    for (let key in teleportSettings) {
        const elementId = `${key}-mode`;
        setFieldValue(elementId, teleportSettings[key]);
    }
}

async function updateFormWithSettings(settings) {
    setFieldValue('cwlbot-minlvl', settings.exp_settings.minLevel);
    setFieldValue('cwlbot-maxlvl', settings.exp_settings.maxLevel);
    setFieldValue('cwlbot-expmaps', settings.exp_settings.maps);
    setFieldValue('exp-mode', settings.exp_settings.expMode);
    setFieldValue('cwlbot-tpmap', settings.exp_settings.tpMap);
    setFieldValue('autosetup-mode', settings.exp_settings.autoSetupMode);

    setTeleportSettings(settings.teleport_settings);

    setFieldValue('cwlbot-merchant-sell-mode', settings.selling_settings.selling_mode);
    setFieldValue('cwlbot-merchant-buy-mode', settings.selling_settings.buying_mode);
    setFieldValue('cwlbot-merchant-seller-id', settings.selling_settings.seller_id);
    setFieldValue('cwlbot-merchant-seller-dialogs', settings.selling_settings.seller_dialogs);
    setFieldValue('cwlbot-merchant-seller-map-id', settings.selling_settings.seller_idMap);
    setFieldValue('cwlbot-merchant-seller-teleport-id', settings.selling_settings.seller_tpMap);
    setFieldValue('cwlbot-merchant-buyer-id', settings.selling_settings.buyer_id);
    setFieldValue('cwlbot-merchant-buyer-dialogs', settings.selling_settings.buyer_dialogs);
    setFieldValue('cwlbot-merchant-buyer-map-id', settings.selling_settings.buyer_idMap);
    setFieldValue('cwlbot-merchant-buyer-teleport-id', settings.selling_settings.buyer_tpMap);

    setFieldValue('cwlbot-elite-mode', settings.elite_settings.eliteMode);
    setFieldValue('cwlbot-eliteid', settings.elite_settings.eliteMap);
    setFieldValue('cwlbot-elitename', settings.elite_settings.eliteName);
    setFieldValue('cwlbot-elitecoords', settings.elite_settings.coords);

}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'updateSettings') {
        console.log('Otrzymane ustawienia:', message.settings);
        const settings = message.settings;
        await updateFormWithSettings(settings);
    }
});

chrome.runtime.sendMessage({ action: 'getSettings' });

document.querySelectorAll('.tablist button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tablist button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const tabId = button.id.replace('tab-', '');
        document.querySelectorAll('.panels > div').forEach(panel => {
            if (panel.id === 'panel-discord') {

            }
            else if (panel.id === 'panel-' + tabId) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
    });
});


const app = document.getElementById('app');


const loader = document.createElement('div');
loader.className = 'loader';
const loaderText = document.createElement('div');
loaderText.className = 'loader-text';
loaderText.textContent = 'CWLBOT';
const loaderSpinner = document.createElement('div');
loaderSpinner.className = 'loader-spinner';
loader.appendChild(loaderText);
loader.appendChild(loaderSpinner);
app.appendChild(loader);

const heading = document.createElement('h1');
heading.className = 'heading underline';
heading.textContent = 'CWLBOT';
app.appendChild(heading);

const smallText = document.createElement('p');
smallText.className = 'small-text';
smallText.textContent = 'Ustawienia';
app.appendChild(smallText);

const inner = document.createElement('div');
inner.className = 'inner';
app.appendChild(inner);

const tablist = document.createElement('div');
tablist.className = 'tablist';
const tabs = ['EXP', 'E2', 'MERCHANTS', 'QUESTS', 'HEROES', 'OTHERS'];
tabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.textContent = tab;
    button.id = `tab-${tab.toLowerCase().replace(/ /g, '-')}`;
    if (index === 0) button.classList.add('active');
    tablist.appendChild(button);
});
inner.appendChild(tablist);

const panels = document.createElement('div');
panels.className = 'panels';
inner.appendChild(panels);

document.querySelectorAll('.tablist button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tablist button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const tabId = button.id.replace('tab-', '');
        document.querySelectorAll('.panels > div').forEach(panel => {
            if (panel.id === 'panel-' + tabId) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
    });
});

const panelsData = [
    { id: 'exp', content: createExpPanel() },
    { id: 'e2', content: createE2Panel() },
    { id: 'quests', content: createQuestsPanel() },
    { id: 'merchants', content: createMerchantsPanel() },
    { id: 'others', content: createOthersPanel() },
];
panelsData.forEach(panel => {
    const panelDiv = document.createElement('div');
    panelDiv.id = `panel-${panel.id}`;
    panelDiv.style.display = panel.id === 'exp' ? 'block' : 'none';
    panelDiv.innerHTML = panel.content;
    panels.appendChild(panelDiv);
});

function createExpPanel() {
    return `
                <div class="input-group">
                    <div class="input-item">
                        STAN:<br>
                        <label class="switch">
                            <input type="checkbox" id="exp-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        MIN LVL:<br>
                        <input type="text" id="cwlbot-minlvl" class="input-text" placeholder="1">
                    </div>
                    <div class="input-item">
                        MAX LVL:<br>
                        <input type="text" id="cwlbot-maxlvl" class="input-text" placeholder="300">
                    </div>
                    <div class="input-item">
                        TP NA MAPE:<br>
                        <input type="text" id="cwlbot-tpmap" class="input-text" placeholder="ID MAPY">
                    </div>
                    <div class="input-item">
                        AUTO SETUP:<br>
                        <label class="switch">
                            <input type="checkbox" id="autosetup-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <label class="textarea-maps">
                    <b>Podaj ID map, po których ma chodzić bot:</b>
                    <textarea id="cwlbot-expmaps">Podane mapy rozdziel przecinkiem</textarea>
                </label>
                <select id="cwlbot-exp-setups">
                    <option disabled selected>WYBIERZ SETUP EXP</option>
                    <option disabled>ZALECANE SETUPY: </option>
                    <option>1 SETUP</option>
                    <option>2 SETUP</option>
                    <option>3 SETUP</option>
                    <option>4 SETUP</option>
                    <option>5 SETUP</option>
                    <option disabled>POZOSTAŁE SETUPY: </option>
                    <option>POZOSTAŁE1</option>
                    <option>POZOSTAŁE1</option>
                    <option>POZOSTAŁE1</option>
                    <option>POZOSTAŁE1</option>
                </select>
            `;
}



function createE2Panel() {
    return `
                <div class="input-group">
                    <div class="input-item">
                        STAN:<br>
                        <label class="switch">
                            <input type="checkbox" id="cwlbot-elite-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        ID MAPY Z EII:<br>
                        <input type="text" id="cwlbot-eliteid" class="input-text" placeholder="ID MAPY">
                    </div>
                    <div class="input-item">
                        NAZWA ELITY II:<br>
                        <input type="text" id="cwlbot-elitename" class="input-text" placeholder="np. Kotołak Tropiciel">
                    </div>
                </div>
                <label class="textarea-maps">
                    <b>Podaj kordy na które ma wracać bot:</b>
                    <textarea id="cwlbot-elitecoords">X,Y;X,Y</textarea>
                </label>
                <select id="cwlbot-elite-setups">
                    <option disabled selected>WYBIERZ SETUP E2</option>
                </select>
            `;
}

function createMerchantsPanel() {
    return `
    <h3>USTAWIENIA SPRZEDAWANIA:</h3>
                <div class="input-group">
                    <div class="input-item">
                        SPRZEDAWAJ:<br>
                        <label class="switch">
                            <input type="checkbox" id="cwlbot-merchant-sell-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        ID NPC:<br>
                        <input type="text" id="cwlbot-merchant-seller-id" class="input-text" placeholder="np. 33">
                    </div>
                    <div class="input-item">
                        TELEPORT:<br>
                        <input type="text" id="cwlbot-merchant-seller-teleport-id" class="input-text" placeholder="np. 1">
                    </div>
                    <div class="input-item">
                        MAPA:<br>
                        <input type="text" id="cwlbot-merchant-seller-map-id" class="input-text" placeholder="np. 1">
                    </div>
                    <div class="input-item">
                        DIALOGI:<br>
                        <input type="text" id="cwlbot-merchant-seller-dialogs" class="input-text" placeholder="1;2;3">
                    </div>
                </div>
                <hr>
                <h3>USTAWIENIA ZAKUPÓW:</h3>
                <div class="input-group">
                    <div class="input-item">
                        KUPUJ POTKI:<br>
                        <label class="switch">
                            <input type="checkbox" id="cwlbot-merchant-buy-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        ID NPC:<br>
                        <input type="text" id="cwlbot-merchant-buyer-id" class="input-text" placeholder="np. 33">
                    </div>
                    <div class="input-item">
                        TELEPORT:<br>
                        <input type="text" id="cwlbot-merchant-buyer-teleport-id" class="input-text" placeholder="np. 1">
                    </div>
                    <div class="input-item">
                        MAPA:<br>
                        <input type="text" id="cwlbot-merchant-buyer-map-id" class="input-text" placeholder="np. 1">
                    </div>
                    <div class="input-item">
                        DIALOGI:<br>
                        <input type="text" id="cwlbot-merchant-buyer-dialogs" class="input-text" placeholder="1;2;3">
                    </div>
                </div>
                <hr>
                <div class="input-group">
                    <select id="cwlbot-merchant-setups" style="margin-top: 10px;">
                        <option disabled selected>WYBIERZ SETUP</option>
                    </select>
                </div>
            `;
}

function createQuestsPanel() {
    return `
        <div class="input-group">
            <div class="input-item">
                Włącznik:<br>
                <label class="switch">
                <input type="checkbox" id="quest-mode">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="input-item">
                Krok Questa:<br>
                <input type="text" class="input-text">
            </div>
            <div class="input-item">
                <button>WYCZYŚĆ PAMIĘĆ QUESTA</button>
            </div>
        </div>
        <select id="cwlbot-quests">
            <option disabled selected>WYBIERZ QUEST</option>
            <option value="wioska">WIOSKA STARTOWA [1-16]</option>
        </select>
    `
}

function createOthersPanel() {
    return `
                <h3>DOSTĘPNE TELEPORTY:</h3>
                <div class="input-group">
                    <div class="input-item">
                        Ithan:<br>
                        <label class="switch">
                            <input type="checkbox" id="1-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Torneg:<br>
                        <label class="switch">
                            <input type="checkbox" id="2-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Werbin:<br>
                        <label class="switch">
                            <input type="checkbox" id="9-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Eder:<br>
                        <label class="switch">
                            <input type="checkbox" id="33-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Karka-han:<br>
                        <label class="switch">
                            <input type="checkbox" id="35-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="input-group">
                    <div class="input-item">
                        Thuzal:<br>
                        <label class="switch">
                            <input type="checkbox" id="114-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Tuzmer:<br>
                        <label class="switch">
                            <input type="checkbox" id="589-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Nithal:<br>
                        <label class="switch">
                            <input type="checkbox" id="574-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Trupia:<br>
                        <label class="switch">
                            <input type="checkbox" id="1141-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        Lisciaste:<br>
                        <label class="switch">
                            <input type="checkbox" id="500-mode">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <hr>
                <h3>MISCELLANEOUS:</h3>
                <div class="input-group">
                    <div class="input-item">
                        AUTOHEAL:<br>
                        <label class="switch">
                            <input type="checkbox" id="cwlbot-others-autoheal">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        AUTO BŁOGO:<br>
                        <label class="switch">
                            <input type="checkbox" id="cwlbot-others-autobless">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="input-item">
                        NAZWA BŁOGA:<br>
                        <input type="text" id="cwlbot-others-autobless-name" style="width: auto;" class="input-text" placeholder="np. Aura szczęśliwca I">
                    </div>
                </div>
            `;
}

function sendSettings() {
    const settings = {
        settings: {
            charID: '',
            exp_settings: {
                minLevel: document.getElementById('cwlbot-minlvl')?.value,
                maxLevel: document.getElementById('cwlbot-maxlvl')?.value,
                maps: document.getElementById('cwlbot-expmaps')?.value,
                expMode: document.getElementById('exp-mode')?.checked,
                tpMap: document.getElementById('cwlbot-tpmap')?.value,
                autoSetupMode: document.getElementById('autosetup-mode')?.checked
            },
            teleport_settings: {},
            selling_settings: {
                selling_mode: document.getElementById('cwlbot-merchant-sell-mode')?.checked,
                buying_mode: document.getElementById('cwlbot-merchant-buy-mode')?.checked,
                seller_id: document.getElementById('cwlbot-merchant-seller-id')?.value,
                seller_dialogs: document.getElementById('cwlbot-merchant-seller-dialogs')?.value.split(';'),
                seller_idMap: document.getElementById('cwlbot-merchant-seller-map-id')?.value,
                seller_tpMap: document.getElementById('cwlbot-merchant-seller-teleport-id')?.value,
                buyer_id: document.getElementById('cwlbot-merchant-buyer-id')?.value,
                buyer_dialogs: document.getElementById('cwlbot-merchant-buyer-dialogs')?.value.split(';'),
                buyer_idMap: document.getElementById('cwlbot-merchant-buyer-map-id')?.value,
                buyer_tpMap: document.getElementById('cwlbot-merchant-buyer-teleport-id')?.value,
            },
            elite_settings: {
                eliteMode: document.getElementById('cwlbot-elite-mode')?.checked,
                eliteMap: document.getElementById('cwlbot-eliteid')?.value,
                eliteName: document.getElementById('cwlbot-elitename')?.value,
                coords: document.getElementById('cwlbot-elitecoords')?.value
            },
            quests_settings: {
                quest_mode: document.getElementById('quest-mode').checked,
                selected: document.getElementById('cwlbot-quests').value
            }
        }
    };

    document.querySelectorAll('[id$="-mode"]').forEach(element => {
        settings.settings.teleport_settings[element.id.replace('-mode', '')] = element.type === "checkbox" ? element.checked : element.value;
    });
    console.log('sended');
    chrome.runtime.sendMessage({ action: 'sendSettings', settings });
}

// Nasłuchiwanie na zmiany w formularzu
function setupListeners() {
    document.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('change', sendSettings);
    });
}
async function fetchSetups() {
    try {
        const response = await fetch('http://srv27.mikr.us:40077/setups');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error fetching setups:', error);
        return null;
    }
}

// Funkcja do uzupełniania selectów
function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option disabled selected>WYBIERZ SETUP</option>';
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        select.appendChild(optionElement);
    });
    if (selectId == "cwlbot-exp-setups") {
        select.addEventListener('change', () => {
            const selectedOption = select.value;
            const [min, max, maps] = selectedOption.split(':');

            document.getElementById('cwlbot-minlvl').value = min;
            document.getElementById('cwlbot-maxlvl').value = max;
            document.getElementById('cwlbot-expmaps').value = maps;

        });
    } else if (selectId == "cwlbot-elite-setups") {
        select.addEventListener('change', () => {
            const selectedOption = select.value;
            const [map, nick, coords] = selectedOption.split(':');

            document.getElementById('cwlbot-eliteid').value = map;
            document.getElementById('cwlbot-elitename').value = nick;
            document.getElementById('cwlbot-elitecoords').value = coords;

        });
    }
}

// Funkcja do ładowania setupów
async function loadSetups() {
    const data = await fetchSetups();
    if (!data) return;

    // Uzupełnij select EXP
    const expOptions = Object.keys(data.setups.exp).map(key => {
        const setup = data.setups.exp[key];
        return {
            value: `${setup.min}:${setup.max}:${setup.maps.join(',')}`, // min;max;maps jako string
            label: key
        };
    });
    console.log(expOptions)
    populateSelect('cwlbot-exp-setups', expOptions);

    // Uzupełnij select ELITE
    const eliteOptions = Object.keys(data.setups.elite).map(key => {
        const setup = data.setups.elite[key];
        return {
            value: `${setup.map}:${setup.nick}:${setup.coords.join(';')}`,
            label: key
        };
    });
    populateSelect('cwlbot-elite-setups', eliteOptions);
}

// Załaduj setupy po załadowaniu strony
window.addEventListener('load', loadSetups);
document.addEventListener('DOMContentLoaded', setupListeners);

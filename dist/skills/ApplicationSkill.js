"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationSkill = void 0;
class ApplicationSkill {
    constructor() {
        this.name = 'ApplicationSkill';
        this.supported_intents = ['open_application', 'close_application'];
        this.applicationMap = {
            'chrome': {
                windows: ['chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
                macos: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
                linux: ['google-chrome', 'chromium-browser']
            },
            'firefox': {
                windows: ['firefox.exe', 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'],
                macos: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
                linux: ['firefox']
            },
            'word': {
                windows: ['WINWORD.EXE', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE'],
                macos: ['/Applications/Microsoft Word.app/Contents/MacOS/Microsoft Word'],
                linux: ['libreoffice', 'lowriter']
            },
            'excel': {
                windows: ['EXCEL.EXE', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE'],
                macos: ['/Applications/Microsoft Excel.app/Contents/MacOS/Microsoft Excel'],
                linux: ['libreoffice', 'localc']
            },
            'notepad': {
                windows: ['notepad.exe'],
                macos: ['/Applications/TextEdit.app/Contents/MacOS/TextEdit'],
                linux: ['gedit', 'kate', 'nano']
            },
            'calculator': {
                windows: ['calc.exe'],
                macos: ['/Applications/Calculator.app/Contents/MacOS/Calculator'],
                linux: ['gnome-calculator', 'kcalc']
            },
            'spotify': {
                windows: ['Spotify.exe', 'C:\\Users\\%USERNAME%\\AppData\\Roaming\\Spotify\\Spotify.exe'],
                macos: ['/Applications/Spotify.app/Contents/MacOS/Spotify'],
                linux: ['spotify']
            },
            'discord': {
                windows: ['Discord.exe', 'C:\\Users\\%USERNAME%\\AppData\\Local\\Discord\\app-*\\Discord.exe'],
                macos: ['/Applications/Discord.app/Contents/MacOS/Discord'],
                linux: ['discord']
            },
            'telegram': {
                windows: ['Telegram.exe'],
                macos: ['/Applications/Telegram.app/Contents/MacOS/Telegram'],
                linux: ['telegram-desktop']
            }
        };
    }
    validate(intent, context) {
        if (!intent.entities.application) {
            return false;
        }
        const appName = intent.entities.application.toLowerCase();
        return this.applicationMap.hasOwnProperty(appName);
    }
    async execute(intent, _context) {
        const appName = intent.entities.application.toLowerCase();
        if (intent.name === 'open_application') {
            return {
                action: 'open_application',
                target: appName,
                risk_level: 'low',
                requires_confirmation: false
            };
        }
        if (intent.name === 'close_application') {
            return {
                action: 'close_application',
                target: appName,
                risk_level: 'low',
                requires_confirmation: false
            };
        }
        return { action: 'unknown', risk_level: 'low', requires_confirmation: false };
    }
}
exports.ApplicationSkill = ApplicationSkill;
//# sourceMappingURL=ApplicationSkill.js.map
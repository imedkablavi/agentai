"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandExecutor = void 0;
const util_1 = require("util");
const child_process_1 = require("child_process");
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const date_fns_1 = require("date-fns");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class CommandExecutor {
    constructor(memory, context) {
        this.memory = memory;
        this.context = context;
    }
    async execute(command, intentLanguage) {
        try {
            if (command.requires_confirmation && !this.context.getContext().awaiting_confirmation) {
                this.context.setState('AWAITING_CONFIRMATION');
                this.context.updateContext({ awaiting_confirmation: true, awaiting_followup: true });
                return {
                    success: false,
                    error_detail: this.error('permission', true, this.confirmationMessage(intentLanguage), true),
                    requires_followup: true,
                    suggested_actions: [this.confirmKeyword(intentLanguage)]
                };
            }
            this.context.setState('EXECUTING');
            switch (command.action) {
                case 'open_application':
                    return await this.execOpenApp(command);
                case 'close_application':
                    return await this.execCloseApp(command);
                case 'web_search':
                    return await this.execWebSearch(command);
                case 'youtube_search':
                    return await this.execYouTubeSearch(command);
                case 'system_shutdown':
                case 'system_restart':
                case 'system_lock':
                case 'system_sleep':
                    return await this.execSystem(command);
                case 'select_item':
                    return await this.execSelection(command);
                case 'store_memory':
                    return await this.execStoreMemory(command);
                default:
                    return { success: false, error_detail: this.error('unknown', true, this.fallbackError(intentLanguage), true) };
            }
        }
        catch (e) {
            this.context.setState('ERROR');
            return { success: false, error_detail: this.error('unknown', true, e?.message || 'Error', true) };
        }
        finally {
            this.context.updateContext({ awaiting_confirmation: false });
            this.context.setState('IDLE');
        }
    }
    async execOpenApp(command) {
        const app = command.target || command.params?.application;
        if (!app)
            return { success: false, error_detail: this.error('context', true, 'Application not specified', false) };
        try {
            const platform = process.platform;
            if (platform === 'win32')
                await execAsync(`start "" "${app}"`);
            else if (platform === 'darwin')
                await execAsync(`open "${app}"`);
            else
                await execAsync(app);
            return { success: true, data: { application: app, action: 'opened' }, suggested_actions: [`Close ${app}`] };
        }
        catch {
            return { success: false, error_detail: this.error('permission', true, 'Failed to open application', true) };
        }
    }
    async execCloseApp(command) {
        const app = command.target || command.params?.application;
        const map = {
            chrome: 'chrome.exe', firefox: 'firefox.exe', word: 'WINWORD.EXE', excel: 'EXCEL.EXE',
            notepad: 'notepad.exe', calculator: 'calc.exe', spotify: 'Spotify.exe', discord: 'Discord.exe', telegram: 'Telegram.exe'
        };
        const proc = map[(app || '').toLowerCase()] || app;
        if (!proc)
            return { success: false, error_detail: this.error('context', true, 'Application not specified', false) };
        try {
            await execAsync(`taskkill /F /IM "${proc}"`);
            return { success: true, data: { application: app, action: 'closed' } };
        }
        catch {
            return { success: false, error_detail: this.error('permission', true, 'Failed to close application', true) };
        }
    }
    async execWebSearch(command) {
        const query = command.params?.query;
        if (!query)
            return { success: false, error_detail: this.error('context', true, 'Missing query', false) };
        const results = await this.searchMulti(query);
        const items = results.slice(0, 5).map((r, i) => ({ id: String(i + 1), label: r.title, data: r }));
        this.context.setSelectionContext({ type: 'search_results', items, expires_at: (0, date_fns_1.formatISO)(new Date(Date.now() + 5 * 60 * 1000)) });
        this.context.setState('AWAITING_SELECTION');
        return { success: true, data: { query, results }, requires_followup: true, suggested_actions: items.map(i => `اختر ${i.id}: ${i.label}`) };
    }
    async execYouTubeSearch(command) {
        const query = command.params?.query;
        if (!query)
            return { success: false, error_detail: this.error('context', true, 'Missing query', false) };
        const videos = await this.searchYouTube(query);
        const items = videos.slice(0, 5).map((v, i) => ({ id: String(i + 1), label: v.title, data: v }));
        this.context.setSelectionContext({ type: 'videos', items, expires_at: (0, date_fns_1.formatISO)(new Date(Date.now() + 5 * 60 * 1000)) });
        this.context.setState('AWAITING_SELECTION');
        return { success: true, data: { query, videos }, requires_followup: true, suggested_actions: items.map(i => `اختر ${i.id}: ${i.label}`) };
    }
    async execSystem(command) {
        const map = {
            system_shutdown: 'shutdown /s /t 0',
            system_restart: 'shutdown /r /t 0',
            system_lock: 'rundll32.exe user32.dll,LockWorkStation',
            system_sleep: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'
        };
        const cmd = map[command.action];
        try {
            await execAsync(cmd);
            return { success: true, data: { command: command.action } };
        }
        catch {
            return { success: false, error_detail: this.error('permission', true, 'System command failed', true) };
        }
    }
    async execSelection(command) {
        const index = Number(command.params?.index || 0);
        const ctx = this.context.getContext();
        const sc = ctx.selection_context;
        if (!sc || !sc.items || sc.items.length === 0) {
            return { success: false, error_detail: this.error('context', true, 'No active selection context', false) };
        }
        if (index < 1 || index > sc.items.length) {
            return { success: false, error_detail: this.error('context', true, 'Invalid selection number', false) };
        }
        const item = sc.items[index - 1].data;
        const url = item.url;
        if (!url)
            return { success: false, error_detail: this.error('context', true, 'Item has no URL', false) };
        try {
            const platform = process.platform;
            if (platform === 'win32')
                await execAsync(`start "" "${url}"`);
            else if (platform === 'darwin')
                await execAsync(`open "${url}"`);
            else
                await execAsync(`xdg-open "${url}"`);
            this.context.setSelectionContext(null);
            this.context.setState('IDLE');
            return { success: true, data: { action: 'opened', url, title: item.title } };
        }
        catch {
            return { success: false, error_detail: this.error('network', true, 'Failed to open URL', true) };
        }
    }
    async execStoreMemory(command) {
        const content = command.params?.content;
        if (!content)
            return { success: false, error_detail: this.error('context', true, 'No memory content', false) };
        // Store only via MemoryManager rules
        this.memory.addLongTermMemory({
            type: 'pattern',
            description: content,
            frequency: 1,
            last_occurrence: (0, date_fns_1.formatISO)(new Date()),
            metadata: {}
        });
        return { success: true, data: { action: 'memory_stored', content } };
    }
    error(type, recoverable, user_message, retry_suggested) {
        return { type, recoverable, user_message, retry_suggested };
    }
    confirmationMessage(lang) {
        return lang === 'ar' ? 'هل تريد التأكيد؟' : lang === 'tr' ? 'Onaylıyor musun?' : 'Do you confirm?';
    }
    confirmKeyword(lang) {
        return lang === 'ar' ? 'نعم' : lang === 'tr' ? 'Evet' : 'Yes';
    }
    fallbackError(lang) {
        return lang === 'ar' ? 'حدث خطأ في التنفيذ.' : lang === 'tr' ? 'Yürütme sırasında hata oluştu.' : 'Execution error occurred.';
    }
    async searchMulti(query) {
        const results = [];
        try {
            const ddg = await this.ddg(query);
            const bing = await this.bing(query);
            results.push(...ddg, ...bing);
        }
        catch { }
        return results;
    }
    async ddg(query) {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await axios_1.default.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        const $ = (0, cheerio_1.load)(res.data);
        const out = [];
        $('.result').each((_, el) => {
            const a = $(el).find('.result__title a');
            const s = $(el).find('.result__snippet');
            const title = a.text().trim();
            const href = a.attr('href') || '';
            const snippet = s.text().trim();
            if (title && href)
                out.push({ title, url: href, snippet, source: 'DuckDuckGo' });
        });
        return out.slice(0, 5);
    }
    async bing(query) {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        const res = await axios_1.default.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        const $ = (0, cheerio_1.load)(res.data);
        const out = [];
        $('#b_results li.b_algo').each((_, el) => {
            const a = $(el).find('h2 a');
            const cap = $(el).find('.b_caption p');
            const title = a.text().trim();
            const href = a.attr('href') || '';
            const snippet = cap.text().trim();
            if (title && href)
                out.push({ title, url: href, snippet, source: 'Bing' });
        });
        return out.slice(0, 5);
    }
    async searchYouTube(query) {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const res = await axios_1.default.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        const $ = (0, cheerio_1.load)(res.data);
        const out = [];
        $('a#video-title').each((i, el) => {
            if (i >= 5)
                return false;
            const title = $(el).text().trim();
            const href = $(el).attr('href') || '';
            if (title && href)
                out.push({ title, url: `https://www.youtube.com${href}` });
            return undefined;
        });
        return out;
    }
}
exports.CommandExecutor = CommandExecutor;
//# sourceMappingURL=CommandExecutor.js.map
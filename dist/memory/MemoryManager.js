"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = void 0;
const uuid_1 = require("uuid");
const date_fns_1 = require("date-fns");
class MemoryManager {
    constructor() {
        this.shortTermMemory = null;
        this.longTermMemories = [];
        this.memoryThresholds = {
            repetition_count: 3,
            time_window_days: 7
        };
        this.preferences = {
            language: 'ar',
            browser: 'chrome',
            voice_mode: true,
            auto_execute_threshold: 0.85,
            confirmation_required: true
        };
        this.loadMemories();
    }
    getShortTermMemory() {
        return this.shortTermMemory;
    }
    updateShortTermMemory(data) {
        this.shortTermMemory = {
            ...this.shortTermMemory,
            ...data,
            timestamp: (0, date_fns_1.formatISO)(new Date())
        };
        this.saveShortTermMemory();
    }
    getLongTermMemories() {
        return this.longTermMemories;
    }
    addLongTermMemory(memory) {
        const existingIndex = this.longTermMemories.findIndex(m => m.description === memory.description && m.type === memory.type);
        if (existingIndex >= 0) {
            this.longTermMemories[existingIndex] = {
                ...this.longTermMemories[existingIndex],
                frequency: this.longTermMemories[existingIndex].frequency + 1,
                last_occurrence: (0, date_fns_1.formatISO)(new Date()),
                metadata: { ...this.longTermMemories[existingIndex].metadata, ...memory.metadata }
            };
        }
        else {
            this.longTermMemories.push({
                ...memory,
                id: (0, uuid_1.v4)(),
                frequency: 1,
                last_occurrence: (0, date_fns_1.formatISO)(new Date())
            });
        }
        this.saveLongTermMemories();
    }
    updateLongTermMemory(type, description) {
        const memory = this.longTermMemories.find(m => m.type === type && m.description === description);
        if (memory) {
            memory.frequency += 1;
            memory.last_occurrence = (0, date_fns_1.formatISO)(new Date());
            this.saveLongTermMemories();
        }
    }
    pruneLongTermMemories(cutoffDays = 30) {
        const now = Date.now();
        this.longTermMemories = this.longTermMemories.filter(m => {
            const days = (now - new Date(m.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
            return days <= cutoffDays;
        });
        this.saveLongTermMemories();
    }
    getPreferences() {
        return this.preferences;
    }
    updatePreferences(prefs) {
        this.preferences = { ...this.preferences, ...prefs };
        this.savePreferences();
    }
    shouldStoreMemory(intent, context) {
        const shortTerm = this.getShortTermMemory();
        if (!shortTerm)
            return false;
        const recentSimilarIntents = this.longTermMemories.filter(memory => {
            const daysSinceLastOccurrence = (new Date().getTime() - new Date(memory.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
            return memory.description.includes(intent.name) && daysSinceLastOccurrence <= this.memoryThresholds.time_window_days;
        });
        const isRepetitive = recentSimilarIntents.length + 1 >= this.memoryThresholds.repetition_count;
        const hasExplicitRememberCommand = intent.raw_text.toLowerCase().includes('تذكر') ||
            intent.raw_text.toLowerCase().includes('ذاكر') ||
            intent.raw_text.toLowerCase().includes('من الآن فصاعدًا') ||
            intent.raw_text.toLowerCase().includes('احفظ');
        return isRepetitive || hasExplicitRememberCommand;
    }
    loadMemories() {
        try {
            const fs = require('fs');
            const path = require('path');
            const memoryPath = path.join(__dirname, '../../data/memories');
            if (!fs.existsSync(memoryPath)) {
                fs.mkdirSync(memoryPath, { recursive: true });
            }
            const stmPath = path.join(memoryPath, 'short_term.json');
            const ltmPath = path.join(memoryPath, 'long_term.json');
            const prefsPath = path.join(memoryPath, 'preferences.json');
            if (fs.existsSync(stmPath)) {
                this.shortTermMemory = JSON.parse(fs.readFileSync(stmPath, 'utf8'));
            }
            if (fs.existsSync(ltmPath)) {
                this.longTermMemories = JSON.parse(fs.readFileSync(ltmPath, 'utf8'));
            }
            if (fs.existsSync(prefsPath)) {
                this.preferences = { ...this.preferences, ...JSON.parse(fs.readFileSync(prefsPath, 'utf8')) };
            }
        }
        catch (error) {
            console.warn('Failed to load memories:', error);
        }
    }
    saveShortTermMemory() {
        try {
            const fs = require('fs');
            const path = require('path');
            const stmPath = path.join(__dirname, '../../data/memories/short_term.json');
            if (this.shortTermMemory) {
                fs.writeFileSync(stmPath, JSON.stringify(this.shortTermMemory, null, 2));
            }
        }
        catch (error) {
            console.warn('Failed to save short-term memory:', error);
        }
    }
    saveLongTermMemories() {
        try {
            const fs = require('fs');
            const path = require('path');
            const ltmPath = path.join(__dirname, '../../data/memories/long_term.json');
            fs.writeFileSync(ltmPath, JSON.stringify(this.longTermMemories, null, 2));
        }
        catch (error) {
            console.warn('Failed to save long-term memories:', error);
        }
    }
    savePreferences() {
        try {
            const fs = require('fs');
            const path = require('path');
            const prefsPath = path.join(__dirname, '../../data/memories/preferences.json');
            fs.writeFileSync(prefsPath, JSON.stringify(this.preferences, null, 2));
        }
        catch (error) {
            console.warn('Failed to save preferences:', error);
        }
    }
    getMemoryInsights() {
        const habits = this.longTermMemories.filter(m => m.type === 'habit' && m.frequency >= 3);
        const recent_patterns = this.longTermMemories
            .filter(m => {
            const daysSinceLastOccurrence = (new Date().getTime() - new Date(m.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceLastOccurrence <= 7;
        })
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5);
        return {
            habits,
            recent_patterns,
            preferences: this.preferences
        };
    }
}
exports.MemoryManager = MemoryManager;
//# sourceMappingURL=MemoryManager.js.map
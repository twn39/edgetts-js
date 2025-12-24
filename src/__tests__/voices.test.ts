/**
 * Integration tests for VoicesManager
 * These tests make real API calls to the Edge TTS service
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { VoicesManager, listVoices } from '../voices';
import { Voice } from '../types';

describe('listVoices', () => {
    it('should fetch voices from the API', async () => {
        const voices = await listVoices();

        expect(Array.isArray(voices)).toBe(true);
        expect(voices.length).toBeGreaterThan(0);
    });

    it('should return voices with required properties', async () => {
        const voices = await listVoices();
        const voice = voices[0];

        expect(voice).toHaveProperty('Name');
        expect(voice).toHaveProperty('ShortName');
        expect(voice).toHaveProperty('Gender');
        expect(voice).toHaveProperty('Locale');
        expect(voice).toHaveProperty('SuggestedCodec');
        expect(voice).toHaveProperty('FriendlyName');
        expect(voice).toHaveProperty('Status');
        expect(voice).toHaveProperty('VoiceTag');
    });

    it('should include VoiceTag with ContentCategories and VoicePersonalities', async () => {
        const voices = await listVoices();
        const voice = voices[0];

        expect(voice.VoiceTag).toHaveProperty('ContentCategories');
        expect(voice.VoiceTag).toHaveProperty('VoicePersonalities');
        expect(Array.isArray(voice.VoiceTag.ContentCategories)).toBe(true);
        expect(Array.isArray(voice.VoiceTag.VoicePersonalities)).toBe(true);
    });

    it('should include common locales', async () => {
        const voices = await listVoices();
        const locales = voices.map(v => v.Locale);

        expect(locales).toContain('en-US');
        expect(locales).toContain('zh-CN');
    });
});

describe('VoicesManager', () => {
    let manager: VoicesManager;
    let voices: Voice[];

    beforeAll(async () => {
        voices = await listVoices();
        manager = await VoicesManager.create(voices);
    });

    describe('create', () => {
        it('should create manager with fetched voices', () => {
            expect(manager.getAllVoices().length).toBeGreaterThan(0);
        });

        it('should add Language property from Locale', () => {
            const allVoices = manager.getAllVoices();
            const enVoice = allVoices.find(v => v.Locale === 'en-US');
            expect(enVoice?.Language).toBe('en');

            const zhVoice = allVoices.find(v => v.Locale === 'zh-CN');
            expect(zhVoice?.Language).toBe('zh');
        });
    });

    describe('find', () => {
        it('should find voices by Gender', () => {
            const females = manager.find({ Gender: 'Female' });
            expect(females.length).toBeGreaterThan(0);
            expect(females.every(v => v.Gender === 'Female')).toBe(true);
        });

        it('should find voices by Locale', () => {
            const enUS = manager.find({ Locale: 'en-US' });
            expect(enUS.length).toBeGreaterThan(0);
            expect(enUS.every(v => v.Locale === 'en-US')).toBe(true);
        });

        it('should find voices by multiple criteria', () => {
            const enUSFemale = manager.find({ Locale: 'en-US', Gender: 'Female' });
            expect(enUSFemale.length).toBeGreaterThan(0);
            expect(enUSFemale.every(v => v.Locale === 'en-US' && v.Gender === 'Female')).toBe(true);
        });

        it('should return empty array when no matches', () => {
            const noMatch = manager.find({ Locale: 'xx-XX' });
            expect(noMatch.length).toBe(0);
        });

        it('should throw if called before create', () => {
            const uncreatedManager = new VoicesManager();
            expect(() => uncreatedManager.find({ Gender: 'Female' })).toThrow(
                'VoicesManager.find() called before VoicesManager.create()'
            );
        });
    });

    describe('findByLocale', () => {
        it('should find voices by locale', () => {
            const voices = manager.findByLocale('en-US');
            expect(voices.length).toBeGreaterThan(0);
            expect(voices.every(v => v.Locale === 'en-US')).toBe(true);
        });
    });

    describe('findByLanguage', () => {
        it('should find voices by language', () => {
            const voices = manager.findByLanguage('en');
            expect(voices.length).toBeGreaterThan(0);
            expect(voices.every(v => v.Language === 'en')).toBe(true);
        });
    });

    describe('findByGender', () => {
        it('should find voices by gender', () => {
            const males = manager.findByGender('Male');
            expect(males.length).toBeGreaterThan(0);
            expect(males.every(v => v.Gender === 'Male')).toBe(true);
        });
    });

    describe('getAllVoices', () => {
        it('should return all voices', () => {
            expect(manager.getAllVoices().length).toBe(voices.length);
        });

        it('should return a copy', () => {
            const allVoices = manager.getAllVoices();
            const originalLength = allVoices.length;
            allVoices.pop();
            expect(manager.getAllVoices().length).toBe(originalLength);
        });

        it('should throw if called before create', () => {
            const uncreatedManager = new VoicesManager();
            expect(() => uncreatedManager.getAllVoices()).toThrow(
                'VoicesManager.getAllVoices() called before VoicesManager.create()'
            );
        });
    });

    describe('getLocales', () => {
        it('should return unique locales sorted', () => {
            const locales = manager.getLocales();
            expect(locales.length).toBeGreaterThan(0);
            // Check that it's sorted
            const sorted = [...locales].sort();
            expect(locales).toEqual(sorted);
            // Check uniqueness
            expect(new Set(locales).size).toBe(locales.length);
        });

        it('should include common locales', () => {
            const locales = manager.getLocales();
            expect(locales).toContain('en-US');
            expect(locales).toContain('zh-CN');
        });

        it('should throw if called before create', () => {
            const uncreatedManager = new VoicesManager();
            expect(() => uncreatedManager.getLocales()).toThrow(
                'VoicesManager.getLocales() called before VoicesManager.create()'
            );
        });
    });

    describe('getLanguages', () => {
        it('should return unique languages sorted', () => {
            const languages = manager.getLanguages();
            expect(languages.length).toBeGreaterThan(0);
            // Check that it's sorted
            const sorted = [...languages].sort();
            expect(languages).toEqual(sorted);
            // Check uniqueness
            expect(new Set(languages).size).toBe(languages.length);
        });

        it('should include common languages', () => {
            const languages = manager.getLanguages();
            expect(languages).toContain('en');
            expect(languages).toContain('zh');
        });

        it('should throw if called before create', () => {
            const uncreatedManager = new VoicesManager();
            expect(() => uncreatedManager.getLanguages()).toThrow(
                'VoicesManager.getLanguages() called before VoicesManager.create()'
            );
        });
    });
});

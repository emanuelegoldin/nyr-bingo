import deDictionary from './dictionaries/de.json';
import enDictionary from './dictionaries/en.json';
import itDictionary from './dictionaries/it.json';
import { type Locale } from './locale';

const dictionaries = {
    en: enDictionary,
    de: deDictionary,
    it: itDictionary,
} as const;

export type Dictionary = (typeof enDictionary);

export const getDictionaryForLocale = (locale: Locale): Dictionary =>
    dictionaries[locale];

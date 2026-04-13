type SearchDatabaseLocale = "en" | "zh-CN";

const special:string = "09azAZ";
const code0 = special.charCodeAt(0);
const code9 = special.charCodeAt(1);
const codea = special.charCodeAt(2);
const codez = special.charCodeAt(3);
const codeA = special.charCodeAt(4);
const codeZ = special.charCodeAt(5);
const charCount = 26+10;
const charOffset = 128-charCount;

function getSearchDatabaseLocaleParam(): string {
    if (typeof localStorage !== "undefined") {
        const fromStorage = localStorage.getItem("gtnh.gameLocale");
        if (fromStorage && fromStorage.trim().length > 0) {
            return fromStorage;
        }
    }

    if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("gameLocale") ?? params.get("dbLocale");
        if (fromQuery && fromQuery.trim().length > 0) {
            return fromQuery;
        }
    }

    return "zh-CN";
}

function normalizeSearchDatabaseLocale(locale: string): SearchDatabaseLocale {
    return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

abstract class SearchQueryVariant {
    original:string;
    words:string[];
    indexBits:Int32Array;
    mod:string | null;

    constructor(text:string) {
        this.original = text;
        this.words = [];
        this.indexBits = new Int32Array(4);
        this.mod = null;
    }

    abstract Match(text: string | null): boolean;
}

class EnglishSearchQueryVariant extends SearchQueryVariant {
    constructor(text:string) {
        super(text);
        this.words = text.match(/[A-Za-z0-9@]+/g) || [];

        for (var i=0; i<this.words.length; i++)
        {
            var word = this.words[i];
            if (word.startsWith('@')) {
                this.mod = word.substring(1).toLowerCase();
                this.words.splice(i, 1);
                i--;
                continue;
            }
            this.words[i] = word = word.toLowerCase();
            var len = word.length;
            var c1=0, c2=0;
            for (var j=0; j<len; j++) {
                var char = word.charCodeAt(j);
                var c0:number;
                if (char >= code0 && char <= code9)
                    c0 = char - code0;
                else if (char >= codea && char <= codez)
                    c0 = char - codea + 10;
                else if (char >= codeA && char <= codeZ)
                    c0 = char - codeA + 10;
                else continue;

                this.SetBit(charOffset + c0);
                if (j >= 1) {
                    this.SetBit((c1 * charCount + c0)%charOffset);
                    if (j >= 2)
                        this.SetBit(((c2 * charCount + c1)*charCount + c0)%charOffset);
                }

                c2 = c1;
                c1 = c0;
            }
        }
    }

    private SetBit(bitId:number)
    {
        var element = Math.trunc(bitId / 32);
        var bit = 1 << (bitId % 32);
        this.indexBits[element] |= bit;
    }

    Match(text: string | null): boolean
    {
        if (text === null)
            return false;
        var textLower = text.toLowerCase();
        for (var i=0; i<this.words.length; i++)
        {
            if (!textLower.includes(this.words[i]))
                return false;
        }
        return true;
    }
}

class ChineseSearchQueryVariant extends SearchQueryVariant {
    constructor(text:string) {
        super(text);
        this.words = text.match(/[@\p{L}\p{N}_]+/gu) || [];

        for (var i=0; i<this.words.length; i++)
        {
            var word = this.words[i];
            if (word.startsWith('@')) {
                this.mod = word.substring(1).toLowerCase();
                this.words.splice(i, 1);
                i--;
                continue;
            }
            this.words[i] = word.toLowerCase();
        }
    }

    Match(text: string | null): boolean
    {
        if (text === null)
            return false;

        const normalizedText = ChineseSearchQueryVariant.NormalizeForSpaceInsensitiveMatch(text);
        for (const word of this.words) {
            const normalizedWord = ChineseSearchQueryVariant.NormalizeForSpaceInsensitiveMatch(word);
            if (normalizedWord.length > 0 && !normalizedText.includes(normalizedWord))
                return false;
        }
        return true;
    }

    private static NormalizeForSpaceInsensitiveMatch(text:string):string
    {
        return text.toLowerCase().replace(/\s+/g, "");
    }
}

export class SearchQuery
{
    original:string;
    words:string[];
    indexBits:Int32Array;
    mod:string | null;
    private variant:SearchQueryVariant;

    constructor(text:string, databaseLocale:SearchDatabaseLocale = normalizeSearchDatabaseLocale(getSearchDatabaseLocaleParam()))
    {
        this.variant = databaseLocale === "zh-CN"
            ? new ChineseSearchQueryVariant(text)
            : new EnglishSearchQueryVariant(text);
        this.original = this.variant.original;
        this.words = this.variant.words;
        this.indexBits = this.variant.indexBits;
        this.mod = this.variant.mod;
    }

    Match(text: string | null): boolean
    {
        return this.variant.Match(text);
    }
}
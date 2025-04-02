const special:string = "09azAZ";
const code0 = special.charCodeAt(0);
const code9 = special.charCodeAt(1);
const codea = special.charCodeAt(2);
const codez = special.charCodeAt(3);
const codeA = special.charCodeAt(4);
const codeZ = special.charCodeAt(5);
const charCount = 26+10;
const charOffset = 128-charCount;

export class SearchQuery
{
    original:string;
    words:string[];
    indexBits:Int32Array;

    constructor(text:string)
    {
        this.original = text;
        this.words = text.match(/[A-Za-z0-9]+/g) || [];
        this.indexBits = new Int32Array(4);

        for (var i=0; i<this.words.length; i++)
        {
            var word = this.words[i];
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

    SetBit(bitId:number)
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
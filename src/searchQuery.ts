export class SearchQuery
{
    original:string;
    words:string[];
    mod:string | null;

    constructor(text:string)
    {
        this.original = text;
        this.words = text.match(/[A-Za-z0-9@]+/g) || [];
        this.mod = null;

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
        }
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
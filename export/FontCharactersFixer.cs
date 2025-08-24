using System.Text;
using System.Text.Json;
using Source.Data;

namespace export;

public static class FontCharactersFixer
{
    private static readonly Dictionary<char, char> replacements = new()
    {
        {'\ue01a', '₀'},
        {'\ue020', '﹖'},
        {'\ue010', '⁰'},
        {'\ue011', '¹'},
        {'\ue012', '²'},
        {'\ue013', '³'},
        {'\ue014', '⁴'},
        {'\ue015', '⁵'},
        {'\ue016', '⁶'},
        {'\ue017', '⁷'},
        {'\ue018', '⁸'},
        {'\ue019', '⁹'},
        {'\ue000', '△'},
        {'\ue001', '▽'},
        {'\ue002', '△'},
        {'\ue003', '▽'},
        {'\ue004', '△'},
        {'\ue005', '▽'},
        {'\ue006', '❂'},
        {'\ue007', '⛏'},
        {'\ue008', '⇲'},
        {'\ue009', '⇱'},
        {'\ue00a', '⚡'},
        {'\ue00c', '❂'},
        {'\ue00d', '⁛'},
        {'\ue00e', '⍝'},
        {'\ue00f', '⊘'},
        {'\ue01e', '♛'},
        {'\ue01d', '♜'},
        {'\ue01f', '⨂'},
    };
    
    public static void FixFontCharacters(Repository repository)
    {
        Console.WriteLine("Fixing missing font characters...");
        foreach (var item in repository.items)
        {
            FixString(ref item.name, item);
            FixString(ref item.tooltip, item);
        }
        
        foreach (var item in repository.fluids)
        {
            FixString(ref item.name, item);
            FixString(ref item.tooltip, item);
        }
    }

    private static bool HasInvalidCharacters(string s)
    {
        foreach (var c in s)
        {
            if (c >= '\ue000' && c <= '\uf8ff')
                return true;
        }

        return false;
    }

    private static void FixString(ref string s, Goods item)
    {
        if (!HasInvalidCharacters(s))
            return;
        Span<char> newChars = stackalloc char[s.Length];
        s.CopyTo(newChars);

        for (var i = 0; i < newChars.Length; i++)
        {
            ref var c = ref newChars[i];
            if (!(c >= '\ue000' && c <= '\uf8ff'))
                continue;
            if (replacements.TryGetValue(c, out var replacement))
                c = replacement;
            else Console.WriteLine("Found unknown char \\u"+((int)c).ToString("X4")+" in item "+item.name);
        }

        s = new string(newChars);
    }
}
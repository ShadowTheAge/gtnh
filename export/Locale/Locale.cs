using System.Text.Json.Serialization;
using Source.Data;

namespace export;

public class Locale
{
    public readonly List<LocaleLanguage> languages = new List<LocaleLanguage>();
    public LocaleLanguage english;
    public readonly Dictionary<string, string> revEnglishMap = new Dictionary<string, string>();

    private static readonly string[] Languages = new[] { "de_DE", "es_ES", "fr_FR", "ja_JP", "ko_KR", "pl_PL", "pt_BR", "ru_RU", "tr_TR", "zh_CN" };

    private LocaleLanguage GetLanguageByFileName(string name)
    {
        foreach (var language in languages)
        {
            if (name.Contains(language.code, StringComparison.Ordinal))
                return language;
        }

        return null;
    }

    public void LoadFromFolder(string path)
    {
        var config = Path.Combine(path, "config");
        english = new LocaleLanguage("en_US");
        languages.Clear();
        languages.Add(english);
        foreach (var s in Languages)
        {
            var locale = new LocaleLanguage(s);
            languages.Add(locale);
        }

        foreach (var langFile in Directory.EnumerateFiles(config, "*.lang", SearchOption.AllDirectories))
        {
            var language = GetLanguageByFileName(langFile);
            if (language != null)
                language.ReadFromFile(langFile);
        }

        foreach (var language in languages)
            language.ReadFromFile(Path.Combine(path, language == english ? "GregTech.lang" : $"GregTech_{language.code}.lang"));
        foreach (var (k, v) in english.map)
            revEnglishMap[v] = k;
    }

    public LocalePack TranslateLocale(LocalePack original, LocaleLanguage language)
    {
        var copy = original.CreateCloneForTranslation(language.code);
        var translatedCount = 0;
        var totalCount = 0;
        for (var i = 0; i < copy.lines.Count; i++)
        {
            var key = copy.keys[i];
            totalCount++;
            if ((key != null && language.map.TryGetValue(key, out var translated)) ||
                (revEnglishMap.TryGetValue(copy.lines[i], out key) && language.map.TryGetValue(key, out translated)))
            {
                copy.lines[i] = translated;
                translatedCount++;
            }
        }
        
        Console.WriteLine($"Locale {language.code}: {translatedCount} out of {totalCount} keys translated ({(1000 * translatedCount / totalCount) / 10f}%)");

        return copy;
    }
}

public class LocalePackBuilder
{
    private readonly Dictionary<string, int> linesMap = new Dictionary<string, int>();
    private LocalePack current = new LocalePack();

    public LocalePack BuildDefault(Repository repository, string code)
    {
        current = new LocalePack();
        current.code = code;
        foreach (var item in repository.items)
            BuildGoods(item);
        foreach (var fluid in repository.fluids)
            BuildGoods(fluid);
        return current;
    }

    private void BuildGoods(Goods goods)
    {
        var id = goods.id;
        current.names[id] = AddLine(goods.name, goods.unlocalizedName + ".name");
        var tooltipIds = new int[goods.tooltipParts.Count];
        for (var i = 0; i < goods.tooltipParts.Count; i++)
            tooltipIds[i] = AddLine(goods.tooltipParts[i], null);
        current.tooltips[id] = tooltipIds;
    }

    private int AddLine(string line, string key)
    {
        if (linesMap.TryGetValue(line, out var existingNum))
            return existingNum;
        var num = linesMap.Count;
        current.lines.Add(line);
        current.keys.Add(key);
        linesMap[line] = num;
        return num;
    }
}

public class LocalePack
{
    public string code { get; set; }
    public List<string> lines { get; private set; } = new List<string>();
    [JsonIgnore] public List<string> keys { get; private set; } = new List<string>();
    public Dictionary<string, int> names { get; } = new Dictionary<string, int>();
    public Dictionary<string, int[]> tooltips { get; } = new Dictionary<string, int[]>();

    public LocalePack CreateCloneForTranslation(string code)
    {
        var copy = (LocalePack)MemberwiseClone();
        copy.code = code;
        copy.lines = [..copy.lines];
        return copy;
        // names and toolips can be shared between different locales
    }
}
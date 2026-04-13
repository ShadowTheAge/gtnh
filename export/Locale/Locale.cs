namespace export;

public class Locale
{
    public readonly List<LocaleLanguage> languages = new List<LocaleLanguage>();
    public LocaleLanguage english;
    public readonly Dictionary<string, string> revEnglishMap = new Dictionary<string, string>();

    private static readonly string[] Languages = new[] { "de_DE", "es_ES", "fr_FR", "ja_JP", "ko_KR", "pl_PL", "pt_BR", "ru_RU", "tr_TR", "zh_CN" };

    public void LoadFromFolder(string path)
    {
        english = new LocaleLanguage("en_US");
        english.ReadFromFile(Path.Combine(path, "GregTech.lang"));

        languages.Clear();
        foreach (var s in Languages)
        {
            var locale = new LocaleLanguage(s);
            locale.ReadFromFile(Path.Combine(path, $"GregTech_{s}.lang"));
            languages.Add(locale);
        }

        foreach (var (k, v) in english.map)
            revEnglishMap[v] = k;
    }
}
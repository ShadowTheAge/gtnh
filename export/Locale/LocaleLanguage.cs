namespace export;

public class LocaleLanguage
{
    public readonly string code;
    
    public LocaleLanguage(string code)
    {
        this.code = code;
    }
    public readonly Dictionary<string, string> map = new Dictionary<string, string>();

    public void ReadFromFile(string path)
    {
        foreach (var line in File.ReadAllLines(path))
        {
            var span = line.AsSpan();
            var trimmed = span.Trim();
            if (!trimmed.StartsWith("S:"))
                continue;
            trimmed = trimmed[2..];

            string key, value;
            if (trimmed[0] == '"')
            {
                var split = trimmed.IndexOf("\"=");
                value = trimmed.Slice(split + 2).ToString();
                key = trimmed.Slice(1, split - 1).ToString();
            }
            else
            {
                var split = trimmed.IndexOf('=');
                value = trimmed.Slice(split + 1).ToString();
                key = trimmed.Slice(0, split).ToString();
            }
            value = value.Replace("<BR>", "\n", StringComparison.OrdinalIgnoreCase);
            map[key] = value;
        }
    }
}